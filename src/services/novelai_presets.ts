export type NovelAiModelFamily = 'v4' | 'v4.5' | 'v5' | 'unknown';

export type NovelAiQualityPresetId = 'none' | 'standard' | 'expressive';

export type NovelAiUcPresetId =
  | 'none'
  | 'light'
  | 'heavy'
  | 'furry-focus'
  | 'human-focus';

export interface NovelAiPresetText {
  id: string;
  label: string;
  apiId: number;
  models: readonly NovelAiModelFamily[];
  text: string;
  source: string;
}

export interface NovelAiPresetSelection {
  qualityPresetId: NovelAiQualityPresetId;
  ucPresetId: NovelAiUcPresetId;
}

export interface NovelAiPresetResolution {
  modelFamily: NovelAiModelFamily;
  quality: NovelAiPresetText;
  uc: NovelAiPresetText;
}

export interface NovelAiPromptComposition {
  prompt: string;
  negativePrompt: string;
  qualityPresetId: NovelAiQualityPresetId;
  ucPresetId: NovelAiUcPresetId;
  qualityText: string;
  ucText: string;
}

const ALL_MODELS: readonly NovelAiModelFamily[] = [
  'v4',
  'v4.5',
  'v5',
  'unknown',
];

const QUALITY_PRESETS: readonly NovelAiPresetText[] = [
  {
    id: 'none',
    label: 'None',
    apiId: 0,
    models: ALL_MODELS,
    text: '',
    source: 'NovelAI PNG metadata: tag_hint_qt=0 (no text append)',
  },
  {
    id: 'standard',
    label: 'Standard',
    apiId: 1,
    models: ALL_MODELS,
    text: 'very aesthetic, masterpiece, no text',
    source: 'NovelAI PNG metadata: tag_hint_qt=1',
  },
  {
    id: 'expressive',
    label: 'Expressive',
    apiId: 3,
    models: ALL_MODELS,
    text: 'very aesthetic, amazing quality, no text',
    source: 'NovelAI PNG metadata: tag_hint_qt=3',
  },
];

const UC_PRESETS: readonly NovelAiPresetText[] = [
  {
    id: 'none',
    label: 'None',
    apiId: 0,
    models: ALL_MODELS,
    text: '',
    source:
      'NovelAI PNG metadata: tag_hint_uc_preset=0 is the no-preset baseline',
  },
  {
    id: 'light',
    label: 'Light',
    apiId: 1,
    models: ALL_MODELS,
    text: 'lowres, worst quality, very displeasing',
    source: 'NovelAI PNG metadata baseline for the light UC preset',
  },
  {
    id: 'heavy',
    label: 'Heavy',
    apiId: 2,
    models: ALL_MODELS,
    text: 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page',
    source: 'NovelAI PNG metadata: tag_hint_uc_preset=2',
  },
  {
    id: 'furry-focus',
    label: 'Furry Focus',
    apiId: 3,
    models: ALL_MODELS,
    text: 'lowres, bad hands, bad anatomy, artistic error, sepia, white haze, worst quality, very displeasing, jpeg artifacts, 0::ai-generated::',
    source: 'NovelAI PNG metadata: tag_hint_uc_preset=3',
  },
  {
    id: 'human-focus',
    label: 'Human Focus',
    apiId: 4,
    models: ALL_MODELS,
    text: 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy',
    source: 'NovelAI PNG metadata: tag_hint_uc_preset=4',
  },
];

function normalizeModel(model: unknown): string {
  return typeof model === 'string' ? model.trim().toLowerCase() : '';
}

export function getNovelAiModelFamily(model: unknown): NovelAiModelFamily {
  const normalized = normalizeModel(model);
  if (/(?:^|[^0-9])4[-.]?5(?:[^0-9]|$)/.test(normalized)) return 'v4.5';
  if (/(?:^|[^0-9])v?5(?:[^0-9]|$)/.test(normalized)) return 'v5';
  if (/(?:^|[^0-9])v?4(?:[^0-9]|$)/.test(normalized)) return 'v4';
  return 'unknown';
}

export function listNovelAiQualityPresets(): readonly NovelAiPresetText[] {
  return QUALITY_PRESETS;
}

export function listNovelAiUcPresets(): readonly NovelAiPresetText[] {
  return UC_PRESETS;
}

function isQualityPresetId(value: unknown): value is NovelAiQualityPresetId {
  return QUALITY_PRESETS.some(preset => preset.id === value);
}

function isUcPresetId(value: unknown): value is NovelAiUcPresetId {
  return UC_PRESETS.some(preset => preset.id === value);
}

function findPreset(
  presets: readonly NovelAiPresetText[],
  id: string,
  modelFamily: NovelAiModelFamily
): NovelAiPresetText {
  const selected = presets.find(
    preset => preset.id === id && preset.models.includes(modelFamily)
  );
  return selected ?? presets[0];
}

function appendPrompt(base: string, extra: string): string {
  const left = base.trim().replace(/^,|,$/g, '').trim();
  const right = extra.trim().replace(/^,|,$/g, '').trim();
  if (!right) return base;
  if (!left) return right;
  const existingTags = new Set(
    left
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(Boolean)
  );
  const extraTags = right
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
  if (
    extraTags.length > 0 &&
    extraTags.every(tag => existingTags.has(tag.toLowerCase()))
  ) {
    return base;
  }
  return `${left}, ${right}`;
}

export function resolveNovelAiPresets(
  model: unknown,
  selection: Partial<NovelAiPresetSelection> = {}
): NovelAiPresetResolution {
  const modelFamily = getNovelAiModelFamily(model);
  const qualityId = isQualityPresetId(selection.qualityPresetId)
    ? selection.qualityPresetId
    : 'none';
  const ucId = isUcPresetId(selection.ucPresetId)
    ? selection.ucPresetId
    : 'none';
  return {
    modelFamily,
    quality: findPreset(QUALITY_PRESETS, qualityId, modelFamily),
    uc: findPreset(UC_PRESETS, ucId, modelFamily),
  };
}

export function composeNovelAiPrompts(
  prompt: string,
  negativePrompt: string,
  model: unknown,
  selection: Partial<NovelAiPresetSelection> = {}
): NovelAiPromptComposition {
  const resolved = resolveNovelAiPresets(model, selection);
  return {
    prompt: resolved.quality.text
      ? appendPrompt(prompt, resolved.quality.text)
      : prompt,
    negativePrompt: resolved.uc.text
      ? appendPrompt(negativePrompt, resolved.uc.text)
      : negativePrompt,
    qualityPresetId: resolved.quality.id as NovelAiQualityPresetId,
    ucPresetId: resolved.uc.id as NovelAiUcPresetId,
    qualityText: resolved.quality.text,
    ucText: resolved.uc.text,
  };
}

export function getNovelAiPresetApiIds(
  model: unknown,
  selection: Partial<NovelAiPresetSelection> = {}
): {qualityId: number; ucId: number} {
  const resolved = resolveNovelAiPresets(model, selection);
  return {qualityId: resolved.quality.apiId, ucId: resolved.uc.apiId};
}
