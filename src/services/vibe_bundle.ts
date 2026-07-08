import type {
  VibeBundleEncodingVariant,
  VibeBundleEncodings,
  VibeLibraryItem,
  VibeTransferEncodedCache,
  VibeTransferReferenceImage,
} from '../types';
import {VIBE_TRANSFER} from '../constants';
import {
  clamp01,
  fingerprintString,
  normalizeBase64Image,
} from './novelai_common';

export const VIBE_BUNDLE_IDENTIFIER = 'novelai-vibe-transfer-bundle';
export const VIBE_BUNDLE_VERSION = 1;
export const VIBE_ITEM_IDENTIFIER = 'novelai-vibe-transfer';
export const VIBE_ITEM_VERSION = 1;
export const VIBE_ITEM_TYPE = 'encoding';
export const VIBE_BUNDLE_DEFAULT_ENCODING_SLOT = 'unknown';

const MODEL_TO_BUNDLE_KEY: Record<string, string> = {
  'nai-diffusion-4-5-full': 'v4-5full',
  'nai-diffusion-4-5-curated': 'v4-5curated',
  'nai-diffusion-4-full': 'v4full',
  'nai-diffusion-4-curated-preview': 'v4curated',
};

const BUNDLE_KEY_TO_MODEL = Object.entries(MODEL_TO_BUNDLE_KEY).reduce<
  Record<string, string>
>((acc, [model, key]) => {
  acc[key] = model;
  return acc;
}, {});

type RawBundle = {
  identifier?: unknown;
  version?: unknown;
  vibes?: unknown;
};

type RawBundleVibe = {
  identifier?: unknown;
  version?: unknown;
  type?: unknown;
  id?: unknown;
  encodings?: unknown;
  name?: unknown;
  createdAt?: unknown;
  importInfo?: unknown;
};

export type ParseVibeBundleResult = {
  items: VibeLibraryItem[];
  errors: string[];
};

export type ExportVibeBundleResult = {
  bundle: StandardVibeBundle;
  skipped: VibeLibraryItem[];
};

export type StandardVibeBundle = {
  identifier: typeof VIBE_BUNDLE_IDENTIFIER;
  version: typeof VIBE_BUNDLE_VERSION;
  vibes: StandardVibeBundleItem[];
};

export type StandardVibeBundleItem = {
  identifier: typeof VIBE_ITEM_IDENTIFIER;
  version: typeof VIBE_ITEM_VERSION;
  type: typeof VIBE_ITEM_TYPE;
  id: string;
  encodings: VibeBundleEncodings;
  name: string;
  createdAt: number;
  importInfo?: {
    model?: string;
    information_extracted?: number;
    strength?: number;
  };
};

export function modelToVibeBundleKey(model: string): string {
  return MODEL_TO_BUNDLE_KEY[model] ?? model;
}

export function vibeBundleKeyToModel(key: string): string {
  return BUNDLE_KEY_TO_MODEL[key] ?? key;
}

