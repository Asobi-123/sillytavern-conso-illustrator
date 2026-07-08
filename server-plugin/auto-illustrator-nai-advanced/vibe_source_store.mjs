import {Buffer} from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Content-addressed on-disk store for Vibe Transfer source images.
 *
 * Source images (compressed reference thumbnails) used to live inline as
 * base64 inside SillyTavern's settings.json, duplicated across
 * `vibeTransferReferenceImages` and `vibeTransferLibraryItems`. That bloats
 * settings.json and slows down every settings read/write. This store moves the
 * raw bytes onto disk under the user's data directory, keyed by the SHA-256 of
 * the image bytes, so identical images are stored exactly once.
 */

const VIBE_SOURCE_DIR_NAME = 'auto-illustrator-vibe-source';
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIME_TO_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/octet-stream': 'bin',
};
const EXTENSION_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bin: 'application/octet-stream',
};
const SOURCE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bin'];

/**
 * Strips a data URL prefix and whitespace, returning the raw base64 payload
 * plus any declared image MIME type.
 * @param {unknown} image
 * @returns {{base64: string, hintedMimeType: string}}
 */
function parseBase64Image(image) {
  if (typeof image !== 'string') {
    return {base64: '', hintedMimeType: ''};
  }
  const trimmed = image.trim();
  const commaIndex = trimmed.indexOf(',');
  let hintedMimeType = '';
  if (trimmed.startsWith('data:') && commaIndex >= 0) {
    const prefix = trimmed.slice(5, commaIndex).split(';')[0].toLowerCase();
    if (prefix.startsWith('image/')) {
      hintedMimeType = prefix;
    }
  }
  const payload =
    trimmed.startsWith('data:') && commaIndex >= 0
      ? trimmed.slice(commaIndex + 1)
      : trimmed;
  const normalized = payload.replace(/\s+/g, '');
  return {
    base64: /^[A-Za-z0-9+/=]+$/.test(normalized) ? normalized : '',
    hintedMimeType,
  };
}

/**
 * Strips a data URL prefix and whitespace, returning the raw base64 payload.
 * Returns '' when the input is not usable base64.
 * @param {unknown} image
 * @returns {string}
 */
function normalizeBase64Image(image) {
  return parseBase64Image(image).base64;
}

/**
 * Detects common browser-loadable image types from magic bytes.
 * @param {Buffer} buffer
 * @returns {string}
 */
function sniffImageMimeType(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (
    buffer.length >= 6 &&
    ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))
  ) {
    return 'image/gif';
  }
  return '';
}

/**
 * @param {string} directoryPath
 * @returns {string}
 */
function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, {recursive: true});
  return directoryPath;
}

/**
 * Writes a buffer to disk atomically (temp file + rename) so a crash mid-write
 * never leaves a truncated source image.
 * @param {string} filePath
 * @param {Buffer} buffer
 */
function writeBufferAtomic(filePath, buffer) {
  ensureDirectory(path.dirname(filePath));
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, buffer);
  fs.renameSync(tempPath, filePath);
}

/**
 * Resolves the per-user vibe source directory, creating it when missing.
 * @param {{files?: string}} directories - SillyTavern `request.user.directories`
 * @returns {string}
 */
function getVibeSourceDir(directories) {
  const base = directories?.files;
  if (!base || typeof base !== 'string') {
    throw new Error('user files directory is unavailable');
  }
  return ensureDirectory(path.join(base, VIBE_SOURCE_DIR_NAME));
}

/**
 * @param {unknown} hash
 * @returns {string} the lowercased hash when it is a valid SHA-256 hex, else ''
 */
function sanitizeHash(hash) {
  if (typeof hash !== 'string') {
    return '';
  }
  const lower = hash.trim().toLowerCase();
  return HASH_PATTERN.test(lower) ? lower : '';
}

/**
 * @param {string} directoryPath
 * @param {string} hash
 * @returns {{filePath: string, mimeType: string} | null}
 */
function findStoredSourcePath(directoryPath, hash) {
  for (const extension of SOURCE_EXTENSIONS) {
    const filePath = path.join(directoryPath, `${hash}.${extension}`);
    if (fs.existsSync(filePath)) {
      return {
        filePath,
        mimeType: EXTENSION_TO_MIME[extension] ?? 'application/octet-stream',
      };
    }
  }
  return null;
}

/**
 * @param {Buffer} buffer
 * @returns {string} SHA-256 hex digest of the buffer
 */
