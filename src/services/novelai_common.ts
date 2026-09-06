import {EXTENSION_NAME, VIBE_TRANSFER} from '../constants';
import {AutoIllustratorError} from '../utils/error_utils';
import {getInternalRequestHeaders} from '../utils/api';
import {composeNovelAiPrompts} from './novelai_presets';

export type SdSettings = Record<string, unknown>;

export interface NovelAiBasePayload {
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
  quality_preset_id?: string;
  uc_preset_id?: string;
  seed?: number;
}

export interface NovelAiImageRouteResponse {
  format?: string;
  data?: string;
  image?: string;
}

export function readSdSettings(context: SillyTavernContext): SdSettings {
  const sd = context.extensionSettings?.sd;
  return sd && typeof sd === 'object' ? (sd as SdSettings) : {};
}

export function readString(
  source: SdSettings,
  key: string,
  fallback = ''
): string {
  const value = source[key];
  return typeof value === 'string' ? value : fallback;
}

export function readNumber(
  source: SdSettings,
  key: string,
  fallback: number
): number {
  const value = source[key];
  const numeric =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function readBoolean(
  source: SdSettings,
  key: string,
  fallback: boolean
): boolean {
  const value = source[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function clamp01(value: unknown, fallback: number): number {
  const numeric =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(VIBE_TRANSFER.MIN, Math.min(VIBE_TRANSFER.MAX, numeric));
}

export function combinePrefixes(
  str1: string,
  str2: string,
  macro = ''
): string {
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

export function substituteBasicParams(
  value: string,
  context: SillyTavernContext
): string {
  return value
    .replace(/{{char}}/gi, String(context.name2 ?? ''))
    .replace(/{{user}}/gi, String(context.name1 ?? ''));
}

export function getNovelParams(sd: SdSettings): {
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

export function normalizeBase64Image(dataUrl: string): string | null {
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

export function fingerprintString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildNovelAiBasePayload(
  prompt: string,
  context: SillyTavernContext,
  dimensions?: {width: number; height: number}
): NovelAiBasePayload {
  const sd = readSdSettings(context);
  const sdParams = getNovelParams(sd);
  const width = dimensions?.width ?? sdParams.width;
  const height = dimensions?.height ?? sdParams.height;
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

  const settings = context.extensionSettings?.[EXTENSION_NAME] as
    | AutoIllustratorSettings
    | undefined;
  const composed = composeNovelAiPrompts(
    prefixedPrompt,
    negativePrompt,
    readString(sd, 'model'),
    {
      qualityPresetId: settings?.novelAiQualityPresetId,
      ucPresetId: settings?.novelAiUcPresetId,
    }
  );

  return {
    prompt: composed.prompt,
    model: readString(sd, 'model'),
    sampler: readString(sd, 'sampler'),
    scheduler: readString(sd, 'scheduler', 'karras'),
    steps: sdParams.steps,
    scale: readNumber(sd, 'scale', 7),
    width,
    height,
    negative_prompt: composed.negativePrompt,
    upscale_ratio: readNumber(sd, 'hr_scale', 1),
    decrisper: readBoolean(sd, 'novel_decrisper', false),
    sm: sdParams.sm,
    sm_dyn: sdParams.sm_dyn,
    variety_boost:
      readBoolean(sd, 'novel_variety', false) ||
      readBoolean(sd, 'novel_variety_boost', false) ||
      readBoolean(sd, 'variety_boost', false) ||
      readBoolean(sd, 'variety', false),
    quality_preset_id: composed.qualityPresetId,
    uc_preset_id: composed.ucPresetId,
    seed:
      readNumber(sd, 'seed', -1) >= 0
        ? Math.round(readNumber(sd, 'seed', -1))
        : undefined,
  };
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

export async function saveBase64AsFile(
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
