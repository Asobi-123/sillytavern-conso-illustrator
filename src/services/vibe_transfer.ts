/**
 * NovelAI Vibe Transfer service.
 *
 * This service keeps the normal `/sd` route untouched unless Vibe Transfer is
 * enabled and at least one valid reference image exists.
 */

import {VIBE_TRANSFER} from '../constants';
import {createLogger} from '../logger';
import type {
  VibeTransferEncodedCache,
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

  return {
    enabled: !!settings.vibeTransferEnabled,
    referenceImages,
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
  return !!config?.enabled && config.referenceImages.length > 0;
}

export function buildNovelAiAdvancedPayload(
  prompt: string,
  context: SillyTavernContext,
  config: VibeTransferGenerationConfig
): NovelAiAdvancedPayload {
  const basePayload = buildNovelAiBasePayload(prompt, context);
  const model = basePayload.model;
  const referenceEntries = config.referenceImages
    .map(image => {
      const normalized = normalizeBase64Image(image.dataUrl);
      if (!normalized) return null;
      const sourceFingerprint = fingerprintString(normalized);
      const cache = findEncodedVibeCache(
        image,
        model,
        config.informationExtracted,
        sourceFingerprint
      );
      return {
        image,
        normalized,
        sourceFingerprint,
        encoded: cache?.encoded ?? null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);

  return {
    ...basePayload,
    reference_image_multiple: referenceEntries.map(entry => entry.normalized),
    reference_objects: referenceEntries.map(entry => entry.image),
    reference_image_ids: referenceEntries.map(entry => entry.image.id),
    reference_encoded_vibe_multiple: referenceEntries.map(
      entry => entry.encoded
    ),
    reference_source_fingerprint_multiple: referenceEntries.map(
      entry => entry.sourceFingerprint
    ),
    reference_information_extracted_multiple: referenceEntries.map(
      () => config.informationExtracted
    ),
    reference_strength_multiple: referenceEntries.map(
      () => config.referenceStrength
    ),
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

export async function generateNovelAiVibeTransferImage(
  prompt: string,
  context: SillyTavernContext,
  config: VibeTransferGenerationConfig,
  onReferencesUpdated?: (references: VibeTransferReferenceImage[]) => void,
  signal?: AbortSignal
): Promise<string> {
  const payload = buildNovelAiAdvancedPayload(prompt, context, config);

  if (payload.reference_image_multiple.length === 0) {
    throw new AutoIllustratorError(
      'image-empty-response',
      'Vibe Transfer has no valid reference images'
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
