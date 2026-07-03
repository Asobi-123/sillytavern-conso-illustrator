/**
 * NovelAI Vibe Transfer service.
 *
 * This service keeps the normal `/sd` route untouched unless Vibe Transfer is
 * enabled and at least one valid reference image exists.
 */

import {VIBE_TRANSFER} from '../constants';
import {createLogger} from '../logger';
import type {
  VibeLibraryItem,
  VibeTransferEncodedCache,
  VibeTransferCombination,
  VibeTransferGenerationConfig,
  VibeTransferReferenceImage,
} from '../types';
import {getInternalRequestHeaders} from '../utils/api';
import {AutoIllustratorError, extractErrorMessage} from '../utils/error_utils';
import {
  buildNovelAiBasePayload,
  clamp01,
  fingerprintString,
  normalizeBase64Image,
  saveBase64AsFile,
} from './novelai_common';
import {
  findVibeEncodingForModel,
  findVibeEncodingForModelAndInformation,
  modelToVibeBundleKey,
  VIBE_BUNDLE_DEFAULT_ENCODING_SLOT,
} from './vibe_bundle';

const logger = createLogger('VibeTransfer');

export interface NovelAiAdvancedPayload {
  prompt: string;
  model: string;
  sampler: string;
  scheduler: string;
  steps: number;
  scale: number;
  width: number;
  height: number;
  negative_prompt: string;
  upscale_ratio: number;
  decrisper: boolean;
  sm: boolean;
  sm_dyn: boolean;
  variety_boost: boolean;
  seed?: number;
  reference_image_multiple: string[];
  reference_objects: VibeTransferReferenceImage[];
  reference_image_ids: string[];
  reference_encoded_vibe_multiple: (string | null)[];
  reference_source_fingerprint_multiple: string[];
  reference_information_extracted_multiple: number[];
  reference_strength_multiple: number[];
}

interface NovelAiAdvancedResponse {
  format?: string;
  data?: string;
  image?: string;
  updatedReferences?: VibeTransferReferenceImage[];
}

function findEncodedVibeCache(
  image: VibeTransferReferenceImage,
  model: string,
  informationExtracted: number,
  sourceFingerprint: string
): VibeTransferEncodedCache | null {
  const caches = Array.isArray(image.encodedVibes) ? image.encodedVibes : [];
  return (
    caches.find(
      cache =>
        cache.model === model &&
        cache.informationExtracted === informationExtracted &&
        cache.sourceFingerprint === sourceFingerprint &&
        cache.encoded.length > 0
    ) ?? null
  );
}

function referenceToLibraryItem(
  image: VibeTransferReferenceImage
): VibeLibraryItem {
  return {
    id: image.id,
    name: image.name,
    enabled: image.enabled,
    tags: image.tags,
    createdAt: image.addedAt,
    updatedAt: image.addedAt,
    source: {dataUrl: image.dataUrl},
    previewImage: image.dataUrl,
    encodings: {},
    legacyReferenceId: image.id,
  };
}

function referenceToLegacyReference(
  item: VibeLibraryItem
): VibeTransferReferenceImage {
  return {
    id: item.legacyReferenceId ?? item.id,
    name: item.name,
    dataUrl: item.source?.dataUrl ?? item.previewImage ?? '',
    tags: item.tags,
    enabled: item.enabled,
    addedAt: item.createdAt,
  };
}

function resolvePerVibeStrength(
  item: VibeLibraryItem,
  config: VibeTransferGenerationConfig
): number {
  if (item.generation?.strength !== undefined) {
    return clamp01(item.generation.strength, config.referenceStrength);
  }
  if (item.importInfo?.strength !== undefined) {
    return clamp01(item.importInfo.strength, config.referenceStrength);
  }
  return config.referenceStrength;
}

function resolvePerVibeInformation(
  item: VibeLibraryItem,
  config: VibeTransferGenerationConfig
): number {
  if (item.generation?.information_extracted !== undefined) {
    return clamp01(
      item.generation.information_extracted,
      config.informationExtracted
    );
  }
  if (item.importInfo?.information_extracted !== undefined) {
    return clamp01(
      item.importInfo.information_extracted,
      config.informationExtracted
    );
  }
  return config.informationExtracted;
}

