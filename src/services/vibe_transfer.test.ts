import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  buildNovelAiAdvancedPayload,
  buildVibeTransferConfigFromSettings,
  generateNovelAiVibeTransferImage,
  mergeVibeTransferReferenceUpdates,
  shouldUseVibeTransfer,
} from './vibe_transfer';
import {clearCsrfTokenCache} from '../utils/api';
import type {VibeTransferReferenceImage} from '../types';

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

function createSettings(
  partial: Partial<AutoIllustratorSettings>
): AutoIllustratorSettings {
  return partial as unknown as AutoIllustratorSettings;
}

function createReferenceImage(
  partial: Omit<VibeTransferReferenceImage, 'tags' | 'enabled'> &
    Partial<Pick<VibeTransferReferenceImage, 'tags' | 'enabled'>>
): VibeTransferReferenceImage {
  return {
    tags: [],
    enabled: true,
    ...partial,
  };
}

describe('vibe_transfer service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCsrfTokenCache();
  });

  it('builds disabled config without enabling advanced route', () => {
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: false,
        vibeTransferReferenceImages: [
          createReferenceImage({
            id: 'ref1',
            name: 'ref.png',
            dataUrl: 'data:image/png;base64,AAAA',
            addedAt: 1,
          }),
        ],
        vibeTransferReferenceStrength: 0.6,
        vibeTransferInformationExtracted: 1,
      })
    );

    expect(config.enabled).toBe(false);
    expect(config.referenceImages).toHaveLength(1);
    expect(shouldUseVibeTransfer(config)).toBe(false);
  });

  it('does not use Vibe Transfer without reference images', () => {
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferReferenceImages: [],
        vibeTransferReferenceStrength: 0.6,
        vibeTransferInformationExtracted: 1,
      })
    );

    expect(shouldUseVibeTransfer(config)).toBe(false);
  });

  it('maps valid reference images to NovelAI reference arrays', () => {
    const context = createContext();
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferReferenceImages: [
          createReferenceImage({
            id: 'ref1',
            name: 'ref.png',
            dataUrl: 'data:image/png;base64,QUJDRA==',
            addedAt: 1,
          }),
          createReferenceImage({
            id: 'ref2',
            name: 'ref2.png',
            dataUrl: ' RUZH ',
            addedAt: 2,
          }),
        ],
        vibeTransferReferenceStrength: 0.75,
        vibeTransferInformationExtracted: 0.35,
      })
    );

    const payload = buildNovelAiAdvancedPayload(
      '1girl, garden',
      context,
      config
    );

    expect(payload.prompt).toBe('best quality, 1girl, garden');
    expect(payload.negative_prompt).toBe('bad hands');
    expect(payload.reference_image_multiple).toEqual(['QUJDRA==', 'RUZH']);
    expect(payload.reference_strength_multiple).toEqual([0.75, 0.75]);
    expect(payload.reference_information_extracted_multiple).toEqual([
      0.35, 0.35,
    ]);
    expect(payload.seed).toBe(123);
  });

  it('uses only enabled reference images and sends cached encoded vibes', () => {
    const context = createContext();
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferReferenceImages: [
          createReferenceImage({
            id: 'ref1',
            name: 'ref.png',
            dataUrl: 'data:image/png;base64,QUJDRA==',
            enabled: true,
            encodedVibes: [
              {
                model: 'nai-diffusion-4-5-full',
                informationExtracted: 0.35,
                sourceFingerprint: 'cba6781a',
                encoded: 'ENCODED',
                createdAt: 1,
              },
            ],
            addedAt: 1,
          }),
          createReferenceImage({
            id: 'ref2',
            name: 'ref2.png',
            dataUrl: 'data:image/png;base64,RUZH',
            enabled: false,
            addedAt: 2,
          }),
        ],
        vibeTransferReferenceStrength: 0.75,
        vibeTransferInformationExtracted: 0.35,
      })
    );

    const payload = buildNovelAiAdvancedPayload(
      '1girl, garden',
      context,
      config
    );

    expect(payload.reference_image_ids).toEqual(['ref1']);
    expect(payload.reference_image_multiple).toEqual(['QUJDRA==']);
    expect(payload.reference_encoded_vibe_multiple).toEqual(['ENCODED']);
  });

  it('merges updated encoded cache without dropping disabled references', () => {
    const merged = mergeVibeTransferReferenceUpdates(
      [
        createReferenceImage({
          id: 'ref1',
          name: 'ref.png',
          dataUrl: 'data:image/png;base64,AAAA',
          enabled: true,
          addedAt: 1,
        }),
        createReferenceImage({
          id: 'ref2',
          name: 'ref2.png',
          dataUrl: 'data:image/png;base64,BBBB',
          enabled: false,
          addedAt: 2,
        }),
      ],
      [
        createReferenceImage({
          id: 'ref1',
          name: 'ref.png',
          dataUrl: 'data:image/png;base64,AAAA',
          enabled: true,
          encodedVibes: [
            {
              model: 'nai-diffusion-4-5-full',
              informationExtracted: 1,
              sourceFingerprint: 'abc',
              encoded: 'ENCODED',
              createdAt: 3,
            },
          ],
          addedAt: 1,
        }),
      ]
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].encodedVibes?.[0].encoded).toBe('ENCODED');
    expect(merged[1].enabled).toBe(false);
  });

  it('clamps strength settings to 0-1', () => {
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferReferenceImages: [],
        vibeTransferReferenceStrength: 9,
        vibeTransferInformationExtracted: -2,
      })
    );

    expect(config.referenceStrength).toBe(1);
    expect(config.informationExtracted).toBe(0);
  });

  it('calls advanced route and uploads returned base64 image', async () => {
    const context = createContext();
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferReferenceImages: [
          createReferenceImage({
            id: 'ref1',
            name: 'ref.png',
            dataUrl: 'data:image/png;base64,QUJDRA==',
            addedAt: 1,
          }),
        ],
        vibeTransferReferenceStrength: 0.6,
        vibeTransferInformationExtracted: 1,
      })
    );

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
        json: async () => ({path: '/user/images/Alice/test.png'}),
      });
    vi.stubGlobal('fetch', fetchMock);

    const path = await generateNovelAiVibeTransferImage(
      '1girl',
      context,
      config
    );

    expect(path).toBe('/user/images/Alice/test.png');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/plugins/auto-illustrator-nai-advanced/generate-image'
    );
    expect(fetchMock.mock.calls[2][0]).toBe('/api/images/upload');
  });
});
