import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  buildNovelAiInpaintPayload,
  generateNovelAiInpaintImage,
} from './inpainting';
import {clearCsrfTokenCache} from '../utils/api';

vi.mock('../logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function createContext(): SillyTavernContext {
  return {
    name1: 'User',
    name2: 'Alice',
    extensionSettings: {
      sd: {
        prompt_prefix: 'best quality, {prompt}',
        negative_prompt: 'bad hands',
        model: 'nai-diffusion-4-5-full',
        sampler: 'k_euler_ancestral',
        scheduler: 'karras',
        steps: 30,
        scale: 7,
        width: 1216,
        height: 832,
        hr_scale: 1,
        novel_decrisper: false,
        novel_sm: true,
        novel_sm_dyn: false,
        seed: 123,
      },
    },
  } as unknown as SillyTavernContext;
}

describe('inpainting service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCsrfTokenCache();
  });

  it('builds NovelAI inpaint payload from base image, mask, prompt, and SD settings', () => {
    const payload = buildNovelAiInpaintPayload(
      {
        prompt: '1girl, garden',
        baseImageDataUrl: 'data:image/png;base64,QUJDRA==',
        maskDataUrl: ' data:image/png;base64,//// ',
        width: 512.4,
        height: 768.6,
        strength: 0.45,
      },
      createContext()
    );

    expect(payload.prompt).toBe('best quality, 1girl, garden');
    expect(payload.negative_prompt).toBe('bad hands');
    expect(payload.image).toBe('QUJDRA==');
    expect(payload.mask).toBe('////');
    expect(payload.width).toBe(512);
    expect(payload.height).toBe(769);
    expect(payload.strength).toBe(0.45);
    expect(payload.steps).toBe(24);
    expect(payload.seed).toBe(123);
  });

  it('accepts raw base64 payloads and strips whitespace', () => {
    const payload = buildNovelAiInpaintPayload(
      {
        prompt: 'castle',
        baseImageDataUrl: ' QUJD\nRA== ',
        maskDataUrl: '\t////\n',
        width: 640,
        height: 640,
        strength: 0.6,
      },
      createContext()
    );

    expect(payload.image).toBe('QUJDRA==');
    expect(payload.mask).toBe('////');
  });

  it('clamps inpainting strength to NovelAI image edit bounds', () => {
    const high = buildNovelAiInpaintPayload(
      {
        prompt: 'castle',
        baseImageDataUrl: 'QUJDRA==',
        maskDataUrl: '////',
        width: 512,
        height: 512,
        strength: 9,
      },
      createContext()
    );
    const low = buildNovelAiInpaintPayload(
      {
        prompt: 'castle',
        baseImageDataUrl: 'QUJDRA==',
        maskDataUrl: '////',
        width: 512,
        height: 512,
        strength: -3,
      },
      createContext()
    );
    const fallback = buildNovelAiInpaintPayload(
      {
        prompt: 'castle',
        baseImageDataUrl: 'QUJDRA==',
        maskDataUrl: '////',
        width: 512,
        height: 512,
        strength: Number.NaN,
      },
      createContext()
    );

    expect(high.strength).toBe(1);
    expect(low.strength).toBe(0);
    expect(fallback.strength).toBe(0.45);
  });

  it('defaults color_correct to true and honors an explicit false', () => {
    const defaulted = buildNovelAiInpaintPayload(
      {
        prompt: 'castle',
        baseImageDataUrl: 'QUJDRA==',
        maskDataUrl: '////',
        width: 512,
        height: 512,
        strength: 0.45,
      },
      createContext()
    );
    const disabled = buildNovelAiInpaintPayload(
      {
        prompt: 'castle',
        baseImageDataUrl: 'QUJDRA==',
        maskDataUrl: '////',
        width: 512,
        height: 512,
        strength: 0.45,
        colorCorrect: false,
      },
      createContext()
    );

    expect(defaulted.color_correct).toBe(true);
    expect(disabled.color_correct).toBe(false);
  });

  it('appends editor negative prompt to the global negative prompt', () => {
    const payload = buildNovelAiInpaintPayload(
      {
        prompt: 'castle',
        baseImageDataUrl: 'QUJDRA==',
        maskDataUrl: '////',
        width: 512,
        height: 512,
        strength: 0.45,
        negativePrompt: 'blue',
      },
      createContext()
    );

    expect(payload.negative_prompt).toContain('bad hands');
    expect(payload.negative_prompt).toContain('blue');
  });

  it('rejects empty base image, empty mask, and invalid dimensions', () => {
    expect(() =>
      buildNovelAiInpaintPayload(
        {
          prompt: 'castle',
          baseImageDataUrl: '',
          maskDataUrl: '////',
          width: 512,
          height: 512,
          strength: 0.6,
        },
        createContext()
      )
    ).toThrow('Inpaint base image is empty');

    expect(() =>
      buildNovelAiInpaintPayload(
        {
          prompt: 'castle',
          baseImageDataUrl: 'QUJDRA==',
          maskDataUrl: '',
          width: 512,
          height: 512,
          strength: 0.6,
        },
        createContext()
      )
    ).toThrow('Inpaint mask is empty');

    expect(() =>
      buildNovelAiInpaintPayload(
        {
          prompt: 'castle',
          baseImageDataUrl: 'QUJDRA==',
          maskDataUrl: '////',
          width: 0,
          height: 512,
          strength: 0.6,
        },
        createContext()
      )
    ).toThrow('Invalid inpaint canvas dimensions');
  });

  it('calls inpaint route and uploads returned base64 image', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({token: 'csrf'}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({format: 'png', data: 'IMAGEBASE64'}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({path: '/user/images/Alice/inpaint.png'}),
      });
    vi.stubGlobal('fetch', fetchMock);

    const path = await generateNovelAiInpaintImage(
      {
        prompt: 'castle',
        baseImageDataUrl: 'QUJDRA==',
        maskDataUrl: '////',
        width: 512,
        height: 512,
        strength: 0.6,
      },
      createContext()
    );

    expect(path).toBe('/user/images/Alice/inpaint.png');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/plugins/auto-illustrator-nai-advanced/generate-inpaint-image'
    );
    expect(fetchMock.mock.calls[2][0]).toBe('/api/images/upload');
  });

  it('surfaces JSON error details from failed inpaint route responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({token: 'csrf'}),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () =>
          JSON.stringify({
            error: 'NovelAI inpaint generation failed: 400 bad mask',
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateNovelAiInpaintImage(
        {
          prompt: 'castle',
          baseImageDataUrl: 'QUJDRA==',
          maskDataUrl: '////',
          width: 512,
          height: 512,
          strength: 0.6,
        },
        createContext()
      )
    ).rejects.toMatchObject({
      detail: 'NovelAI inpaint generation failed: 400 bad mask',
    });
  });
});