export function hashSourceBytes(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Stores a base64 (or data URL) source image on disk, keyed by its content
 * hash. Idempotent: identical bytes reuse the same file and are never
 * rewritten.
 * @param {{files?: string}} directories
 * @param {string} base64OrDataUrl
 * @returns {string} the content hash
 */
export function storeVibeSource(directories, base64OrDataUrl) {
  const {base64: normalized, hintedMimeType} =
    parseBase64Image(base64OrDataUrl);
  if (!normalized) {
    throw new Error('source image is not valid base64');
  }
  const buffer = Buffer.from(normalized, 'base64');
  if (buffer.length === 0) {
    throw new Error('source image decoded to zero bytes');
  }
  const hash = hashSourceBytes(buffer);
  const dir = getVibeSourceDir(directories);
  const existing = findStoredSourcePath(dir, hash);
  if (!existing) {
    const mimeType =
      sniffImageMimeType(buffer) ||
      (MIME_TO_EXTENSION[hintedMimeType] ? hintedMimeType : '') ||
      'application/octet-stream';
    const extension = MIME_TO_EXTENSION[mimeType] ?? 'bin';
    const filePath = path.join(dir, `${hash}.${extension}`);
    writeBufferAtomic(filePath, buffer);
  }
  return hash;
}

/**
 * Reads a stored source image with its MIME type.
 * @param {{files?: string}} directories
 * @param {string} hash
 * @returns {{buffer: Buffer, mimeType: string} | null}
 */
export function readVibeSource(directories, hash) {
  const safe = sanitizeHash(hash);
  if (!safe) {
    return null;
  }
  const stored = findStoredSourcePath(getVibeSourceDir(directories), safe);
  if (!stored) {
    return null;
  }
  return {
    buffer: fs.readFileSync(stored.filePath),
    mimeType: stored.mimeType,
  };
}

/**
 * Reads a stored source image as raw bytes.
 * @param {{files?: string}} directories
 * @param {string} hash
 * @returns {Buffer | null} the bytes, or null when absent / invalid hash
 */
export function readVibeSourceBuffer(directories, hash) {
  return readVibeSource(directories, hash)?.buffer ?? null;
}

/**
 * Reads a stored source image as normalized base64 (no data URL prefix).
 * @param {{files?: string}} directories
 * @param {string} hash
 * @returns {string | null}
 */
export function readVibeSourceBase64(directories, hash) {
  const buffer = readVibeSourceBuffer(directories, hash);
  return buffer ? buffer.toString('base64') : null;
}

/**
 * @param {{files?: string}} directories
 * @param {string} hash
 * @returns {boolean} whether a source image with this hash exists on disk
 */
export function hasVibeSource(directories, hash) {
  const safe = sanitizeHash(hash);
  if (!safe) {
    return false;
  }
  return Boolean(findStoredSourcePath(getVibeSourceDir(directories), safe));
}

/**
 * Lists the content hashes currently present on disk. Used by the prune route
 * to drop sources no longer referenced by any settings entry.
 * @param {{files?: string}} directories
 * @returns {string[]}
 */
export function listVibeSourceHashes(directories) {
  const dir = getVibeSourceDir(directories);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, {withFileTypes: true})
    .filter(entry => entry.isFile())
    .map(entry => {
      const extension = path.extname(entry.name).slice(1).toLowerCase();
      return SOURCE_EXTENSIONS.includes(extension)
        ? path.basename(entry.name, `.${extension}`)
        : '';
    })
    .filter(name => HASH_PATTERN.test(name));
}

/**
 * Deletes source images whose hash is not in `keepHashes`. Returns the number
 * of files removed.
 * @param {{files?: string}} directories
 * @param {Iterable<string>} keepHashes
 * @returns {number}
 */
export function pruneVibeSources(directories, keepHashes) {
  const keep = new Set();
  for (const hash of keepHashes) {
    const safe = sanitizeHash(hash);
    if (safe) {
      keep.add(safe);
    }
  }
  const dir = getVibeSourceDir(directories);
  let removed = 0;
  for (const hash of listVibeSourceHashes(directories)) {
    if (keep.has(hash)) {
      continue;
    }
    for (const extension of SOURCE_EXTENSIONS) {
      const filePath = path.join(dir, `${hash}.${extension}`);
      if (!fs.existsSync(filePath)) {
        continue;
      }
      try {
        fs.rmSync(filePath);
        removed += 1;
      } catch (error) {
        console.warn(
          '[auto-illustrator] Failed to prune vibe source',
          hash,
          error
        );
      }
    }
  }
  return removed;
}

export const VIBE_SOURCE_STORE_INTERNALS = {
  VIBE_SOURCE_DIR_NAME,
  normalizeBase64Image,
  parseBase64Image,
  sanitizeHash,
  sniffImageMimeType,
};
