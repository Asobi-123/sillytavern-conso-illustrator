/**
 * Tests for PNG Metadata Parser
 */

import {describe, it, expect} from 'vitest';
import {
  extractPngTextChunks,
  parseNovelAiMetadata,
  type PngTextChunks,
} from '../services/png_metadata_parser';

/** PNG signature bytes */
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * Helper: builds a minimal PNG ArrayBuffer with given tEXt chunks.
 * Structure: PNG signature + IHDR chunk (minimal) + tEXt chunks + IEND chunk
 */
function buildPngWithTextChunks(
  textChunks: Record<string, string>
): ArrayBuffer {
  const parts: number[] = [...PNG_SIG];

  // Minimal IHDR chunk (13 bytes data)
  const ihdrData = new Uint8Array(13);
  addChunk(parts, 'IHDR', ihdrData);

  // tEXt chunks
  for (const [keyword, value] of Object.entries(textChunks)) {
    const keyBytes = stringToBytes(keyword);
    const valBytes = stringToBytes(value);
    const data = new Uint8Array(keyBytes.length + 1 + valBytes.length);
    data.set(keyBytes, 0);
    data[keyBytes.length] = 0; // null separator
    data.set(valBytes, keyBytes.length + 1);
    addChunk(parts, 'tEXt', data);
  }

  // IEND chunk (0 bytes data)
  addChunk(parts, 'IEND', new Uint8Array(0));

  return new Uint8Array(parts).buffer;
}

function stringToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function addChunk(parts: number[], type: string, data: Uint8Array): void {
  // Length (4 bytes big-endian)
  const len = data.length;
  parts.push(
    (len >> 24) & 0xff,
    (len >> 16) & 0xff,
    (len >> 8) & 0xff,
    len & 0xff
  );
  // Type (4 ASCII chars)
  for (let i = 0; i < 4; i++) parts.push(type.charCodeAt(i));
  // Data
  for (let i = 0; i < data.length; i++) parts.push(data[i]);
  // CRC placeholder (4 bytes, not validated by parser)
  parts.push(0, 0, 0, 0);
}

describe('extractPngTextChunks', () => {
  it('returns empty object for non-PNG buffer', async () => {
    const buf = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    expect(await extractPngTextChunks(buf)).toEqual({});
  });

  it('extracts single tEXt chunk', async () => {
    const buf = buildPngWithTextChunks({Title: 'AI generated image'});
    const chunks = await extractPngTextChunks(buf);
    expect(chunks['Title']).toBe('AI generated image');
  });

  it('extracts multiple tEXt chunks', async () => {
    const buf = buildPngWithTextChunks({
      Title: 'AI generated image',
      Software: 'NovelAI',
      Description: '1girl, blue hair',
    });
    const chunks = await extractPngTextChunks(buf);
    expect(chunks['Title']).toBe('AI generated image');
    expect(chunks['Software']).toBe('NovelAI');
    expect(chunks['Description']).toBe('1girl, blue hair');
  });

  it('extracts Comment chunk with JSON content', async () => {
    const comment = JSON.stringify({
      prompt: '1girl, blue hair, school uniform',
      uc: 'lowres, bad anatomy',
      steps: 28,
      sampler: 'k_euler_ancestral',
      seed: 12345,
      scale: 7.0,
    });
    const buf = buildPngWithTextChunks({Comment: comment});
    const chunks = await extractPngTextChunks(buf);
    expect(chunks['Comment']).toBe(comment);
  });

  it('handles empty PNG (just signature + IEND)', async () => {
    const parts = [...PNG_SIG];
    addChunk(parts, 'IEND', new Uint8Array(0));
    const buf = new Uint8Array(parts).buffer;
    expect(await extractPngTextChunks(buf)).toEqual({});
  });
});

describe('parseNovelAiMetadata', () => {
  it('parses full NovelAI Comment JSON', () => {
    const chunks: PngTextChunks = {
      Software: 'NovelAI',
      Comment: JSON.stringify({
        prompt: '1girl, blue hair, school uniform',
        uc: 'lowres, bad anatomy, bad hands',
        steps: 28,
        sampler: 'k_euler_ancestral',
        seed: 42,
        scale: 7.0,
        width: 1216,
        height: 832,
        strength: 0.7,
        noise: 0.2,
      }),
    };
    const result = parseNovelAiMetadata(chunks);
    expect(result.found).toBe(true);
    expect(result.positivePrompt).toBe('1girl, blue hair, school uniform');
    expect(result.negativePrompt).toBe('lowres, bad anatomy, bad hands');
    expect(result.parameters.steps).toBe(28);
    expect(result.parameters.sampler).toBe('k_euler_ancestral');
    expect(result.parameters.seed).toBe(42);
    expect(result.parameters.scale).toBe(7.0);
    expect(result.parameters.width).toBe(1216);
    expect(result.parameters.height).toBe(832);
    expect(result.parameters.strength).toBe(0.7);
    expect(result.parameters.noise).toBe(0.2);
    expect(result.software).toBe('NovelAI');
  });

  it('preserves unknown parameters', () => {
    const chunks: PngTextChunks = {
      Comment: JSON.stringify({
        prompt: 'test',
        uc: '',
        steps: 20,
        cfg_rescale: 0.5,
        sm: true,
        sm_dyn: false,
      }),
    };
    const result = parseNovelAiMetadata(chunks);
    expect(result.found).toBe(true);
    expect(result.parameters.cfg_rescale).toBe(0.5);
    expect(result.parameters.sm).toBe(true);
    expect(result.parameters.sm_dyn).toBe(false);
  });

  it('falls back to Description when no Comment', () => {
    const chunks: PngTextChunks = {
      Description: '1girl, sitting, park',
      Software: 'NovelAI',
    };
    const result = parseNovelAiMetadata(chunks);
    expect(result.found).toBe(true);
    expect(result.positivePrompt).toBe('1girl, sitting, park');
    expect(result.negativePrompt).toBe('');
    expect(result.parameters.model).toBe('NovelAI');
  });

  it('returns found=false for empty chunks', () => {
    const result = parseNovelAiMetadata({});
    expect(result.found).toBe(false);
    expect(result.positivePrompt).toBe('');
    expect(result.negativePrompt).toBe('');
  });

  it('returns found=false for invalid JSON in Comment', () => {
    const chunks: PngTextChunks = {
      Comment: 'not valid json {{{',
    };
    const result = parseNovelAiMetadata(chunks);
    expect(result.found).toBe(false);
  });

  it('handles Comment with only prompt and uc', () => {
    const chunks: PngTextChunks = {
      Comment: JSON.stringify({
        prompt: 'simple prompt',
        uc: 'simple negative',
      }),
    };
    const result = parseNovelAiMetadata(chunks);
    expect(result.found).toBe(true);
    expect(result.positivePrompt).toBe('simple prompt');
    expect(result.negativePrompt).toBe('simple negative');
    expect(result.parameters.steps).toBeUndefined();
  });

  it('handles missing prompt field gracefully', () => {
    const chunks: PngTextChunks = {
      Comment: JSON.stringify({steps: 20, sampler: 'euler'}),
    };
    const result = parseNovelAiMetadata(chunks);
    expect(result.found).toBe(true);
    expect(result.positivePrompt).toBe('');
    expect(result.parameters.steps).toBe(20);
  });
});