function resolveCombinationItemGeneration(
  item: VibeLibraryItem,
  combination: VibeTransferCombination,
  fallbackConfig: VibeTransferGenerationConfig
): VibeLibraryItem['generation'] | undefined {
  const saved = combination.itemGenerations?.[item.id];
  if (saved) return {...saved};

  if (
    combination.referenceStrength !== undefined ||
    combination.informationExtracted !== undefined
  ) {
    return {
      inheritGlobalStrength: false,
      strength:
        combination.referenceStrength !== undefined
          ? clamp01(
              combination.referenceStrength,
              fallbackConfig.referenceStrength
            )
          : resolvePerVibeStrength(item, fallbackConfig),
      inheritGlobalInformationExtracted: false,
      information_extracted:
        combination.informationExtracted !== undefined
          ? clamp01(
              combination.informationExtracted,
              fallbackConfig.informationExtracted
            )
          : resolvePerVibeInformation(item, fallbackConfig),
    };
  }

  return item.generation ? {...item.generation} : undefined;
}

export function buildVibeTransferConfigFromSettings(
  settings: AutoIllustratorSettings
): VibeTransferGenerationConfig {
  const rawImages = Array.isArray(settings.vibeTransferReferenceImages)
    ? settings.vibeTransferReferenceImages
    : [];
  const referenceImages = rawImages
    .filter(
      (entry): entry is VibeTransferReferenceImage =>
        !!entry &&
        typeof entry === 'object' &&
        typeof entry.id === 'string' &&
        typeof entry.name === 'string' &&
        typeof entry.dataUrl === 'string' &&
        entry.enabled !== false
    )
    .slice(0, VIBE_TRANSFER.MAX_REFERENCES);
  const rawLibraryItems = Array.isArray(settings.vibeTransferLibraryItems)
    ? settings.vibeTransferLibraryItems
    : [];
  const libraryItems =
    rawLibraryItems.length > 0
      ? rawLibraryItems
          .filter(
            (entry): entry is VibeLibraryItem =>
              !!entry &&
              typeof entry === 'object' &&
              typeof entry.id === 'string' &&
              typeof entry.name === 'string' &&
              entry.enabled !== false
          )
          .slice(0, VIBE_TRANSFER.MAX_REFERENCES)
      : referenceImages.map(referenceToLibraryItem);

  return {
    enabled: !!settings.vibeTransferEnabled,
    referenceImages,
    libraryItems,
    referenceStrength: clamp01(
      settings.vibeTransferReferenceStrength,
      VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH
    ),
    informationExtracted: clamp01(
      settings.vibeTransferInformationExtracted,
      VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED
    ),
  };
}

export function shouldUseVibeTransfer(
  config?: VibeTransferGenerationConfig
): config is VibeTransferGenerationConfig {
  return (
    !!config?.enabled &&
    (config.libraryItems.length > 0 || config.referenceImages.length > 0)
  );
}

export interface VibeCombinationRandomConfig {
  enabled: boolean;
  /** Whitelist of combination IDs eligible for random pick. Empty = all. */
  whitelist: string[];
}

export interface PickedVibeCombination {
  id: string;
  name: string;
  config: VibeTransferGenerationConfig;
}

export function pickRandomVibeCombinationConfig(
  settings: AutoIllustratorSettings,
  config: VibeCombinationRandomConfig
): PickedVibeCombination | null {
  if (!config.enabled || !settings.vibeTransferEnabled) return null;

  const libraryItems = Array.isArray(settings.vibeTransferLibraryItems)
    ? settings.vibeTransferLibraryItems
    : [];
  if (libraryItems.length === 0) return null;

  const itemById = new Map(libraryItems.map(item => [item.id, item]));
  const combinations = (
    Array.isArray(settings.vibeTransferCombinations)
      ? settings.vibeTransferCombinations
      : []
  ).filter(
    (combination): combination is VibeTransferCombination =>
      !!combination &&
      typeof combination.id === 'string' &&
      typeof combination.name === 'string' &&
      Array.isArray(combination.itemIds) &&
      combination.itemIds.some(id => itemById.has(id))
  );
  if (combinations.length === 0) return null;

  const eligible =
    config.whitelist.length === 0
      ? combinations
      : combinations.filter(combination =>
          config.whitelist.includes(combination.id)
        );
  if (eligible.length === 0) return null;

  const picked = eligible[Math.floor(Math.random() * eligible.length)];
  const baseConfig = buildVibeTransferConfigFromSettings(settings);
  const selectedItems = picked.itemIds
    .map(id => itemById.get(id))
    .filter((item): item is VibeLibraryItem => !!item)
    .map(item => {
      const generation = resolveCombinationItemGeneration(
        item,
        picked,
        baseConfig
      );
      return {
        ...item,
        enabled: true,
        ...(generation ? {generation: {...generation}} : {}),
      };
    });

  if (selectedItems.length === 0) return null;

  return {
    id: picked.id,
    name: picked.name,
    config: {
      ...baseConfig,
      enabled: true,
      libraryItems: selectedItems.slice(0, VIBE_TRANSFER.MAX_REFERENCES),
      referenceImages: [],
    },
  };
}

