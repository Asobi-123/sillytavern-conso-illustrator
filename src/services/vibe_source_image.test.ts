import {afterEach, describe, expect, it, vi} from 'vitest';
import {VIBE_TRANSFER} from '../constants';
import {
  createVibeSourceDataUrl,
  createVibeThumbnailDataUrl,
} from './vibe_source_image';

describe('vibe_source_image', () => {
  const originalImage = globalThis.Image;
  const originalFileReader = globalThis.FileReader;
  const originalCreateElement = document.createElement.bind(document);

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Image = originalImage;
    globalThis.FileReader = originalFileReader;
  });

  it('compresses uploaded references into bounded JPEG source images', async () => {
    const originalDataUrl = 'data:image/png;base64,ORIGINAL_SOURCE';
    const compressedDataUrl = 'data:image/jpeg;base64,COMPRESSED_SOURCE';
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => compressedDataUrl);

    class MockFileReader {
      result: string | null = null;
      error: Error | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL() {
        this.result = originalDataUrl;
        this.onload?.();
      }
    }

    class MockImage {
      naturalWidth = 2000;
      naturalHeight = 1000;
      width = 2000;
      height = 1000;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    }

    globalThis.FileReader =
      MockFileReader as unknown as typeof globalThis.FileReader;
    globalThis.Image = MockImage as unknown as typeof globalThis.Image;
    vi.spyOn(document, 'createElement').mockImplementation(tagName => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({drawImage})),
          toDataURL,
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    const result = await createVibeSourceDataUrl(
      new File(['x'], 'large.png', {type: 'image/png'})
    );

    expect(result).toBe(compressedDataUrl);
    expect(result).not.toBe(originalDataUrl);
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(MockImage),
      0,
      0,
      VIBE_TRANSFER.MAX_SOURCE_IMAGE_SIZE,
      VIBE_TRANSFER.MAX_SOURCE_IMAGE_SIZE / 2
    );
    expect(toDataURL).toHaveBeenCalledWith(
      VIBE_TRANSFER.SOURCE_IMAGE_MIME_TYPE,
      VIBE_TRANSFER.SOURCE_IMAGE_QUALITY
    );
  });

  it('creates a bounded JPEG thumbnail from an exported source image', async () => {
    const sourceDataUrl = 'data:image/jpeg;base64,SOURCE';
    const thumbnailDataUrl = 'data:image/jpeg;base64,THUMBNAIL';
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => thumbnailDataUrl);

    class MockImage {
      naturalWidth = 1200;
      naturalHeight = 900;
      width = 1200;
      height = 900;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    }

    globalThis.Image = MockImage as unknown as typeof globalThis.Image;
    vi.spyOn(document, 'createElement').mockImplementation(tagName => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({drawImage})),
          toDataURL,
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    await expect(createVibeThumbnailDataUrl(sourceDataUrl)).resolves.toBe(
      thumbnailDataUrl
    );
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(MockImage),
      0,
      0,
      VIBE_TRANSFER.THUMBNAIL_MAX_SIZE,
      Math.round((900 * VIBE_TRANSFER.THUMBNAIL_MAX_SIZE) / 1200)
    );
    expect(toDataURL).toHaveBeenCalledWith(
      VIBE_TRANSFER.THUMBNAIL_MIME_TYPE,
      VIBE_TRANSFER.THUMBNAIL_QUALITY
    );
  });
});
