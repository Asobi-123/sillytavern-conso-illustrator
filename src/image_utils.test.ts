/**
 * Unit tests for image_utils module
 */

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {extractImagesFromMessage, normalizeImageUrl} from './image_utils';

const getMetadataMock = vi.hoisted(() => vi.fn());

vi.mock('./metadata', () => ({
  getMetadata: getMetadataMock,
}));

vi.mock('./logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

beforeEach(() => {
  getMetadataMock.mockReset();
});

describe('normalizeImageUrl', () => {
  describe('data URIs', () => {
    it('should preserve data URIs with base64 encoding', () => {
      const dataUri =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+PC9zdmc+';
      expect(normalizeImageUrl(dataUri)).toBe(dataUri);
    });

    it('should preserve data URIs with charset', () => {
      const dataUri =
        'data:image/svg+xml;charset=utf-8;base64,PHN2ZyB3aWR0aD0iMTI4Ij48L3N2Zz4=';
      expect(normalizeImageUrl(dataUri)).toBe(dataUri);
    });

    it('should preserve data URIs without base64', () => {
      const dataUri = 'data:image/svg+xml,<svg></svg>';
      expect(normalizeImageUrl(dataUri)).toBe(dataUri);
    });
  });

  describe('absolute URLs', () => {
    it('should extract pathname from absolute HTTP URL', () => {
      const url = 'http://example.com/user/images/test.png';
      expect(normalizeImageUrl(url)).toBe('/user/images/test.png');
    });

    it('should extract pathname from absolute HTTPS URL', () => {
      const url = 'https://example.com/images/avatar.jpg';
      expect(normalizeImageUrl(url)).toBe('/images/avatar.jpg');
    });

    it('should decode URL-encoded characters in pathname', () => {
      const url =
        'http://example.com/user/images/%E5%B0%8F%E8%AF%B4%E5%AE%B6/test.png';
      expect(normalizeImageUrl(url)).toBe('/user/images/小说家/test.png');
    });
  });

  describe('relative paths', () => {
    it('should return relative path as-is', () => {
      const path = '/user/images/test.png';
      expect(normalizeImageUrl(path)).toBe('/user/images/test.png');
    });

    it('should decode URL-encoded characters in relative path', () => {
      const path = '/user/images/%E5%B0%8F%E8%AF%B4%E5%AE%B6/test.png';
      expect(normalizeImageUrl(path)).toBe('/user/images/小说家/test.png');
    });

    it('should strip query string and hash from relative paths', () => {
      const path = '/user/images/test.png?foo=1#preview';
      expect(normalizeImageUrl(path)).toBe('/user/images/test.png');
    });

    it('should preserve undecodable relative paths instead of throwing', () => {
      const path = '/user/images/%E0%A4%A/test.png';
      expect(normalizeImageUrl(path)).toBe('/user/images/%E0%A4%A/test.png');
    });
  });
});

describe('extractImagesFromMessage', () => {
  it('should attach randomization metadata from normalized image URL', () => {
    getMetadataMock.mockReturnValue({
      promptRegistry: {
        nodes: {},
        imageToPromptId: {},
        rootPromptIds: [],
      },
      imageRandomizations: {
        '/user/images/test.png': {
          sdStyleName: 'Oil Style',
          vibeCombinationName: 'Oil Vibe',
        },
      },
    });

    const images = extractImagesFromMessage(
      '<img src="https://example.com/user/images/test.png" title="AI generated image: 1girl" alt="1girl">',
      3
    );

    expect(images).toHaveLength(1);
    expect(images[0].randomization).toEqual({
      sdStyleName: 'Oil Style',
      vibeCombinationName: 'Oil Vibe',
    });
  });
});
