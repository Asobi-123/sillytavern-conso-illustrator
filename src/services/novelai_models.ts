export const NOVELAI_SOURCE = 'novel';

export const NOVELAI_MODELS = {
  V5_CURATED: 'nai-diffusion-5-curated',
  V5_FULL: 'nai-diffusion-5-full',
} as const;

export type NovelAiV5ModelId =
  (typeof NOVELAI_MODELS)[keyof typeof NOVELAI_MODELS];

export interface NovelAiModelCapability {
  id: NovelAiV5ModelId;
  label: string;
  supportsVibeTransfer: false;
  inpaintingModel: string;
  recommended: {
    width: number;
    height: number;
    steps: number;
    scale: number;
    sampler: string;
    scheduler: string;
    paramsVersion: number;
  };
}

const V5_RECOMMENDED_SETTINGS = {
  width: 832,
  height: 1216,
  steps: 23,
  scale: 7,
  sampler: 'k_euler_ancestral',
  scheduler: 'karras',
  paramsVersion: 4,
} as const;

export const NOVELAI_V5_CAPABILITIES: readonly NovelAiModelCapability[] = [
  {
    id: NOVELAI_MODELS.V5_CURATED,
    label: 'NAI Diffusion Anime V5 (Curated)',
    supportsVibeTransfer: false,
    inpaintingModel: 'nai-diffusion-4-5-curated-inpainting',
    recommended: V5_RECOMMENDED_SETTINGS,
  },
  {
    id: NOVELAI_MODELS.V5_FULL,
    label: 'NAI Diffusion Anime V5 (Full)',
    supportsVibeTransfer: false,
    inpaintingModel: 'nai-diffusion-5-full-inpainting',
    recommended: V5_RECOMMENDED_SETTINGS,
  },
];

const COMPATIBILITY_OPTION_ATTRIBUTE = 'data-auto-illustrator-nai-v5';
const NOVELAI_UPSCALE_RATIOS = new Set([1, 2, 4]);

export interface NovelAiSettingsNormalizationResult {
  upscaleRatioChanged: boolean;
  previousUpscaleRatio?: unknown;
}

function getSdSettings(context: SillyTavernContext): Record<string, unknown> {
  const sd = context.extensionSettings?.sd;
  return sd && typeof sd === 'object' ? (sd as Record<string, unknown>) : {};
}

export function isNovelAiV5Model(model: unknown): model is NovelAiV5ModelId {
  return NOVELAI_V5_CAPABILITIES.some(capability => capability.id === model);
}

export function getNovelAiV5Capability(
  model: unknown
): NovelAiModelCapability | undefined {
  return NOVELAI_V5_CAPABILITIES.find(capability => capability.id === model);
}

export function normalizeNovelAiGenerationSettings(
  context: SillyTavernContext
): NovelAiSettingsNormalizationResult {
  const sd = getSdSettings(context);
  if (sd.source !== NOVELAI_SOURCE) {
    return {upscaleRatioChanged: false};
  }

  const previousUpscaleRatio = sd.hr_scale;
  const upscaleRatio = Number(previousUpscaleRatio);
  if (
    Number.isFinite(upscaleRatio) &&
    NOVELAI_UPSCALE_RATIOS.has(upscaleRatio)
  ) {
    return {upscaleRatioChanged: false};
  }

  sd.hr_scale = 1;
  const input = document.querySelector<HTMLInputElement>('#sd_hr_scale');
  const value = document.querySelector<HTMLElement>('#sd_hr_scale_value');
  if (input) {
    input.value = '1';
    input.dispatchEvent(new Event('input', {bubbles: true}));
  } else {
    context.saveSettingsDebounced?.();
  }
  if (value) {
    value.textContent = '1';
  }

  return {upscaleRatioChanged: true, previousUpscaleRatio};
}

export function reconcileNovelAiV5ModelOptions(
  context: SillyTavernContext,
  select: HTMLSelectElement | null = document.querySelector('#sd_model')
): void {
  if (!select) return;

  const sd = getSdSettings(context);
  if (sd.source !== NOVELAI_SOURCE) {
    select
      .querySelectorAll(`option[${COMPATIBILITY_OPTION_ATTRIBUTE}]`)
      .forEach(option => option.remove());
    return;
  }

  const selectedModel = sd.model;
  for (const capability of NOVELAI_V5_CAPABILITIES) {
    const matchingOptions = Array.from(select.options).filter(
      option => option.value === capability.id
    );
    const nativeOption = matchingOptions.find(
      option => !option.hasAttribute(COMPATIBILITY_OPTION_ATTRIBUTE)
    );
    if (nativeOption) {
      matchingOptions
        .filter(option => option.hasAttribute(COMPATIBILITY_OPTION_ATTRIBUTE))
        .forEach(option => option.remove());
      nativeOption.selected = selectedModel === capability.id;
      continue;
    }
    if (matchingOptions.length > 0) {
      continue;
    }

    const option = document.createElement('option');
    option.value = capability.id;
    option.textContent = capability.label;
    option.setAttribute(COMPATIBILITY_OPTION_ATTRIBUTE, '');
    option.selected = selectedModel === capability.id;
    select.append(option);
  }

  if (isNovelAiV5Model(selectedModel)) {
    select.value = selectedModel;
  }
}

export function initializeNovelAiV5ModelCompatibility(
  context: SillyTavernContext
): () => void {
  let observedSelect: HTMLSelectElement | null = null;
  let selectObserver: MutationObserver | null = null;

  const observeSelect = (): void => {
    const select = document.querySelector<HTMLSelectElement>('#sd_model');
    if (select === observedSelect) {
      reconcileNovelAiV5ModelOptions(context, select);
      return;
    }

    selectObserver?.disconnect();
    observedSelect = select;
    reconcileNovelAiV5ModelOptions(context, select);

    if (select) {
      documentObserver.disconnect();
      selectObserver = new MutationObserver(() => {
        reconcileNovelAiV5ModelOptions(context, select);
      });
      selectObserver.observe(select, {childList: true});
    }
  };

  const documentObserver = new MutationObserver(observeSelect);
  documentObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  const sourceSelect = document.querySelector<HTMLSelectElement>('#sd_source');
  sourceSelect?.addEventListener('change', observeSelect);
  observeSelect();

  return () => {
    documentObserver.disconnect();
    selectObserver?.disconnect();
    sourceSelect?.removeEventListener('change', observeSelect);
  };
}
