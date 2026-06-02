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

const logger = createLogger('VibeTransfer');

type SdSettings = Record<string, unknown>;

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

function readSdSettings(context: SillyTavernContext): SdSettings {
  const sd = context.extensionSettings?.sd;
  return sd && typeof sd === 'object' ? (sd as SdSettings) : {};
}

function readString(source: SdSettings, key: string, fallback = ''): string {
  const value = source[key];
  return typeof value === 'string' ? value : fallback;
}

function readNumber(source: SdSettings, key: string, fallback: number): number {
  const value = source[key];
  const numeric =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readBoolean(
  source: SdSettings,
  key: string,
  fallback: boolean
): boolean {
  const value = source[key];
  return typeof value === 'boolean' ? value : fallback;
}

function clamp01(value: unknown, fallback: number): number {
  const numeric =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(VIBE_TRANSFER.MIN, Math.min(VIBE_TRANSFER.MAX, numeric));
}

function combinePrefixes(str1: string, str2: string, macro = ''): string {
  const process = (s: string) => s.trim().replace(/^,|,$/g, '').trim();

  if (!str2) {
    return str1;
  }

  const base = process(str1);
  const secondary = process(str2);
  const result =
    macro && base.includes(macro)
      ? base.replace(macro, secondary)
      : `${base}, ${secondary},`;
  return process(result);
}

function substituteBasicParams(
  value: string,
  context: SillyTavernContext
): string {
  return value
    .replace(/{{char}}/gi, String(context.name2 ?? ''))
    .replace(/{{user}}/gi, String(context.name1 ?? ''));
}

function getNovelParams(sd: SdSettings): {
  steps: number;
  width: number;
  height: number;
  sm: boolean;
  sm_dyn: boolean;
} {
  let steps = Math.round(readNumber(sd, 'steps', 28));
  let width = Math.round(readNumber(sd, 'width', 832));
  let height = Math.round(readNumber(sd, 'height', 1216));
  let sm = readBoolean(sd, 'novel_sm', false);
  let sm_dyn = readBoolean(sd, 'novel_sm_dyn', false);
  const sampler = readString(sd, 'sampler');

  if (sampler === 'ddim') {
    sm = false;
    sm_dyn = false;
  }

  if (!readBoolean(sd, 'novel_anlas_guard', false)) {
    return {steps, width, height, sm, sm_dyn};
  }

  const maxSteps = 28;
  const maxPixels = 1024 * 1024;

  if (width * height > maxPixels) {
    const ratio = Math.sqrt(maxPixels / (width * height));
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    if (width % 64 !== 0) {
      width = width - (width % 64);
    }

    if (height % 64 !== 0) {
      height = height - (height % 64);
    }

    while (width * height > maxPixels) {
      if (width > height) {
        width -= 64;
      } else {
        height -= 64;
      }
    }
  }

  if (steps > maxSteps) {
    steps = maxSteps;
  }

  return {steps, width, height, sm, sm_dyn};
}

function normalizeBase64Image(dataUrl: string): string | null {
  const trimmed = dataUrl.trim();
  if (!trimmed) {
    return null;
  }

  const commaIndex = trimmed.indexOf(',');
  const payload =
    trimmed.startsWith('data:') && commaIndex >= 0
      ? trimmed.slice(commaIndex + 1)
      : trimmed;
  const normalized = payload.replace(/\s+/g, '');

  if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function fingerprintString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
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

function getCharacterName(context: SillyTavernContext): string {
  const name = String(context.name2 ?? '').trim();
  return name || 'AutoIllustrator';
}

function humanizedDateTime(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('_');
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
  const sd = readSdSettings(context);
  const {steps, width, height, sm, sm_dyn} = getNovelParams(sd);
  const model = readString(sd, 'model');
  const promptPrefix = readString(sd, 'prompt_prefix');
  const negativePrefix = readString(sd, 'negative_prompt');
  const prefixedPrompt = substituteBasicParams(
    combinePrefixes(promptPrefix, prompt, '{prompt}'),
    context
  );
  const negativePrompt = substituteBasicParams(
    combinePrefixes('', negativePrefix),
    context
  );
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
    prompt: prefixedPrompt,
    model,
    sampler: readString(sd, 'sampler'),
    scheduler: readString(sd, 'scheduler', 'karras'),
    steps,
    scale: readNumber(sd, 'scale', 7),
    width,
    height,
    negative_prompt: negativePrompt,
    upscale_ratio: readNumber(sd, 'hr_scale', 1),
    decrisper: readBoolean(sd, 'novel_decrisper', false),
    sm,
    sm_dyn,
    variety_boost:
      readBoolean(sd, 'novel_variety', false) ||
      readBoolean(sd, 'variety_boost', false) ||
      readBoolean(sd, 'variety', false),
    seed:
      readNumber(sd, 'seed', -1) >= 0
        ? Math.round(readNumber(sd, 'seed', -1))
        : undefined,
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

async function saveBase64AsFile(
  base64Data: string,
  context: SillyTavernContext,
  format: string
): Promise<string> {
  const characterName = getCharacterName(context);
  const filename = `${characterName}_${humanizedDateTime()}`;
  const response = await fetch('/api/images/upload', {
    method: 'POST',
    headers: await getInternalRequestHeaders(),
    body: JSON.stringify({
      image: base64Data,
      format,
      ch_name: characterName,
      filename: filename.replace(/\./g, '_'),
    }),
  });

  if (!response.ok) {
    let detail = `${response.status}`;
    try {
      const errorData = await response.json();
      detail = String(errorData?.error ?? detail);
    } catch {
      detail = await response.text();
    }
    throw new AutoIllustratorError(
      'image-request-failed',
      'Failed to upload generated image',
      detail
    );
  }

  const data = await response.json();
  const path = data?.path;
  if (typeof path !== 'string' || !path) {
    throw new AutoIllustratorError(
      'image-empty-response',
      'Image upload returned no path'
    );
  }
  return path;
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
