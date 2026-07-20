import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  migrateVibeLibraryItemsToBackend,
  migrateVibeSourcesToBackend,
  needsVibeSourceMigration,
} from './vibe_source_migration';
import {VibeSourceBackendUnavailableError} from './vibe_source_client';

vi.mock('../logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const saveSettings = vi.fn();
vi.mock('../settings', () => ({
  saveSettings: (...args: unknown[]) => saveSettings(...args),
}));

const storeVibeSources = vi.fn();
vi.mock('./vibe_source_client', async () => {
  const actual = await vi.importActual<typeof import('./vibe_source_client')>(
    './vibe_source_client'
  );
  return {
    ...actual,
    storeVibeSources: (...args: unknown[]) => storeVibeSources(...args),
  };
});

function createContext(): SillyTavernContext {
  return {} as unknown as SillyTavernContext;
}

function createSettings(
  partial: Partial<AutoIllustratorSettings>
): AutoIllustratorSettings {
  return partial as unknown as AutoIllustratorSettings;
}

const INLINE_A = 'data:image/jpeg;base64,AAAAA';
const INLINE_B = 'data:image/jpeg;base64,BBBBB';

afterEach(() => {
  vi.clearAllMocks();
});

describe('needsVibeSourceMigration', () => {
  it('is true when a library item still has inline source base64', () => {
    const settings = createSettings({
      vibeTransferLibraryItems: [
        {
          id: 'i1',
          name: 'one',
          enabled: true,
          tags: [],
          createdAt: 1,
          updatedAt: 1,
          source: {dataUrl: INLINE_A},
          encodings: {},
        },
      ],
    });
    expect(needsVibeSourceMigration(settings)).toBe(true);
  });

  it('is false when every entry already has a hash', () => {
    const settings = createSettings({
      vibeTransferLibraryItems: [
        {
          id: 'i1',
          name: 'one',
          enabled: true,
          tags: [],
          createdAt: 1,
          updatedAt: 1,
          source: {hash: 'deadbeef', mimeType: 'image/jpeg'},
          encodings: {},
        },
      ],
      vibeTransferReferenceImages: [
        {
          id: 'r1',
          name: 'ref',
          dataUrl: '',
          sourceHash: 'deadbeef',
          tags: [],
          enabled: true,
          addedAt: 1,
        },
      ],
    });
    expect(needsVibeSourceMigration(settings)).toBe(false);
  });
});

describe('migrateVibeSourcesToBackend', () => {
  it('uploads distinct images once and rewrites entries to hash references', async () => {
    // Same inline image shared across library item + legacy reference.
    storeVibeSources.mockResolvedValueOnce(['hash-a', 'hash-b']);

    const settings = createSettings({
      vibeTransferLibraryItems: [
        {
          id: 'i1',
          name: 'one',
          enabled: true,
          tags: [],
          createdAt: 1,
          updatedAt: 1,
          source: {dataUrl: INLINE_A, fingerprint: 'fpA'},
          previewImage: INLINE_A,
          encodings: {},
        },
        {
          id: 'i2',
          name: 'two',
          enabled: true,
          tags: [],
          createdAt: 1,
          updatedAt: 1,
          source: {dataUrl: INLINE_B},
          encodings: {},
        },
      ],
      vibeTransferReferenceImages: [
        {
          id: 'r1',
          name: 'ref',
          dataUrl: INLINE_A,
          tags: [],
          enabled: true,
          addedAt: 1,
        },
      ],
    });

    const result = await migrateVibeSourcesToBackend(settings, createContext());

    // Two distinct images uploaded (INLINE_A, INLINE_B), deduplicated.
    expect(storeVibeSources).toHaveBeenCalledTimes(1);
    const uploaded = storeVibeSources.mock.calls[0][0] as string[];
    expect(new Set(uploaded)).toEqual(new Set([INLINE_A, INLINE_B]));

    // Library item 1 -> hash for A, inline base64 gone, fingerprint preserved.
    const item1 = settings.vibeTransferLibraryItems![0];
    expect(item1.source?.hash).toBeTruthy();
    expect(item1.source?.dataUrl).toBeUndefined();
    expect(item1.previewImage).toBeUndefined();
    expect(item1.source?.fingerprint).toBe('fpA');

    // Legacy reference sharing image A got the same hash.
    const ref1 = settings.vibeTransferReferenceImages![0];
    expect(ref1.sourceHash).toBe(item1.source?.hash);
    expect(ref1.dataUrl).toBe('');

    expect(result.migrated).toBe(3);
    expect(result.skipped).toBe(false);
    expect(saveSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps inline data and skips when the backend is unavailable', async () => {
    storeVibeSources.mockRejectedValueOnce(
      new VibeSourceBackendUnavailableError()
    );

    const settings = createSettings({
      vibeTransferLibraryItems: [
        {
          id: 'i1',
          name: 'one',
          enabled: true,
          tags: [],
          createdAt: 1,
          updatedAt: 1,
          source: {dataUrl: INLINE_A},
          encodings: {},
        },
      ],
    });

    const result = await migrateVibeSourcesToBackend(settings, createContext());

    expect(result.skipped).toBe(true);
    expect(result.migrated).toBe(0);
    // Inline data untouched.
    expect(settings.vibeTransferLibraryItems![0].source?.dataUrl).toBe(
      INLINE_A
    );
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('no-ops when there is nothing to migrate', async () => {
    const settings = createSettings({vibeTransferLibraryItems: []});
    const result = await migrateVibeSourcesToBackend(settings, createContext());
    expect(result).toEqual({migrated: 0, skipped: false});
    expect(storeVibeSources).not.toHaveBeenCalled();
  });
});

describe('migrateVibeLibraryItemsToBackend', () => {
  it('stores an imported source before save and preserves a distinct thumbnail', async () => {
    storeVibeSources.mockResolvedValueOnce(['source-hash']);
    const items = [
      {
        id: 'image-vibe',
        name: 'Image Vibe',
        enabled: true,
        tags: [],
        createdAt: 1,
        updatedAt: 1,
        source: {dataUrl: INLINE_A, fingerprint: 'source-fingerprint'},
        previewImage: INLINE_B,
        encodings: {},
      },
    ];

    const result = await migrateVibeLibraryItemsToBackend(items);

    expect(storeVibeSources).toHaveBeenCalledWith([INLINE_A]);
    expect(result).toMatchObject({migrated: 1, skipped: false});
    expect(result.items[0]).toMatchObject({
      source: {hash: 'source-hash', fingerprint: 'source-fingerprint'},
      previewImage: INLINE_B,
    });
    expect(result.items[0].source?.dataUrl).toBeUndefined();
  });

  it('keeps imported inline source data when storage fails', async () => {
    storeVibeSources.mockRejectedValueOnce(new Error('offline'));
    const items = [
      {
        id: 'image-vibe',
        name: 'Image Vibe',
        enabled: true,
        tags: [],
        createdAt: 1,
        updatedAt: 1,
        source: {dataUrl: INLINE_A},
        encodings: {},
      },
    ];

    const result = await migrateVibeLibraryItemsToBackend(items);

    expect(result).toMatchObject({migrated: 0, skipped: true});
    expect(result.items[0].source?.dataUrl).toBe(INLINE_A);
  });
});
