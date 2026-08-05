import {describe, expect, it} from 'vitest';
import {
  exportVibeBundle,
  exportVibeSelection,
  findVibeEncodingForModel,
  getVibeBundleDisplayName,
  legacyReferenceToVibeLibraryItem,
  modelToVibeBundleKey,
  nameImportedVibeBundleItems,
  parseVibeBundleJson,
  parseVibeImportJson,
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

function createSingleVibeText(overrides: Record<string, unknown> = {}): string {
  const bundle = JSON.parse(createBundleText(overrides)) as {
    vibes: Array<Record<string, unknown>>;
  };
  return JSON.stringify(bundle.vibes[0]);
}

const PNG_IMAGE = 'iVBORw0KGgo=';
const JPEG_THUMBNAIL = 'data:image/jpeg;base64,/9j/AA==';

function createImageVibeText(overrides: Record<string, unknown> = {}): string {
  return createSingleVibeText({
    type: 'image',
    image: PNG_IMAGE,
    thumbnail: JPEG_THUMBNAIL,
    ...overrides,
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

  it('parses a standard single Vibe file', () => {
    const result = parseVibeImportJson(createSingleVibeText(), {
      now: 2000,
      sourceName: 'oil-tone.naiv4vibe.json',
    });

    expect(result.format).toBe('single');
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'external-1',
      name: 'Oil tone',
      importInfo: {sourceName: 'oil-tone.naiv4vibe.json'},
    });
    expect(getVibeBundleDisplayName('oil-tone.naiv4vibe.json')).toBe(
      'oil-tone'
    );
    expect(getVibeBundleDisplayName('watercolor.naiv4vibe')).toBe('watercolor');
  });

  it('parses a standard image-backed single Vibe file', () => {
    const result = parseVibeImportJson(createImageVibeText(), {
      now: 2000,
      sourceName: 'watercolor.naiv4vibe',
    });

    expect(result.format).toBe('single');
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      source: {
        dataUrl: `data:image/png;base64,${PNG_IMAGE}`,
        mimeType: 'image/png',
      },
      previewImage: JPEG_THUMBNAIL,
      importInfo: {sourceName: 'watercolor.naiv4vibe'},
    });
    expect(result.items[0].source?.fingerprint).toBeTruthy();
  });

  it('parses external Vibe groups and preserves group strength', () => {
    const vibe = JSON.parse(createImageVibeText()) as Record<string, unknown>;
    const result = parseVibeImportJson(
      JSON.stringify({
        groups: {
          'Mystery style': {
            vibes: [{vibeDataId: 'cfg-image-1', strength: 0.46}],
          },
        },
        vibeData: {'cfg-image-1': vibe},
        vibePresets: {},
        presetImages: {},
      }),
      {now: 2000, sourceName: 'vibe-group-mystery.json'}
    );

    expect(result.format).toBe('group');
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].source?.mimeType).toBe('image/png');
    expect(result.groups).toEqual([
      {
        name: 'Mystery style',
        items: [{id: result.items[0].id, strength: 0.46}],
      },
    ]);
  });

  it('uses presetImages when a group Vibe omits its inline image', () => {
    const vibe = JSON.parse(createImageVibeText()) as Record<string, unknown>;
    delete vibe.image;
    const result = parseVibeImportJson(
      JSON.stringify({
        groups: {
          Fallback: {vibes: [{vibeDataId: 'cfg-image-1'}]},
        },
        vibeData: {'cfg-image-1': vibe},
        vibePresets: {
          Fallback: {
            vibeDataId: 'cfg-image-1',
            imageId: 'preset-image-1',
          },
        },
        presetImages: {
          'preset-image-1': `data:image/png;base64,${PNG_IMAGE}`,
        },
      })
    );

    expect(result.errors).toEqual([]);
    expect(result.items[0].source?.dataUrl).toBe(
      `data:image/png;base64,${PNG_IMAGE}`
    );
  });

  it('rejects imports that exceed the defensive item limit', () => {
    const bundle = JSON.parse(createBundleText()) as {
      vibes: Array<Record<string, unknown>>;
    };
    bundle.vibes = Array.from({length: 3}, (_, index) => ({
      ...bundle.vibes[0],
      id: `external-${index}`,
    }));

    const result = parseVibeImportJson(JSON.stringify(bundle), {maxItems: 2});

    expect(result.format).toBe('bundle');
    expect(result.items).toEqual([]);
    expect(result.errors).toEqual(['import.tooManyItems']);
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
      'vibe.1.missingEncoding',
      'vibe.2.missingEncoding',
    ]);
  });

  it('rejects an image-backed Vibe without a usable source image', () => {
    const result = parseVibeImportJson(
      createImageVibeText({image: 'not-base64'})
    );

    expect(result.items).toEqual([]);
    expect(result.errors).toEqual(['vibe.0.missingImage']);
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

  it('exports unique ids when imported items share an external id', () => {
    const bundle = JSON.parse(createBundleText()) as {
      vibes: Array<Record<string, unknown>>;
    };
    bundle.vibes.push({...bundle.vibes[0], name: 'Second'});
    const parsed = parseVibeBundleJson(JSON.stringify(bundle), {now: 3000});

    const exported = exportVibeBundle(parsed.items);
    const exportedIds = exported.bundle.vibes.map(item => item.id);

    expect(exportedIds).toHaveLength(2);
    expect(new Set(exportedIds).size).toBe(2);
    expect(exportedIds[0]).toBe('external-1');
    expect(exportedIds[1]).toBe(parsed.items[1].id);
  });

  it('round-trips a single Vibe through standard bundle export', () => {
    const singleImport = parseVibeImportJson(createSingleVibeText(), {
      now: 2000,
    });
    const exported = exportVibeBundle(singleImport.items);
    const reimported = parseVibeImportJson(JSON.stringify(exported.bundle), {
      now: 3000,
    });

    expect(exported.bundle.vibes).toHaveLength(1);
    expect(reimported.format).toBe('bundle');
    expect(reimported.errors).toEqual([]);
    expect(reimported.items).toHaveLength(1);
    expect(reimported.items[0].encodings).toEqual(
      singleImport.items[0].encodings
    );
  });

  it('exports one selected Vibe without a bundle wrapper', () => {
    const imported = parseVibeImportJson(createSingleVibeText(), {now: 2000});

    const exported = exportVibeSelection(imported.items);

    expect(exported.format).toBe('single');
    if (exported.format !== 'single') return;
    expect(exported.data).toMatchObject({
      identifier: 'novelai-vibe-transfer',
      version: 1,
      type: 'encoding',
      id: 'external-1',
      name: 'Oil tone',
    });
    expect(exported.data).not.toHaveProperty('vibes');
    const reimported = parseVibeImportJson(JSON.stringify(exported.data), {
      now: 3000,
    });
    expect(reimported.format).toBe('single');
    expect(reimported.errors).toEqual([]);
    expect(reimported.items).toHaveLength(1);
  });

  it('round-trips an image-backed Vibe with its source and thumbnail', () => {
    const imported = parseVibeImportJson(createImageVibeText(), {now: 2000});

    const exported = exportVibeSelection(imported.items, {
      includeSourceImages: true,
    });

    expect(exported.format).toBe('single');
    if (exported.format !== 'single') return;
    expect(exported.data).toMatchObject({
      identifier: 'novelai-vibe-transfer',
      version: 1,
      type: 'image',
      image: PNG_IMAGE,
      thumbnail: JPEG_THUMBNAIL,
      encodings: {
        'v4-5full': {
          unknown: {
            encoding: 'ENCODED',
            params: {information_extracted: 0.7},
            createdAt: 1780285203192,
          },
        },
      },
    });
    expect(imported.items[0].encodings['v4-5full'].unknown).not.toHaveProperty(
      'createdAt'
    );
    const reimported = parseVibeImportJson(JSON.stringify(exported.data), {
      now: 3000,
    });
    expect(reimported.errors).toEqual([]);
    expect(reimported.items[0].source?.dataUrl).toBe(
      `data:image/png;base64,${PNG_IMAGE}`
    );
    const reexported = exportVibeSelection(reimported.items, {
      includeSourceImages: true,
    });
    expect(reexported.format).toBe('single');
    if (reexported.format !== 'single') return;
    expect(reexported.data.encodings).toEqual(exported.data.encodings);
  });

  it('exports an image-backed single Vibe as encoding-only when requested', () => {
    const imported = parseVibeImportJson(createImageVibeText(), {now: 2000});

    const exported = exportVibeSelection(imported.items, {
      includeSourceImages: false,
    });

    expect(exported.format).toBe('single');
    expect(exported.data).toMatchObject({
      identifier: 'novelai-vibe-transfer',
      version: 1,
      type: 'encoding',
      id: 'external-1',
    });
    expect(exported.data).not.toHaveProperty('image');
    expect(exported.data).not.toHaveProperty('thumbnail');
    if (exported.format !== 'single') return;
    expect(exported.data.encodings).toEqual(imported.items[0].encodings);
  });

  it('preserves an existing encoding cache timestamp in image exports', () => {
    const imported = parseVibeImportJson(
      createImageVibeText({
        encodings: {
          'v4-5full': {
            unknown: {
              encoding: 'ENCODED',
              params: {information_extracted: 0.7},
              createdAt: 1234,
            },
          },
        },
      }),
      {now: 2000}
    );

    const exported = exportVibeSelection(imported.items, {
      includeSourceImages: true,
    });

    expect(exported.format).toBe('single');
    if (exported.format !== 'single') return;
    expect(exported.data.encodings['v4-5full'].unknown.createdAt).toBe(1234);
  });

  it('exports multiple selected Vibes as one Vibe group', () => {
    const bundle = JSON.parse(createBundleText()) as {
      vibes: Array<Record<string, unknown>>;
    };
    bundle.vibes.push({...bundle.vibes[0], id: 'external-2'});
    const imported = parseVibeBundleJson(JSON.stringify(bundle), {now: 2000});

    const exported = exportVibeSelection(imported.items, {
      groupName: 'Mystery styles',
      now: 3000,
    });

    expect(exported.format).toBe('group');
    if (exported.format !== 'group') return;
    expect(Object.keys(exported.data)).toEqual([
      'groups',
      'vibeData',
      'vibePresets',
      'presetImages',
    ]);
    expect(exported.data.groups).toEqual({
      'Mystery styles': {
        vibes: [
          {vibeDataId: 'cfgimg_1', strength: 0.45},
          {vibeDataId: 'cfgimg_2', strength: 0.45},
        ],
        createdAt: 3000,
        updatedAt: 3000,
      },
    });
    expect(Object.keys(exported.data.vibeData)).toEqual([
      'cfgimg_1',
      'cfgimg_2',
    ]);
    expect(exported.data.presetImages).toEqual({});

    const reimported = parseVibeImportJson(JSON.stringify(exported.data), {
      now: 4000,
    });
    expect(reimported.format).toBe('group');
    expect(reimported.errors).toEqual([]);
    expect(reimported.groups?.[0].name).toBe('Mystery styles');
    expect(reimported.groups?.[0].items.map(item => item.strength)).toEqual([
      0.45, 0.45,
    ]);
  });

  it('keeps image-backed entries inside a multi-Vibe group', () => {
    const imageItem = parseVibeImportJson(createImageVibeText(), {
      now: 2000,
    }).items[0];
    const encodedItem = parseVibeImportJson(
      createSingleVibeText({id: 'external-2'}),
      {now: 2000}
    ).items[0];

    const exported = exportVibeSelection([imageItem, encodedItem], {
      includeSourceImages: true,
      groupName: 'Mixed styles',
      now: 3000,
    });

    expect(exported.format).toBe('group');
    if (exported.format !== 'group') return;
    const vibes = Object.values(exported.data.vibeData);
    expect(vibes.map(vibe => vibe.type)).toEqual(['image', 'encoding']);
    expect(vibes[0]).toMatchObject({
      image: PNG_IMAGE,
      thumbnail: JPEG_THUMBNAIL,
    });
    expect(exported.data.presetImages).toEqual({
      cfgimg_image_1: `data:image/png;base64,${PNG_IMAGE}`,
    });
    expect(Object.values(exported.data.vibePresets)[0]).toMatchObject({
      imageId: 'cfgimg_image_1',
      vibeDataId: 'cfgimg_1',
    });
  });

  it('exports a mixed multi-Vibe group without any source images when disabled', () => {
    const imageItem = parseVibeImportJson(createImageVibeText(), {
      now: 2000,
    }).items[0];
    const encodedItem = parseVibeImportJson(
      createSingleVibeText({id: 'external-2'}),
      {now: 2000}
    ).items[0];

    const exported = exportVibeSelection([imageItem, encodedItem], {
      includeSourceImages: false,
      groupName: 'Encoding styles',
      now: 3000,
    });

    expect(exported.format).toBe('group');
    if (exported.format !== 'group') return;
    const vibes = Object.values(exported.data.vibeData);
    expect(vibes.map(vibe => vibe.type)).toEqual(['encoding', 'encoding']);
    expect(vibes.every(vibe => !('image' in vibe))).toBe(true);
    expect(vibes.every(vibe => !('thumbnail' in vibe))).toBe(true);
    expect(exported.data.presetImages).toEqual({});
    expect(
      Object.values(exported.data.vibePresets).every(
        preset => !('imageId' in preset)
      )
    ).toBe(true);
  });

  it('reports an empty export when no selected Vibe has an encoding', () => {
    const result = exportVibeSelection([
      {
        id: 'no-encoding',
        name: 'No encoding',
        enabled: true,
        tags: [],
        createdAt: 1,
        updatedAt: 1,
        encodings: {},
      },
    ]);

    expect(result).toMatchObject({
      format: 'empty',
      data: undefined,
      skipped: [{id: 'no-encoding'}],
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
