import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {describe, it} from 'vitest';

import {
  hasVibeSource,
  listVibeSourceHashes,
  pruneVibeSources,
  readVibeSource,
  readVibeSourceBase64,
  readVibeSourceBuffer,
  storeVibeSource,
  VIBE_SOURCE_STORE_INTERNALS,
} from './vibe_source_store.mjs';

const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString(
  'base64'
);
const PNG_BASE64 = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]).toString('base64');

function createTempDirectories() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conso-vibe-source-'));
  return {
    root,
    directories: {files: root},
    cleanup: () => fs.rmSync(root, {recursive: true, force: true}),
  };
}

describe('vibe_source_store', () => {
  it('stores source images by content hash and reads them back', () => {
    const {root, directories, cleanup} = createTempDirectories();
    try {
      const hash = storeVibeSource(
        directories,
        `data:image/jpeg;base64,${JPEG_BASE64}`
      );
      const storeDir = path.join(
        root,
        VIBE_SOURCE_STORE_INTERNALS.VIBE_SOURCE_DIR_NAME
      );

      assert.match(hash, /^[a-f0-9]{64}$/);
      assert.equal(fs.existsSync(path.join(storeDir, `${hash}.jpg`)), true);
      assert.equal(hasVibeSource(directories, hash), true);
      assert.deepEqual(listVibeSourceHashes(directories), [hash]);
      assert.equal(readVibeSourceBase64(directories, hash), JPEG_BASE64);
      assert.deepEqual([...readVibeSourceBuffer(directories, hash)], [
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
      ]);
      assert.equal(readVibeSource(directories, hash)?.mimeType, 'image/jpeg');
    } finally {
      cleanup();
    }
  });

  it('deduplicates identical bytes even with different data URL hints', () => {
    const {root, directories, cleanup} = createTempDirectories();
    try {
      const first = storeVibeSource(
        directories,
        `data:image/jpeg;base64,${JPEG_BASE64}`
      );
      const second = storeVibeSource(directories, JPEG_BASE64);
      const storeDir = path.join(
        root,
        VIBE_SOURCE_STORE_INTERNALS.VIBE_SOURCE_DIR_NAME
      );

      assert.equal(second, first);
      assert.deepEqual(
        fs.readdirSync(storeDir).filter(name => name.endsWith('.jpg')),
        [`${first}.jpg`]
      );
    } finally {
      cleanup();
    }
  });

  it('detects PNG bytes and prunes unreferenced source files', () => {
    const {directories, cleanup} = createTempDirectories();
    try {
      const keepHash = storeVibeSource(directories, PNG_BASE64);
      const removeHash = storeVibeSource(directories, JPEG_BASE64);

      assert.equal(
        readVibeSource(directories, keepHash)?.mimeType,
        'image/png'
      );
      assert.equal(pruneVibeSources(directories, [keepHash]), 1);
      assert.equal(hasVibeSource(directories, keepHash), true);
      assert.equal(hasVibeSource(directories, removeHash), false);
      assert.deepEqual(listVibeSourceHashes(directories), [keepHash]);
    } finally {
      cleanup();
    }
  });

  it('rejects invalid base64 and invalid hashes without path traversal', () => {
    const {directories, cleanup} = createTempDirectories();
    try {
      assert.throws(
        () => storeVibeSource(directories, 'not base64!'),
        /not valid base64/
      );
      assert.equal(hasVibeSource(directories, '../outside'), false);
      assert.equal(readVibeSourceBuffer(directories, '../outside'), null);
      assert.equal(readVibeSourceBase64(directories, 'abc'), null);
    } finally {
      cleanup();
    }
  });
});
