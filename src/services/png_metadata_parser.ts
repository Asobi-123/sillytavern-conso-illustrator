/**
 * PNG Metadata Parser
 * Extracts NovelAI generation metadata from PNG tEXt/iTXt chunks.
 * Pure browser-side implementation with zero external dependencies.
 */

import type {NovelAiParameters} from '../types';
import {PROMPT_LIBRARY_THUMBNAIL} from '../constants';

/** Raw text chunks extracted from PNG */
export interface PngTextChunks {
  [key: string]: string;
}

/** Result of parsing a PNG file for NovelAI metadata */
export interface PngMetadataResult {
  /** Whether NovelAI metadata was found */
  found: boolean;
  /** Positive prompt text */
  positivePrompt: string;
  /** Negative prompt (Undesired Content) */
  negativePrompt: string;
  /** Generation parameters */
  parameters: NovelAiParameters;
  /** Software that generated the image */
  software?: string;
  /** All raw text chunks from the PNG */
  rawChunks: PngTextChunks;
}

/** PNG file signature (first 8 bytes) */
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Reads a 4-byte big-endian unsigned integer from a DataView.
 */
function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

/**
 * Reads a chunk type string (4 ASCII chars) from a DataView.
 */
function readChunkType(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

/**
 * Decodes a Uint8Array as a Latin-1 (ISO 8859-1) string.
 */
function decodeLatin1(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

/**
 * Extracts all tEXt and iTXt chunks from a PNG ArrayBuffer.
 *
 * PNG chunk structure:
 *   4 bytes: data length
 *   4 bytes: chunk type (ASCII)
 *   N bytes: chunk data
 *   4 bytes: CRC
 *
 * tEXt chunk data: keyword (Latin-1) + null byte + text (Latin-1)
 * iTXt chunk data: keyword + null + compression flag + compression method
 *                  + language tag + null + translated keyword + null + text (UTF-8)
 */
export function extractPngTextChunks(buffer: ArrayBuffer): PngTextChunks {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const chunks: PngTextChunks = {};

  // Verify PNG signature
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      return chunks; // Not a PNG
    }
  }

  let offset = 8; // Skip signature
  while (offset < buffer.byteLength - 8) {
    const length = readUint32(view, offset);
    const type = readChunkType(view, offset + 4);
    const dataStart = offset + 8;

    if (type === 'tEXt') {
      // Find the null separator between keyword and value
      const chunkData = bytes.subarray(dataStart, dataStart + length);
      const nullIndex = chunkData.indexOf(0);
      if (nullIndex !== -1) {
        const keyword = decodeLatin1(chunkData.subarray(0, nullIndex));
        const value = decodeLatin1(chunkData.subarray(nullIndex + 1));
        chunks[keyword] = value;
      }
    } else if (type === 'iTXt') {
      // iTXt: keyword + \0 + compressionFlag + compressionMethod
      //       + languageTag + \0 + translatedKeyword + \0 + text (UTF-8)
      const chunkData = bytes.subarray(dataStart, dataStart + length);
      const nullIndex = chunkData.indexOf(0);
      if (nullIndex !== -1) {
        const keyword = decodeLatin1(chunkData.subarray(0, nullIndex));
        const compressionFlag = chunkData[nullIndex + 1];

        // Skip compression method (1 byte), then find language tag end
        let pos = nullIndex + 3;
        // Skip language tag
        while (pos < chunkData.length && chunkData[pos] !== 0) pos++;
        pos++; // Skip null after language tag
        // Skip translated keyword
        while (pos < chunkData.length && chunkData[pos] !== 0) pos++;
        pos++; // Skip null after translated keyword

        if (compressionFlag === 0 && pos <= chunkData.length) {
          // Uncompressed UTF-8 text
          const textBytes = chunkData.subarray(pos);
          const decoder = new TextDecoder('utf-8');
          chunks[keyword] = decoder.decode(textBytes);
        }
        // Compressed iTXt chunks are rare for NAI; skip for now
      }
    } else if (type === 'IEND') {
      break;
    }

    // Move to next chunk: length(4) + type(4) + data(length) + crc(4)
    offset = dataStart + length + 4;
  }

  return chunks;
}

/**
 * Parses NovelAI metadata from a PNG file's text chunks.
 */
export function parseNovelAiMetadata(chunks: PngTextChunks): PngMetadataResult {
  const result: PngMetadataResult = {
    found: false,
    positivePrompt: '',
    negativePrompt: '',
    parameters: {},
    rawChunks: chunks,
  };

  if (chunks['Software']) {
    result.software = chunks['Software'];
  }

  // Try to parse the Comment field (primary NAI metadata source)
  const comment = chunks['Comment'];
  if (comment) {
    try {
      const parsed = JSON.parse(comment);
      if (parsed && typeof parsed === 'object') {
        result.found = true;
        result.positivePrompt = String(parsed.prompt || '');
        result.negativePrompt = String(parsed.uc || '');

        // Extract known parameters
        const params: NovelAiParameters = {};
        if (parsed.steps !== undefined && parsed.steps !== null)
          params.steps = Number(parsed.steps);
        if (parsed.sampler !== undefined && parsed.sampler !== null)
          params.sampler = String(parsed.sampler);
        if (parsed.seed !== undefined && parsed.seed !== null)
          params.seed = Number(parsed.seed);
        if (parsed.scale !== undefined && parsed.scale !== null)
          params.scale = Number(parsed.scale);
        if (parsed.width !== undefined && parsed.width !== null)
          params.width = Number(parsed.width);
        if (parsed.height !== undefined && parsed.height !== null)
          params.height = Number(parsed.height);
        if (parsed.strength !== undefined && parsed.strength !== null)
          params.strength = Number(parsed.strength);
        if (parsed.noise !== undefined && parsed.noise !== null)
          params.noise = Number(parsed.noise);

        // Preserve extra params
        const knownKeys = new Set([
          'prompt',
          'uc',
          'steps',
          'sampler',
          'seed',
          'scale',
          'width',
          'height',
          'strength',
          'noise',
        ]);
        for (const [key, value] of Object.entries(parsed)) {
          if (!knownKeys.has(key)) {
            params[key] = value;
          }
        }

        result.parameters = params;
      }
    } catch {
      // Comment exists but isn't valid JSON — not NAI format
    }
  }

  // Fallback: if no Comment but Description exists, use it as positive prompt
  if (!result.found && chunks['Description']) {
    result.found = true;
    result.positivePrompt = chunks['Description'];
  }

  // Use Software field to infer model
  if (result.found && result.software && !result.parameters.model) {
    result.parameters.model = result.software;
  }

  return result;
}

/**
 * Reads a File as an ArrayBuffer.
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses a PNG file and extracts NovelAI metadata.
 */
export async function parsePngMetadata(file: File): Promise<PngMetadataResult> {
  const buffer = await readFileAsArrayBuffer(file);
  const chunks = extractPngTextChunks(buffer);
  return parseNovelAiMetadata(chunks);
}

/**
 * Generates a JPEG thumbnail from an image file using Canvas.
 * Returns a base64 data URL string.
 */
export function generateThumbnail(
  file: File,
  maxSize: number = PROMPT_LIBRARY_THUMBNAIL.MAX_SIZE,
  quality: number = PROMPT_LIBRARY_THUMBNAIL.QUALITY
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        // Calculate scaled dimensions
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to create canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}
