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
export const VIBE_ITEM_ENCODING_TYPE = 'encoding';
export const VIBE_ITEM_IMAGE_TYPE = 'image';
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
  image?: unknown;
  thumbnail?: unknown;
};

type RawVibeGroupRoot = {
  groups?: unknown;
  vibeData?: unknown;
  vibePresets?: unknown;
  presetImages?: unknown;
};

export type ParsedVibeImportGroup = {
  name: string;
  items: Array<{id: string; strength?: number}>;
};

export type ParseVibeBundleResult = {
  items: VibeLibraryItem[];
  errors: string[];
};

export type ParseVibeImportResult = ParseVibeBundleResult & {
  format?: 'bundle' | 'single' | 'group';
  groups?: ParsedVibeImportGroup[];
};

export type ExportVibeBundleResult = {
  bundle: StandardVibeBundle;
  skipped: VibeLibraryItem[];
};

export type ExportVibeSelectionResult =
  | {format: 'empty'; data: undefined; skipped: VibeLibraryItem[]}
  | {format: 'single'; data: StandardVibeBundleItem; skipped: VibeLibraryItem[]}
  | {format: 'group'; data: StandardVibeGroup; skipped: VibeLibraryItem[]};

export type ExportVibeSelectionOptions = {
  includeSourceImages?: boolean;
  groupName?: string;
  now?: number;
};

export type StandardVibeBundle = {
  identifier: typeof VIBE_BUNDLE_IDENTIFIER;
  version: typeof VIBE_BUNDLE_VERSION;
  vibes: StandardVibeBundleItem[];
};

export type StandardVibeBundleItem = {
  identifier: typeof VIBE_ITEM_IDENTIFIER;
  version: typeof VIBE_ITEM_VERSION;
  type: typeof VIBE_ITEM_ENCODING_TYPE | typeof VIBE_ITEM_IMAGE_TYPE;
  id: string;
  encodings: VibeBundleEncodings;
  name: string;
  createdAt: number;
  image?: string;
  thumbnail?: string;
  importInfo?: {
    model?: string;
    information_extracted?: number;
    strength?: number;
  };
};

export type StandardVibeGroup = {
  groups: Record<
    string,
    {
      vibes: Array<{vibeDataId: string; strength: number}>;
      createdAt: number;
      updatedAt: number;
    }
  >;
  vibeData: Record<string, StandardVibeBundleItem>;
  vibePresets: Record<
    string,
    {
      model: string;
      infoExtract: number;
      strength: number;
      imageId?: string;
      vibeDataId: string;
    }
  >;
  presetImages: Record<string, string>;
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
    .replace(/\.naiv4vibebundle(?:\.json)?$/i, '')
    .replace(/\.naiv4vibe(?:\.json)?$/i, '')
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

type NormalizedVibeImage = {
  base64: string;
  dataUrl: string;
  mimeType: string;
};

function inferVibeImageMimeType(base64: string): string {
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('UklGR')) return 'image/webp';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  return '';
}

