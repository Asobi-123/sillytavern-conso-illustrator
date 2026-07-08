import {describe, expect, it} from 'vitest';
import {
  exportVibeBundle,
  findVibeEncodingForModel,
  getVibeBundleDisplayName,
  legacyReferenceToVibeLibraryItem,
  modelToVibeBundleKey,
  nameImportedVibeBundleItems,
  parseVibeBundleJson,
  vibeBundleKeyToModel,
} from './vibe_bundle';
import type {VibeLibraryItem, VibeTransferReferenceImage} from '../types';

function createBundleText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    identifier: 'novelai-vibe-transfer-bundle',
    version: 1,
    vibes: [
      {
        identifier: 'novelai-vibe-transfer',
        version: 1,
        type: 'encoding',
        id: 'external-1',
        encodings: {
          'v4-5full': {
            unknown: {
              encoding: 'ENCODED',
              params: {information_extracted: 0.7},
            },
          },
        },
        name: 'Oil tone',
        createdAt: 1780285203192,
        importInfo: {
          model: 'nai-diffusion-4-5-full',
          information_extracted: 0.7,
          strength: 0.45,
        },
        ...overrides,
      },
    ],
  });
}

describe('vibe_bundle service', () => {
  it('parses a standard bundle into encoded-first library items', () => {
    const result = parseVibeBundleJson(createBundleText(), {
      now: 2000,
      sourceName: 'sample.naiv4vibebundle.json',
    });

    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'external-1',
      name: 'Oil tone',
      enabled: true,
      createdAt: 1780285203192,
      updatedAt: 2000,
      encodings: {
        'v4-5full': {
          unknown: {
            encoding: 'ENCODED',
            params: {information_extracted: 0.7},
          },
        },
      },
      importInfo: {
        model: 'nai-diffusion-4-5-full',
        information_extracted: 0.7,
        strength: 0.45,
        sourceName: 'sample.naiv4vibebundle.json',
        importedAt: 2000,
      },
      generation: {
        inheritGlobalStrength: false,
        strength: 0.45,
        inheritGlobalInformationExtracted: false,
        information_extracted: 0.7,
      },
    });
  });

  it('reports malformed JSON and invalid top-level bundle fields', () => {
    expect(parseVibeBundleJson('{bad').errors).toEqual(['bundle.invalidJson']);

    const result = parseVibeBundleJson(
      JSON.stringify({identifier: 'wrong', version: 2, vibes: {}})
    );
    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([
      'bundle.invalidIdentifier',
      'bundle.invalidVersion',
      'bundle.invalidVibes',
    ]);
  });

  it('rejects malformed vibe entries without throwing', () => {
    const result = parseVibeBundleJson(
      JSON.stringify({
        identifier: 'novelai-vibe-transfer-bundle',
        version: 1,
        vibes: [
          {identifier: 'wrong'},
          {
            identifier: 'novelai-vibe-transfer',
            version: 1,
            type: 'image',
            encodings: {},
          },
          {
            identifier: 'novelai-vibe-transfer',
            version: 1,
            type: 'encoding',
            encodings: {'v4-5full': {unknown: {encoding: ''}}},
          },
        ],
      })
    );

    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([
      'vibe.0.invalidIdentifier',
      'vibe.1.invalidType',
      'vibe.2.missingEncoding',
    ]);
  });

  it('preserves unknown model keys and remaps colliding external ids', () => {
    const result = parseVibeBundleJson(
      createBundleText({
        encodings: {
          experimental: {
            custom: {
              encoding: 'UNKNOWN-MODEL-ENCODING',
              params: {information_extracted: 2},
            },
          },
        },
      }),
      {existingIds: ['external-1'], now: 3000}
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).not.toBe('external-1');
    expect(result.items[0].externalId).toBe('external-1');
    expect(result.items[0].encodings.experimental.custom).toEqual({
      encoding: 'UNKNOWN-MODEL-ENCODING',
      params: {information_extracted: 1},
    });
  });

  it('derives readable imported names from bundle filenames for generated names', () => {
    const result = parseVibeBundleJson(
      createBundleText({
        id: 'f9eeea9c63a3b0a9de865f0bb7b4193a9015266ec0137fdbeb77b8e769d74c42',
        name: 'd66224-105354',
      }),
      {
        now: 3000,
        sourceName: 'oil-tone.naiv4vibebundle.json',
      }
    );

    expect(getVibeBundleDisplayName('oil-tone.naiv4vibebundle.json')).toBe(
      'oil-tone'
    );
    expect(
      nameImportedVibeBundleItems(result.items, 'oil-tone').map(
        item => item.name
      )
    ).toEqual(['oil-tone']);
  });

  it('preserves meaningful imported names when bundle items already have them', () => {
    const result = parseVibeBundleJson(
      createBundleText({name: 'Painterly Warm Light'}),
      {now: 3000}
    );

    expect(
      nameImportedVibeBundleItems(result.items, 'oil').map(item => item.name)
    ).toEqual(['Painterly Warm Light']);
  });

  it('exports only standard bundle fields for items with encodings', () => {
    const items: VibeLibraryItem[] = [
      {
        id: 'local-1',
        externalId: 'external-1',
        name: 'Exported',
        enabled: true,
        tags: ['local'],
        createdAt: 1,
        updatedAt: 2,
        previewImage: 'data:image/png;base64,AAAA',
        source: {dataUrl: 'data:image/png;base64,AAAA'},
        encodings: {
          'v4-5full': {
            unknown: {
              encoding: 'ENCODED',
              params: {information_extracted: 0.5},
            },
          },
        },
        importInfo: {model: 'nai-diffusion-4-5-full'},
        generation: {strength: 0.6, information_extracted: 0.5},
      },
      {
        id: 'missing-encoding',
        name: 'Skipped',
        enabled: true,
        tags: [],
        createdAt: 1,
        updatedAt: 1,
        encodings: {},
      },
      {
        id: 'disabled',
        name: 'Disabled',
        enabled: false,
        tags: [],
        createdAt: 1,
        updatedAt: 1,
        encodings: {
          'v4-5full': {
            unknown: {
              encoding: 'DISABLED',
              params: {information_extracted: 0.8},
            },
          },
        },
      },
    ];

    const result = exportVibeBundle(items);

    expect(result.skipped.map(item => item.id)).toEqual(['missing-encoding']);
    expect(result.bundle).toEqual({
      identifier: 'novelai-vibe-transfer-bundle',
      version: 1,
      vibes: [
        {
          identifier: 'novelai-vibe-transfer',
          version: 1,
          type: 'encoding',
          id: 'external-1',
          name: 'Exported',
          createdAt: 1,
          encodings: {
            'v4-5full': {
              unknown: {
                encoding: 'ENCODED',
                params: {information_extracted: 0.5},
              },
            },
          },
          importInfo: {
            model: 'nai-diffusion-4-5-full',
            information_extracted: 0.5,
            strength: 0.6,
          },
        },
      ],
    });
  });

  it('maps legacy references and model keys', () => {
    const reference: VibeTransferReferenceImage = {
      id: 'ref1',
      name: 'ref.png',
      dataUrl: 'data:image/png;base64,QUJDRA==',
      tags: [' style ', 'style'],
      enabled: true,
      encodedVibes: [
        {
          model: 'nai-diffusion-4-5-full',
          informationExtracted: 0.7,
          sourceFingerprint: 'old',
          encoded: 'ENCODED',
          createdAt: 2,
        },
      ],
      addedAt: 1,
    };

    const item = legacyReferenceToVibeLibraryItem(reference, {
      now: 3,
      defaultStrength: 0.4,
      defaultInformationExtracted: 0.7,
    });

    expect(modelToVibeBundleKey('nai-diffusion-4-5-full')).toBe('v4-5full');
    expect(vibeBundleKeyToModel('v4-5full')).toBe('nai-diffusion-4-5-full');
    expect(item.encodings['v4-5full'].unknown.encoding).toBe('ENCODED');
    expect(item.tags).toEqual(['style']);
    expect(item.source?.fingerprint).toBeTruthy();
    expect(findVibeEncodingForModel(item, 'nai-diffusion-4-5-full')).toEqual({
      encoding: 'ENCODED',
      params: {information_extracted: 0.7},
      createdAt: 2,
    });
  });

  it('maps migrated legacy references without restoring inline source data', () => {
    const reference: VibeTransferReferenceImage = {
      id: 'ref1',
      name: 'ref.png',
      dataUrl: '',
      sourceHash:
        'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      sourceMimeType: 'image/jpeg',
      tags: [],
      enabled: true,
      addedAt: 1,
    };

    const item = legacyReferenceToVibeLibraryItem(reference, {
      now: 3,
      defaultStrength: 0.4,
      defaultInformationExtracted: 0.7,
    });

    expect(item.source).toMatchObject({
      hash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      mimeType: 'image/jpeg',
    });
    expect(item.source?.dataUrl).toBeUndefined();
    expect(item.previewImage).toBeUndefined();
  });
});