export function createLocalVibeId(prefix = 'vibe'): string {
  const cryptoLike = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoLike?.randomUUID === 'function') {
    return `${prefix}_${cryptoLike.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function getVibeBundleDisplayName(sourceName = ''): string {
  const fileName = normalizeString(sourceName.split(/[\\/]/).pop());
  const displayName = fileName
    .replace(/\.naiv4vibebundle\.json$/i, '')
    .replace(/\.json$/i, '')
    .trim();
  return displayName || 'Vibe bundle';
}

function isGeneratedBundleItemName(name: string, externalId?: string): boolean {
  const trimmed = normalizeString(name);
  if (!trimmed) return true;
  if (externalId && trimmed === externalId) return true;
  return (
    /^vibe\s+\d+$/i.test(trimmed) ||
    /^[a-f0-9]{4,12}[-_][a-f0-9]{4,12}$/i.test(trimmed) ||
    /^[a-f0-9]{24,}$/i.test(trimmed) ||
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      trimmed
    )
  );
}

export function nameImportedVibeBundleItems(
  items: VibeLibraryItem[],
  bundleName: string
): VibeLibraryItem[] {
  const displayName = normalizeString(bundleName) || 'Vibe bundle';
  return items.map((item, index) => {
    if (!isGeneratedBundleItemName(item.name, item.externalId ?? item.id)) {
      return item;
    }
    return {
      ...item,
      name: items.length === 1 ? displayName : `${displayName} ${index + 1}`,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeFiniteNumber(value: unknown): number | undefined {
  const numeric =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  const numeric = normalizeFiniteNumber(value);
  return numeric !== undefined && numeric > 0 ? numeric : fallback;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((tag): tag is string => typeof tag === 'string')
        .map(tag => tag.trim())
        .filter(Boolean)
    ),
  ];
}

function normalizeImportInfo(
  value: unknown
): VibeLibraryItem['importInfo'] | undefined {
  if (!isRecord(value)) return undefined;

  const model = normalizeString(value.model);
  const information = normalizeFiniteNumber(value.information_extracted);
  const strength = normalizeFiniteNumber(value.strength);
  const importInfo: NonNullable<VibeLibraryItem['importInfo']> = {};

  if (model) importInfo.model = model;
  if (information !== undefined) {
    importInfo.information_extracted = clamp01(information, information);
  }
  if (strength !== undefined) {
    importInfo.strength = clamp01(strength, strength);
  }

  return Object.keys(importInfo).length > 0 ? importInfo : undefined;
}

function normalizeEncodingVariant(
  value: unknown
): VibeBundleEncodingVariant | null {
  if (!isRecord(value)) return null;
  const encoding = normalizeString(value.encoding);
  if (!encoding) return null;

  const rawParams = isRecord(value.params) ? value.params : {};
  const information = normalizeFiniteNumber(rawParams.information_extracted);
  const createdAt = normalizeFiniteNumber(value.createdAt);
  const params =
    information !== undefined
      ? {information_extracted: clamp01(information, information)}
      : undefined;

  return {
    encoding,
    ...(params ? {params} : {}),
    ...(createdAt !== undefined && createdAt > 0 ? {createdAt} : {}),
  };
}

export function normalizeVibeEncodings(value: unknown): VibeBundleEncodings {
  if (!isRecord(value)) return {};
  const result: VibeBundleEncodings = {};

  for (const [rawModelKey, rawSlots] of Object.entries(value)) {
    const modelKey = rawModelKey.trim();
    if (!modelKey || !isRecord(rawSlots)) continue;

    const slotResult: Record<string, VibeBundleEncodingVariant> = {};
    for (const [rawSlotKey, rawVariant] of Object.entries(rawSlots)) {
      const slotKey = rawSlotKey.trim();
      const variant = normalizeEncodingVariant(rawVariant);
      if (slotKey && variant) {
        slotResult[slotKey] = variant;
      }
    }

    if (Object.keys(slotResult).length > 0) {
      result[modelKey] = slotResult;
    }
  }

  return result;
}

export function hasUsableVibeEncoding(item: VibeLibraryItem): boolean {
  return Object.values(item.encodings).some(slots =>
    Object.values(slots).some(variant => variant.encoding.trim().length > 0)
  );
}

export function findVibeEncodingForModel(
  item: VibeLibraryItem,
  model: string
): VibeBundleEncodingVariant | null {
  const preferredKeys = [
    modelToVibeBundleKey(model),
    model,
    item.importInfo?.model ? modelToVibeBundleKey(item.importInfo.model) : '',
    item.importInfo?.model ?? '',
  ].filter(Boolean);

  for (const key of preferredKeys) {
    const slots = item.encodings[key];
    if (!slots) continue;
    const preferred = slots[VIBE_BUNDLE_DEFAULT_ENCODING_SLOT];
    if (preferred?.encoding) return preferred;
    const first = Object.values(slots).find(variant => variant.encoding);
    if (first) return first;
  }

  return null;
}

export function findVibeEncodingForModelAndInformation(
  item: VibeLibraryItem,
  model: string,
  informationExtracted: number
): VibeBundleEncodingVariant | null {
  const preferredKeys = [
    modelToVibeBundleKey(model),
    model,
    item.importInfo?.model ? modelToVibeBundleKey(item.importInfo.model) : '',
    item.importInfo?.model ?? '',
  ].filter(Boolean);

  for (const key of preferredKeys) {
    const slots = item.encodings[key];
    if (!slots) continue;
    const matching = Object.values(slots).find(
      variant =>
        variant.encoding &&
        typeof variant.params?.information_extracted === 'number' &&
        Math.abs(variant.params.information_extracted - informationExtracted) <
          0.000001
    );
    if (matching) return matching;
  }

  return null;
}

export function parseVibeBundleJson(
  jsonText: string,
  options: {
    existingIds?: Iterable<string>;
    sourceName?: string;
    now?: number;
  } = {}
): ParseVibeBundleResult {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {items: [], errors: ['bundle.invalidJson']};
  }

  if (!isRecord(parsed)) {
    return {items: [], errors: ['bundle.invalidRoot']};
  }

  const bundle = parsed as RawBundle;
  if (bundle.identifier !== VIBE_BUNDLE_IDENTIFIER) {
    errors.push('bundle.invalidIdentifier');
  }
  if (bundle.version !== VIBE_BUNDLE_VERSION) {
    errors.push('bundle.invalidVersion');
  }
  if (!Array.isArray(bundle.vibes)) {
    errors.push('bundle.invalidVibes');
  }
  if (errors.length > 0 || !Array.isArray(bundle.vibes)) {
    return {items: [], errors};
  }

  const usedIds = new Set(options.existingIds ?? []);
  const now = options.now ?? Date.now();
  const items: VibeLibraryItem[] = [];

  bundle.vibes.forEach((value, index) => {
    if (!isRecord(value)) {
      errors.push(`vibe.${index}.invalid`);
      return;
    }

    const raw = value as RawBundleVibe;
    if (raw.identifier !== VIBE_ITEM_IDENTIFIER) {
      errors.push(`vibe.${index}.invalidIdentifier`);
      return;
    }
    if (raw.version !== VIBE_ITEM_VERSION) {
      errors.push(`vibe.${index}.invalidVersion`);
      return;
    }
    if (raw.type !== VIBE_ITEM_TYPE) {
      errors.push(`vibe.${index}.invalidType`);
      return;
    }

    const encodings = normalizeVibeEncodings(raw.encodings);
    if (Object.keys(encodings).length === 0) {
      errors.push(`vibe.${index}.missingEncoding`);
      return;
    }

    const externalId = normalizeString(raw.id) || createLocalVibeId('external');
    let localId = externalId;
    if (usedIds.has(localId)) {
      localId = createLocalVibeId('vibe_import');
    }
    usedIds.add(localId);

    const createdAt = normalizeTimestamp(raw.createdAt, now);
    const importInfo = normalizeImportInfo(raw.importInfo);
    items.push({
      id: localId,
      ...(localId !== externalId ? {externalId} : {}),
      name: normalizeString(raw.name) || `Vibe ${items.length + 1}`,
      enabled: true,
      tags: [],
      createdAt,
      updatedAt: now,
      encodings,
      ...(importInfo || localId !== externalId || options.sourceName
        ? {
            importInfo: {
              ...(importInfo ?? {}),
              ...(localId !== externalId ? {externalId} : {}),
              ...(options.sourceName ? {sourceName: options.sourceName} : {}),
              importedAt: now,
            },
          }
        : {}),
      generation:
        importInfo?.strength !== undefined ||
        importInfo?.information_extracted !== undefined
          ? {
              inheritGlobalStrength: false,
              strength:
                importInfo.strength ?? VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH,
              inheritGlobalInformationExtracted: false,
              information_extracted:
                importInfo.information_extracted ??
                VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED,
            }
          : undefined,
    });
  });

  return {items, errors};
}

export function exportVibeBundle(
  items: VibeLibraryItem[]
): ExportVibeBundleResult {
  const vibes: StandardVibeBundleItem[] = [];
  const skipped: VibeLibraryItem[] = [];

  for (const item of items) {
    if (item.enabled === false) continue;

    const encodings = normalizeVibeEncodings(item.encodings);
    if (Object.keys(encodings).length === 0) {
      skipped.push(item);
      continue;
    }

    const importInfo: StandardVibeBundleItem['importInfo'] = {};
    if (item.importInfo?.model) importInfo.model = item.importInfo.model;
    const information =
      item.generation?.information_extracted ??
      item.importInfo?.information_extracted;
    const strength = item.generation?.strength ?? item.importInfo?.strength;
    if (typeof information === 'number' && Number.isFinite(information)) {
      importInfo.information_extracted = clamp01(information, information);
    }
    if (typeof strength === 'number' && Number.isFinite(strength)) {
      importInfo.strength = clamp01(strength, strength);
    }

    vibes.push({
      identifier: VIBE_ITEM_IDENTIFIER,
      version: VIBE_ITEM_VERSION,
      type: VIBE_ITEM_TYPE,
      id: item.externalId ?? item.importInfo?.externalId ?? item.id,
      encodings,
      name: item.name,
      createdAt: item.createdAt,
      ...(Object.keys(importInfo).length > 0 ? {importInfo} : {}),
    });
  }

  return {
    bundle: {
      identifier: VIBE_BUNDLE_IDENTIFIER,
      version: VIBE_BUNDLE_VERSION,
      vibes,
    },
    skipped,
  };
}

export function legacyReferenceToVibeLibraryItem(
  reference: VibeTransferReferenceImage,
  options: {
    now?: number;
    defaultStrength?: number;
    defaultInformationExtracted?: number;
  } = {}
): VibeLibraryItem {
  const now = options.now ?? Date.now();
  const normalizedSource = normalizeBase64Image(reference.dataUrl);
  const encodings: VibeBundleEncodings = {};

  const caches = Array.isArray(reference.encodedVibes)
    ? reference.encodedVibes
    : [];
  caches.forEach((cache: VibeTransferEncodedCache) => {
    const modelKey = modelToVibeBundleKey(cache.model);
    if (!encodings[modelKey]) encodings[modelKey] = {};
    encodings[modelKey][VIBE_BUNDLE_DEFAULT_ENCODING_SLOT] = {
      encoding: cache.encoded,
      params: {
        information_extracted: clamp01(
          cache.informationExtracted,
          options.defaultInformationExtracted ?? 1
        ),
      },
      createdAt: cache.createdAt,
    };
  });

  return {
    id: reference.id,
    name: reference.name,
    enabled: reference.enabled !== false,
    tags: normalizeTags(reference.tags),
    createdAt: reference.addedAt,
    updatedAt: now,
    source: {
      ...(reference.dataUrl ? {dataUrl: reference.dataUrl} : {}),
      ...(reference.sourceHash ? {hash: reference.sourceHash} : {}),
      ...(normalizedSource
        ? {fingerprint: fingerprintString(normalizedSource)}
        : {}),
      mimeType:
        reference.sourceMimeType ??
        reference.dataUrl.match(/^data:([^;,]+)/)?.[1],
    },
    ...(reference.dataUrl ? {previewImage: reference.dataUrl} : {}),
    encodings,
    generation: {
      inheritGlobalStrength: false,
      strength: options.defaultStrength,
      inheritGlobalInformationExtracted: false,
      information_extracted: options.defaultInformationExtracted,
    },
    legacyReferenceId: reference.id,
  };
}