function normalizeVibeImage(value: unknown): NormalizedVibeImage | null {
  const source = normalizeString(value);
  if (!source) return null;
  const base64 = normalizeBase64Image(source);
  if (!base64) return null;
  const mimeType = inferVibeImageMimeType(base64);
  if (!mimeType) return null;
  return {
    base64,
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType,
  };
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

function addMissingEncodingCreatedAt(
  encodings: VibeBundleEncodings,
  createdAt: number
): VibeBundleEncodings {
  return Object.fromEntries(
    Object.entries(encodings).map(([model, slots]) => [
      model,
      Object.fromEntries(
        Object.entries(slots).map(([slot, variant]) => [
          slot,
          variant.createdAt === undefined ? {...variant, createdAt} : variant,
        ])
      ),
    ])
  );
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

type ParseRawVibeContext = {
  usedIds: Set<string>;
  now: number;
  sourceName?: string;
  errors: string[];
};

function parseRawVibe(
  value: unknown,
  index: number,
  context: ParseRawVibeContext
): VibeLibraryItem | null {
  const errorPrefix = `vibe.${index}`;
  if (!isRecord(value)) {
    context.errors.push(`${errorPrefix}.invalid`);
    return null;
  }

  const raw = value as RawBundleVibe;
  if (raw.identifier !== VIBE_ITEM_IDENTIFIER) {
    context.errors.push(`${errorPrefix}.invalidIdentifier`);
    return null;
  }
  if (raw.version !== VIBE_ITEM_VERSION) {
    context.errors.push(`${errorPrefix}.invalidVersion`);
    return null;
  }
  if (
    raw.type !== VIBE_ITEM_ENCODING_TYPE &&
    raw.type !== VIBE_ITEM_IMAGE_TYPE
  ) {
    context.errors.push(`${errorPrefix}.invalidType`);
    return null;
  }

  const encodings = normalizeVibeEncodings(raw.encodings);
  if (Object.keys(encodings).length === 0) {
    context.errors.push(`${errorPrefix}.missingEncoding`);
    return null;
  }

  const image =
    raw.type === VIBE_ITEM_IMAGE_TYPE ? normalizeVibeImage(raw.image) : null;
  if (raw.type === VIBE_ITEM_IMAGE_TYPE && !image) {
    context.errors.push(`${errorPrefix}.missingImage`);
    return null;
  }
  const thumbnail = normalizeVibeImage(raw.thumbnail);

  const externalId = normalizeString(raw.id) || createLocalVibeId('external');
  let localId = externalId;
  if (context.usedIds.has(localId)) {
    localId = createLocalVibeId('vibe_import');
  }
  context.usedIds.add(localId);

  const createdAt = normalizeTimestamp(raw.createdAt, context.now);
  const importInfo = normalizeImportInfo(raw.importInfo);
  return {
    id: localId,
    ...(localId !== externalId ? {externalId} : {}),
    name: normalizeString(raw.name) || `Vibe ${index + 1}`,
    enabled: true,
    tags: [],
    createdAt,
    updatedAt: context.now,
    ...(image
      ? {
          source: {
            dataUrl: image.dataUrl,
            fingerprint: fingerprintString(image.base64),
            mimeType: image.mimeType,
          },
        }
      : {}),
    ...(thumbnail ? {previewImage: thumbnail.dataUrl} : {}),
    encodings,
    ...(importInfo || localId !== externalId || context.sourceName
      ? {
          importInfo: {
            ...(importInfo ?? {}),
            ...(localId !== externalId ? {externalId} : {}),
            ...(context.sourceName ? {sourceName: context.sourceName} : {}),
            importedAt: context.now,
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
  };
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
  const context: ParseRawVibeContext = {
    usedIds,
    now,
    sourceName: options.sourceName,
    errors,
  };
  const items = bundle.vibes
    .map((value, index) => parseRawVibe(value, index, context))
    .filter((item): item is VibeLibraryItem => Boolean(item));

  return {items, errors};
}

function getGroupFallbackImage(
  vibeDataId: string,
  raw: RawVibeGroupRoot
): unknown {
  if (!isRecord(raw.vibePresets) || !isRecord(raw.presetImages)) {
    return undefined;
  }
  const preset = Object.values(raw.vibePresets).find(
    value => isRecord(value) && value.vibeDataId === vibeDataId
  );
  if (!isRecord(preset)) return undefined;
  const imageId = normalizeString(preset.imageId);
  return imageId ? raw.presetImages[imageId] : undefined;
}

function parseVibeGroupJson(
  parsed: Record<string, unknown>,
  options: {
    existingIds?: Iterable<string>;
    sourceName?: string;
    now?: number;
  }
): ParseVibeImportResult {
  const raw = parsed as RawVibeGroupRoot;
  if (!isRecord(raw.vibeData)) {
    return {items: [], errors: ['group.invalidVibeData'], format: 'group'};
  }

  const errors: string[] = [];
  const context: ParseRawVibeContext = {
    usedIds: new Set(options.existingIds ?? []),
    now: options.now ?? Date.now(),
    sourceName: options.sourceName,
    errors,
  };
  const itemByVibeDataId = new Map<string, VibeLibraryItem>();
  const items: VibeLibraryItem[] = [];

  Object.entries(raw.vibeData).forEach(([vibeDataId, value], index) => {
    const valueWithFallback =
      isRecord(value) && !normalizeString(value.image)
        ? {...value, image: getGroupFallbackImage(vibeDataId, raw)}
        : value;
    const item = parseRawVibe(valueWithFallback, index, context);
    if (!item) return;
    items.push(item);
    itemByVibeDataId.set(vibeDataId, item);
  });

  const groups: ParsedVibeImportGroup[] = [];
  if (isRecord(raw.groups)) {
    for (const [rawName, rawGroup] of Object.entries(raw.groups)) {
      if (!isRecord(rawGroup) || !Array.isArray(rawGroup.vibes)) continue;
      const seen = new Set<string>();
      const groupItems: ParsedVibeImportGroup['items'] = [];
      for (const rawMember of rawGroup.vibes) {
        if (!isRecord(rawMember)) continue;
        const item = itemByVibeDataId.get(
          normalizeString(rawMember.vibeDataId)
        );
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        const strength = normalizeFiniteNumber(rawMember.strength);
        groupItems.push({
          id: item.id,
          ...(strength !== undefined
            ? {strength: clamp01(strength, strength)}
            : {}),
        });
      }
      const name = normalizeString(rawName);
      if (name && groupItems.length > 0) {
        groups.push({name, items: groupItems});
      }
    }
  }

  const groupedIds = new Set(
    groups.flatMap(group => group.items.map(item => item.id))
  );
  const ungrouped = items.filter(item => !groupedIds.has(item.id));
  if (ungrouped.length > 0) {
    groups.push({
      name: getVibeBundleDisplayName(options.sourceName),
      items: ungrouped.map(item => ({id: item.id})),
    });
  }

  return {
    items,
    errors,
    format: 'group',
    ...(groups.length > 0 ? {groups} : {}),
  };
}

export function parseVibeImportJson(
  jsonText: string,
  options: {
    existingIds?: Iterable<string>;
    sourceName?: string;
    now?: number;
    maxItems?: number;
  } = {}
): ParseVibeImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {items: [], errors: ['bundle.invalidJson']};
  }

  if (!isRecord(parsed)) {
    return {items: [], errors: ['bundle.invalidRoot']};
  }

  const format =
    parsed.identifier === VIBE_BUNDLE_IDENTIFIER
      ? 'bundle'
      : parsed.identifier === VIBE_ITEM_IDENTIFIER
        ? 'single'
        : isRecord(parsed.vibeData)
          ? 'group'
          : undefined;
  const rawItems =
    format === 'bundle'
      ? parsed.vibes
      : format === 'single'
        ? [parsed]
        : format === 'group'
          ? Object.values(parsed.vibeData as Record<string, unknown>)
          : undefined;

  if (
    Array.isArray(rawItems) &&
    typeof options.maxItems === 'number' &&
    rawItems.length > options.maxItems
  ) {
    return {items: [], errors: ['import.tooManyItems'], format};
  }

  if (format === 'single') {
    const wrapped = JSON.stringify({
      identifier: VIBE_BUNDLE_IDENTIFIER,
      version: VIBE_BUNDLE_VERSION,
      vibes: [parsed],
    });
    return {
      ...parseVibeBundleJson(wrapped, options),
      format,
    };
  }

  if (format === 'group') {
    return parseVibeGroupJson(parsed, options);
  }

  return {
    ...parseVibeBundleJson(jsonText, options),
    ...(format ? {format} : {}),
  };
}

export function exportVibeBundle(
  items: VibeLibraryItem[],
  options: {includeSourceImages?: boolean} = {}
): ExportVibeBundleResult {
  const includeSourceImages = options.includeSourceImages ?? true;
  const vibes: StandardVibeBundleItem[] = [];
  const skipped: VibeLibraryItem[] = [];
  const usedIds = new Set<string>();

  for (const item of items) {
    if (item.enabled === false) continue;

    const normalizedEncodings = normalizeVibeEncodings(item.encodings);
    if (Object.keys(normalizedEncodings).length === 0) {
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

    const preferredId =
      item.externalId ?? item.importInfo?.externalId ?? item.id;
    let exportId = preferredId;
    if (usedIds.has(exportId)) {
      exportId = item.id;
    }
    let suffix = 2;
    const baseId = exportId;
    while (usedIds.has(exportId)) {
      exportId = `${baseId}_${suffix}`;
      suffix += 1;
    }
    usedIds.add(exportId);

    const image = includeSourceImages
      ? normalizeVibeImage(item.source?.dataUrl)
      : null;
    const thumbnail = includeSourceImages
      ? normalizeVibeImage(item.previewImage)
      : null;
    const encodings = image
      ? addMissingEncodingCreatedAt(normalizedEncodings, item.createdAt)
      : normalizedEncodings;

    vibes.push({
      identifier: VIBE_ITEM_IDENTIFIER,
      version: VIBE_ITEM_VERSION,
      type: image ? VIBE_ITEM_IMAGE_TYPE : VIBE_ITEM_ENCODING_TYPE,
      id: exportId,
      encodings,
      name: item.name,
      createdAt: item.createdAt,
      ...(image ? {image: image.base64} : {}),
      ...(image && thumbnail ? {thumbnail: thumbnail.dataUrl} : {}),
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

export function exportVibeSelection(
  items: VibeLibraryItem[],
  options: ExportVibeSelectionOptions = {}
): ExportVibeSelectionResult {
  const {bundle, skipped} = exportVibeBundle(items, options);
  if (bundle.vibes.length === 0) {
    return {format: 'empty', data: undefined, skipped};
  }
  if (bundle.vibes.length === 1) {
    return {format: 'single', data: bundle.vibes[0], skipped};
  }

  const now = options.now ?? Date.now();
  const groupName = normalizeString(options.groupName) || 'Selected Vibes';
  const vibeData: StandardVibeGroup['vibeData'] = {};
  const vibePresets: StandardVibeGroup['vibePresets'] = {};
  const presetImages: StandardVibeGroup['presetImages'] = {};
  const groupVibes: StandardVibeGroup['groups'][string]['vibes'] = [];
  const usedPresetNames = new Set<string>();

  bundle.vibes.forEach((vibe, index) => {
    const vibeDataId = `cfgimg_${index + 1}`;
    const imageId =
      vibe.type === VIBE_ITEM_IMAGE_TYPE ? `cfgimg_image_${index + 1}` : '';
    const firstModelKey = Object.keys(vibe.encodings)[0] ?? '';
    const firstEncoding = firstModelKey
      ? Object.values(vibe.encodings[firstModelKey] ?? {})[0]
      : undefined;
    const model =
      vibe.importInfo?.model ||
      vibeBundleKeyToModel(firstModelKey) ||
      firstModelKey;
    const infoExtract = clamp01(
      vibe.importInfo?.information_extracted ??
        firstEncoding?.params?.information_extracted,
      VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED
    );
    const strength = clamp01(
      vibe.importInfo?.strength,
      VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH
    );

    vibeData[vibeDataId] = vibe;
    groupVibes.push({vibeDataId, strength});

    const presetBaseName = normalizeString(vibe.name) || `Vibe ${index + 1}`;
    let presetName = presetBaseName;
    let suffix = 2;
    while (usedPresetNames.has(presetName.toLowerCase())) {
      presetName = `${presetBaseName} (${suffix})`;
      suffix += 1;
    }
    usedPresetNames.add(presetName.toLowerCase());

    const normalizedImage = normalizeVibeImage(vibe.image);
    if (imageId && normalizedImage) {
      presetImages[imageId] = normalizedImage.dataUrl;
    }
    vibePresets[presetName] = {
      model,
      infoExtract,
      strength,
      ...(imageId && normalizedImage ? {imageId} : {}),
      vibeDataId,
    };
  });

  return {
    format: 'group',
    data: {
      groups: {
        [groupName]: {
          vibes: groupVibes,
          createdAt: now,
          updatedAt: now,
        },
      },
      vibeData,
      vibePresets,
      presetImages,
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
