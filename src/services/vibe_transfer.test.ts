import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  buildNovelAiAdvancedPayload,
  buildVibeCombinationRandomConfigFromSettings,
  buildVibeTransferConfigFromSettings,
  generateNovelAiVibeTransferImage,
  mergeVibeTransferLibraryItemUpdates,
  mergeVibeTransferReferenceUpdates,
  pickRandomVibeCombinationConfig,
  shouldUseVibeTransfer,
} from './vibe_transfer';
import {clearCsrfTokenCache} from '../utils/api';
import type {VibeLibraryItem, VibeTransferReferenceImage} from '../types';

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

function createLibraryItem(
  partial: Partial<VibeLibraryItem> & Pick<VibeLibraryItem, 'id' | 'name'>
): VibeLibraryItem {
  return {
    enabled: true,
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    encodings: {},
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

  it('sends source hashes for migrated image-backed library items', () => {
    const context = createContext();
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferLibraryItems: [
          createLibraryItem({
            id: 'image1',
            name: 'Migrated Image Vibe',
            source: {
              hash: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
              fingerprint: 'source-fp',
              mimeType: 'image/jpeg',
            },
            generation: {
              inheritGlobalInformationExtracted: false,
              information_extracted: 0.9,
            },
          }),
        ],
        vibeTransferReferenceStrength: 0.75,
        vibeTransferInformationExtracted: 0.35,
      })
    );

    const payload = buildNovelAiAdvancedPayload('1girl', context, config);

    expect(payload.reference_image_ids).toEqual(['image1']);
    expect(payload.reference_image_multiple).toEqual(['']);
    expect(payload.reference_source_hash_multiple).toEqual([
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    ]);
    expect(payload.reference_source_fingerprint_multiple).toEqual([
      'source-fp',
    ]);
    expect(payload.reference_encoded_vibe_multiple).toEqual([null]);
    expect(payload.reference_information_extracted_multiple).toEqual([0.9]);
  });

  it('uses encoded-only Vibe library items without source images', () => {
    const context = createContext();
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferLibraryItems: [
          createLibraryItem({
            id: 'bundle1',
            name: 'Bundle Vibe',
            encodings: {
              'v4-5full': {
                unknown: {
                  encoding: 'BUNDLE-ENCODED',
                  params: {information_extracted: 0.7},
                },
              },
            },
            importInfo: {
              model: 'nai-diffusion-4-5-full',
              information_extracted: 0.7,
              strength: 0.45,
            },
          }),
        ],
        vibeTransferReferenceStrength: 0.75,
        vibeTransferInformationExtracted: 0.35,
      })
    );

    const payload = buildNovelAiAdvancedPayload('1girl', context, config);

    expect(shouldUseVibeTransfer(config)).toBe(true);
    expect(payload.reference_image_ids).toEqual(['bundle1']);
    expect(payload.reference_image_multiple).toEqual(['']);
    expect(payload.reference_encoded_vibe_multiple).toEqual(['BUNDLE-ENCODED']);
    expect(payload.reference_source_fingerprint_multiple).toEqual(['']);
    expect(payload.reference_strength_multiple).toEqual([0.45]);
    expect(payload.reference_information_extracted_multiple).toEqual([0.7]);
  });

  it('does not reuse source-image encodings with a different information value', () => {
    const context = createContext();
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferLibraryItems: [
          createLibraryItem({
            id: 'image1',
            name: 'Image Vibe',
            source: {dataUrl: 'data:image/png;base64,QUJDRA=='},
            encodings: {
              'v4-5full': {
                unknown: {
                  encoding: 'OLD-ENCODED',
                  params: {information_extracted: 0.35},
                },
              },
            },
            generation: {
              inheritGlobalInformationExtracted: false,
              information_extracted: 0.9,
            },
          }),
        ],
        vibeTransferReferenceStrength: 0.75,
        vibeTransferInformationExtracted: 0.35,
      })
    );

    const payload = buildNovelAiAdvancedPayload('1girl', context, config);

    expect(payload.reference_image_multiple).toEqual(['QUJDRA==']);
    expect(payload.reference_encoded_vibe_multiple).toEqual([null]);
    expect(payload.reference_information_extracted_multiple).toEqual([0.9]);
  });

  it('reuses source-image library encodings with the same information value', () => {
    const context = createContext();
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferLibraryItems: [
          createLibraryItem({
            id: 'image1',
            name: 'Image Vibe',
            source: {dataUrl: 'data:image/png;base64,QUJDRA=='},
            encodings: {
              'v4-5full': {
                information_0_900: {
                  encoding: 'MATCHED-ENCODED',
                  params: {information_extracted: 0.9},
                },
              },
            },
            generation: {
              inheritGlobalInformationExtracted: false,
              information_extracted: 0.9,
            },
          }),
        ],
        vibeTransferReferenceStrength: 0.75,
        vibeTransferInformationExtracted: 0.35,
      })
    );

    const payload = buildNovelAiAdvancedPayload('1girl', context, config);

    expect(payload.reference_image_multiple).toEqual(['QUJDRA==']);
    expect(payload.reference_encoded_vibe_multiple).toEqual([
      'MATCHED-ENCODED',
    ]);
    expect(payload.reference_information_extracted_multiple).toEqual([0.9]);
  });

  it('honors saved per-vibe parameters in payloads', () => {
    const context = createContext();
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferLibraryItems: [
          createLibraryItem({
            id: 'image1',
            name: 'Image Vibe',
            source: {dataUrl: 'data:image/png;base64,QUJDRA=='},
            generation: {
              inheritGlobalStrength: false,
              strength: 0.25,
              inheritGlobalInformationExtracted: false,
              information_extracted: 0.8,
            },
          }),
        ],
        vibeTransferReferenceStrength: 0.75,
        vibeTransferInformationExtracted: 0.35,
      })
    );

    const payload = buildNovelAiAdvancedPayload('1girl', context, config);

    expect(payload.reference_strength_multiple).toEqual([0.25]);
    expect(payload.reference_information_extracted_multiple).toEqual([0.8]);
  });

  it('builds aligned arrays for mixed image-backed and encoded-only items', () => {
    const context = createContext();
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferLibraryItems: [
          createLibraryItem({
            id: 'image1',
            name: 'Image Vibe',
            source: {dataUrl: 'data:image/png;base64,QUJDRA=='},
            generation: {
              inheritGlobalStrength: false,
              strength: 0.2,
              inheritGlobalInformationExtracted: false,
              information_extracted: 0.9,
            },
          }),
          createLibraryItem({
            id: 'encoded1',
            name: 'Encoded Vibe',
            encodings: {
              'v4-5full': {
                unknown: {encoding: 'ENCODED-ONLY'},
              },
            },
          }),
          createLibraryItem({
            id: 'unusable',
            name: 'Unusable Vibe',
          }),
        ],
        vibeTransferReferenceStrength: 0.75,
        vibeTransferInformationExtracted: 0.35,
      })
    );

    const payload = buildNovelAiAdvancedPayload('1girl', context, config);

    expect(payload.reference_image_ids).toEqual(['image1', 'encoded1']);
    expect(payload.reference_image_multiple).toEqual(['QUJDRA==', '']);
    expect(payload.reference_encoded_vibe_multiple).toEqual([
      null,
      'ENCODED-ONLY',
    ]);
    expect(payload.reference_strength_multiple).toEqual([0.2, 0.75]);
    expect(payload.reference_information_extracted_multiple).toEqual([
      0.9, 0.35,
    ]);
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

  it('merges updated encoded cache into Vibe library items', () => {
    const merged = mergeVibeTransferLibraryItemUpdates(
      [
        createLibraryItem({
          id: 'item1',
          name: 'Image Vibe',
          source: {dataUrl: 'data:image/png;base64,AAAA'},
        }),
      ],
      [
        createReferenceImage({
          id: 'item1',
          name: 'Image Vibe',
          dataUrl: 'data:image/png;base64,AAAA',
          encodedVibes: [
            {
              model: 'nai-diffusion-4-5-full',
              informationExtracted: 0.8,
              sourceFingerprint: 'abc',
              encoded: 'NEW-ENCODED',
              createdAt: 3,
            },
          ],
          addedAt: 1,
        }),
      ]
    );

    expect(merged[0].encodings['v4-5full'].information_0_800).toEqual({
      encoding: 'NEW-ENCODED',
      params: {information_extracted: 0.8},
      createdAt: 3,
    });
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

  it('builds random Vibe combination config from settings safely', () => {
    expect(
      buildVibeCombinationRandomConfigFromSettings(
        createSettings({
          randomizeVibeCombinationPerGeneration: true,
          vibeCombinationPoolWhitelist: ['combo1'],
        })
      )
    ).toEqual({enabled: true, whitelist: ['combo1']});

    expect(
      buildVibeCombinationRandomConfigFromSettings(
        createSettings({
          randomizeVibeCombinationPerGeneration: true,
          vibeCombinationPoolWhitelist: undefined,
        })
      )
    ).toEqual({enabled: true, whitelist: []});

    expect(
      buildVibeCombinationRandomConfigFromSettings(
        createSettings({
          generationStyleMode: 'fixed',
          fixedVibeCombinationId: 'combo-fixed',
          randomizeVibeCombinationPerGeneration: true,
          vibeCombinationPoolWhitelist: ['combo-random'],
        })
      )
    ).toEqual({enabled: true, whitelist: ['combo-fixed']});

    expect(
      buildVibeCombinationRandomConfigFromSettings(
        createSettings({
          generationStyleMode: 'fixed',
          generationStylePresets: [
            {
              id: 'preset-1',
              name: 'Oil + aaa',
              sdStyleName: 'Style A',
              vibeCombinationId: 'combo-preset',
              createdAt: 1,
              updatedAt: 1,
            },
          ],
          currentGenerationStylePresetId: 'preset-1',
          fixedVibeCombinationId: 'combo-fixed',
        })
      )
    ).toEqual({enabled: true, whitelist: ['combo-preset']});

    expect(
      buildVibeCombinationRandomConfigFromSettings(
        createSettings({
          generationStyleMode: 'off',
          fixedVibeCombinationId: 'combo-fixed',
          randomizeVibeCombinationPerGeneration: true,
          vibeCombinationPoolWhitelist: ['combo-random'],
        })
      )
    ).toEqual({enabled: false, whitelist: []});
  });

  it('picks a whitelisted saved Vibe combination without mutating settings', () => {
    const settings = createSettings({
      vibeTransferEnabled: true,
      vibeTransferReferenceStrength: 0.6,
      vibeTransferInformationExtracted: 0.4,
      vibeTransferLibraryItems: [
        createLibraryItem({
          id: 'item1',
          name: 'Item 1',
          enabled: false,
          generation: {
            inheritGlobalStrength: false,
            strength: 0.3,
            inheritGlobalInformationExtracted: false,
            information_extracted: 0.5,
          },
        }),
        createLibraryItem({
          id: 'item2',
          name: 'Item 2',
          enabled: false,
        }),
      ],
      vibeTransferCombinations: [
        {
          id: 'combo1',
          name: 'Combo 1',
          itemIds: ['item1'],
          itemGenerations: {
            item1: {
              inheritGlobalStrength: false,
              strength: 0.8,
              inheritGlobalInformationExtracted: false,
              information_extracted: 0.9,
            },
          },
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'combo2',
          name: 'Combo 2',
          itemIds: ['item2'],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    const picked = pickRandomVibeCombinationConfig(settings, {
      enabled: true,
      whitelist: ['combo1'],
    });

    expect(picked?.id).toBe('combo1');
    expect(picked?.name).toBe('Combo 1');
    expect(picked?.config.enabled).toBe(true);
    expect(picked?.config.libraryItems).toHaveLength(1);
    expect(picked?.config.libraryItems[0]).toMatchObject({
      id: 'item1',
      enabled: true,
      generation: {
        strength: 0.8,
        information_extracted: 0.9,
      },
    });
    expect(settings.vibeTransferLibraryItems[0].enabled).toBe(false);
  });

  it('returns null when random Vibe combination has no eligible saved set', () => {
    expect(
      pickRandomVibeCombinationConfig(
        createSettings({
          vibeTransferEnabled: true,
          vibeTransferLibraryItems: [
            createLibraryItem({id: 'item1', name: 'Item 1'}),
          ],
          vibeTransferCombinations: [
            {
              id: 'combo1',
              name: 'Combo 1',
              itemIds: ['item1'],
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        }),
        {enabled: true, whitelist: ['deleted']}
      )
    ).toBeNull();

    expect(
      pickRandomVibeCombinationConfig(
        createSettings({
          vibeTransferEnabled: false,
          vibeTransferLibraryItems: [
            createLibraryItem({id: 'item1', name: 'Item 1'}),
          ],
          vibeTransferCombinations: [
            {
              id: 'combo1',
              name: 'Combo 1',
              itemIds: ['item1'],
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        }),
        {enabled: true, whitelist: []}
      )
    ).toBeNull();
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

  it('accepts migrated source-hash-only Vibe references during generation', async () => {
    const context = createContext();
    const sourceHash =
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
    const config = buildVibeTransferConfigFromSettings(
      createSettings({
        vibeTransferEnabled: true,
        vibeTransferLibraryItems: [
          createLibraryItem({
            id: 'image1',
            name: 'Migrated Image Vibe',
            source: {
              hash: sourceHash,
              fingerprint: 'source-fp',
              mimeType: 'image/jpeg',
            },
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

    const requestBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(path).toBe('/user/images/Alice/test.png');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestBody.reference_image_multiple).toEqual(['']);
    expect(requestBody.reference_source_hash_multiple).toEqual([sourceHash]);
    expect(requestBody.reference_encoded_vibe_multiple).toEqual([null]);
  });
});