export function buildVibeCombinationRandomConfigFromSettings(
  settings: AutoIllustratorSettings
): VibeCombinationRandomConfig {
  if (settings.generationStyleMode === 'fixed') {
    const preset = Array.isArray(settings.generationStylePresets)
      ? settings.generationStylePresets.find(
          entry => entry.id === settings.currentGenerationStylePresetId
        )
      : undefined;
    const fixedId =
      typeof preset?.vibeCombinationId === 'string'
        ? preset.vibeCombinationId.trim()
        : typeof settings.fixedVibeCombinationId === 'string'
          ? settings.fixedVibeCombinationId.trim()
          : '';
    return {
      enabled: !!fixedId,
      whitelist: fixedId ? [fixedId] : [],
    };
  }

  if (settings.generationStyleMode === 'off') {
    return {
      enabled: false,
      whitelist: [],
    };
  }

  return {
    enabled: !!settings.randomizeVibeCombinationPerGeneration,
    whitelist: Array.isArray(settings.vibeCombinationPoolWhitelist)
      ? [...settings.vibeCombinationPoolWhitelist]
      : [],
  };
}

export function buildNovelAiAdvancedPayload(
  prompt: string,
  context: SillyTavernContext,
  config: VibeTransferGenerationConfig
): NovelAiAdvancedPayload {
  const basePayload = buildNovelAiBasePayload(prompt, context);
  const model = basePayload.model;
  const legacyById = new Map(
    config.referenceImages.map(image => [image.id, image])
  );
  const sourceItems =
    config.libraryItems.length > 0
      ? config.libraryItems
      : config.referenceImages.map(referenceToLibraryItem);
  const referenceEntries = sourceItems
    .filter(item => item.enabled !== false)
    .map(item => {
      const sourceDataUrl = item.source?.dataUrl ?? item.previewImage ?? '';
      const normalized = sourceDataUrl
        ? normalizeBase64Image(sourceDataUrl)
        : null;
      const sourceFingerprint = normalized ? fingerprintString(normalized) : '';
      const legacyReference =
        legacyById.get(item.legacyReferenceId ?? item.id) ??
        (item.source?.dataUrl
          ? ({
              id: item.legacyReferenceId ?? item.id,
              name: item.name,
              dataUrl: item.source.dataUrl,
              tags: item.tags,
              enabled: item.enabled,
              addedAt: item.createdAt,
            } satisfies VibeTransferReferenceImage)
          : null);
      const informationExtracted = resolvePerVibeInformation(item, config);
      const cache =
        legacyReference && normalized
          ? findEncodedVibeCache(
              legacyReference,
              model,
              informationExtracted,
              sourceFingerprint
            )
          : null;
      const sourceItemEncoding = normalized
        ? findVibeEncodingForModelAndInformation(
            item,
            model,
            informationExtracted
          )
        : null;
      const bundleEncoding = normalized
        ? null
        : findVibeEncodingForModel(item, model);
      const encoded =
        cache?.encoded ??
        sourceItemEncoding?.encoding ??
        bundleEncoding?.encoding ??
        null;
      if (!normalized && !encoded) return null;
      return {
        image: legacyReference,
        item,
        normalized: normalized ?? '',
        sourceFingerprint,
        encoded,
        informationExtracted,
        strength: resolvePerVibeStrength(item, config),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);

  return {
    ...basePayload,
    reference_image_multiple: referenceEntries.map(entry => entry.normalized),
    reference_objects: referenceEntries.map(
      entry => entry.image ?? referenceToLegacyReference(entry.item)
    ),
    reference_image_ids: referenceEntries.map(entry => entry.item.id),
    reference_encoded_vibe_multiple: referenceEntries.map(
      entry => entry.encoded
    ),
    reference_source_fingerprint_multiple: referenceEntries.map(
      entry => entry.sourceFingerprint
    ),
    reference_information_extracted_multiple: referenceEntries.map(
      entry => entry.informationExtracted
    ),
    reference_strength_multiple: referenceEntries.map(entry => entry.strength),
  };
}

export function mergeVibeTransferReferenceUpdates(
  existingReferences: VibeTransferReferenceImage[],
  updatedReferences: VibeTransferReferenceImage[]
): VibeTransferReferenceImage[] {
  const updates = new Map(
    updatedReferences
      .filter(ref => ref && typeof ref.id === 'string')
      .map(ref => [ref.id, ref])
  );
  return existingReferences.map(
    reference => updates.get(reference.id) ?? reference
  );
}

export function mergeVibeTransferLibraryItemUpdates(
  existingItems: VibeLibraryItem[],
  updatedReferences: VibeTransferReferenceImage[]
): VibeLibraryItem[] {
  const updates = new Map(
    updatedReferences
      .filter(ref => ref && typeof ref.id === 'string')
      .map(ref => [ref.id, ref])
  );
  return existingItems.map(item => {
    const updated =
      updates.get(item.id) ??
      (item.legacyReferenceId
        ? updates.get(item.legacyReferenceId)
        : undefined);
    if (!updated || !Array.isArray(updated.encodedVibes)) return item;
    const encodings = {...(item.encodings ?? {})};
    updated.encodedVibes.forEach(cache => {
      if (!cache?.encoded || !cache.model) return;
      const modelKey = modelToVibeBundleKey(cache.model);
      const slotKey =
        typeof cache.informationExtracted === 'number'
          ? `information_${cache.informationExtracted
              .toFixed(3)
              .replace('.', '_')}`
          : VIBE_BUNDLE_DEFAULT_ENCODING_SLOT;
      encodings[modelKey] = {
        ...(encodings[modelKey] ?? {}),
        [slotKey]: {
          encoding: cache.encoded,
          params: {information_extracted: cache.informationExtracted},
          createdAt: cache.createdAt,
        },
      };
    });
    return {
      ...item,
      legacyReferenceId: item.legacyReferenceId ?? updated.id,
      updatedAt: Date.now(),
      source: {
        ...(item.source ?? {}),
        ...(updated.dataUrl ? {dataUrl: updated.dataUrl} : {}),
      },
      encodings,
    };
  });
}

export async function generateNovelAiVibeTransferImage(
  prompt: string,
  context: SillyTavernContext,
  config: VibeTransferGenerationConfig,
  onReferencesUpdated?: (references: VibeTransferReferenceImage[]) => void,
  signal?: AbortSignal
): Promise<string> {
  const payload = buildNovelAiAdvancedPayload(prompt, context, config);

  const hasUsableReference =
    payload.reference_image_multiple.some(value => value.length > 0) ||
    payload.reference_encoded_vibe_multiple.some(
      value => typeof value === 'string' && value.length > 0
    );
  if (!hasUsableReference) {
    throw new AutoIllustratorError(
      'image-empty-response',
      'Vibe Transfer has no valid references'
    );
  }

  logger.debug('Calling NovelAI advanced Vibe Transfer route');

  const response = await fetch(VIBE_TRANSFER.ADVANCED_ROUTE, {
    method: 'POST',
    headers: await getInternalRequestHeaders(),
    signal,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    const code =
      response.status === 404
        ? 'image-advanced-backend-unavailable'
        : 'image-request-failed';
    throw new AutoIllustratorError(
      code,
      'NovelAI advanced image generation failed',
      detail || String(response.status)
    );
  }

  let result: NovelAiAdvancedResponse;
  try {
    result = (await response.json()) as NovelAiAdvancedResponse;
  } catch (error) {
    throw new AutoIllustratorError(
      'image-request-failed',
      'NovelAI advanced route returned invalid JSON',
      extractErrorMessage(error)
    );
  }

  const data = result.data ?? result.image;
  if (!data) {
    throw new AutoIllustratorError(
      'image-empty-response',
      'NovelAI advanced route returned no image'
    );
  }

  if (Array.isArray(result.updatedReferences)) {
    onReferencesUpdated?.(result.updatedReferences);
  }

  return saveBase64AsFile(data, context, result.format || 'png');
}
