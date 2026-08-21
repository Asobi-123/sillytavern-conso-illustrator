const REFERENCE_PIXEL_COUNT = 1011712;
const SIGMA_MAGIC_NUMBER = 19;
const SIGMA_MAGIC_NUMBER_V4_5 = 58;

export function calculateSkipCfgAboveSigma(width, height, modelName) {
  const usesModernSigma =
    modelName?.includes('nai-diffusion-4-5') ||
    modelName?.includes('nai-diffusion-5-');
  const magicConstant = usesModernSigma
    ? SIGMA_MAGIC_NUMBER_V4_5
    : SIGMA_MAGIC_NUMBER;
  const pixelCount = width * height;
  const ratio = pixelCount / REFERENCE_PIXEL_COUNT;
  return Math.pow(ratio, 0.5) * magicConstant;
}

export function isV4Model(modelName) {
  return String(modelName ?? '').includes('nai-diffusion-4');
}

function resolveParamsVersion(modelName) {
  return String(modelName ?? '').startsWith('nai-diffusion-5-') ? 4 : 3;
}

export function resolveInpaintingModel(modelName) {
  const model = String(modelName ?? 'nai-diffusion');
  if (model.includes('inpainting')) return model;
  if (model === 'nai-diffusion-5-curated') {
    return 'nai-diffusion-4-5-curated-inpainting';
  }
  if (model === 'nai-diffusion-5-full') {
    return 'nai-diffusion-5-full-inpainting';
  }
  if (model === 'nai-diffusion') return 'nai-diffusion-inpainting';
  return `${model.replace('-preview', '')}-inpainting`;
}

export function normalizeBase64Image(image) {
  if (typeof image !== 'string') return '';
  const trimmed = image.trim();
  const commaIndex = trimmed.indexOf(',');
  const payload =
    trimmed.startsWith('data:') && commaIndex >= 0
      ? trimmed.slice(commaIndex + 1)
      : trimmed;
  return payload.replace(/\s+/g, '');
}

function buildCommonParameters(requestBody, model, width, height) {
  const negativePrompt = requestBody.negative_prompt ?? '';
  return {
    params_version: resolveParamsVersion(model),
    prefer_brownian: true,
    negative_prompt: negativePrompt,
    height,
    width,
    scale: requestBody.scale ?? 9,
    seed:
      requestBody.seed >= 0
        ? requestBody.seed
        : Math.floor(Math.random() * 9999999999),
    sampler: requestBody.sampler ?? 'k_dpmpp_2m',
    noise_schedule: requestBody.scheduler ?? 'karras',
    steps: requestBody.steps ?? 28,
    n_samples: 1,
    ucPreset: 0,
    qualityToggle: false,
    controlnet_strength: 1,
    deliberate_euler_ancestral_bug: false,
    dynamic_thresholding: requestBody.decrisper ?? false,
    legacy: false,
    legacy_v3_extend: false,
    sm: requestBody.sm ?? false,
    sm_dyn: requestBody.sm_dyn ?? false,
    uncond_scale: 1,
    skip_cfg_above_sigma: requestBody.variety_boost
      ? calculateSkipCfgAboveSigma(width, height, model)
      : null,
    use_coords: false,
    characterPrompts: [],
    reference_strength_multiple: [],
    v4_negative_prompt: {
      caption: {base_caption: negativePrompt, char_captions: []},
    },
    v4_prompt: {
      caption: {
        base_caption: requestBody.prompt ?? '',
        char_captions: [],
      },
      use_coords: false,
      use_order: true,
    },
  };
}

export function buildNovelAiRequestBody(requestBody, references) {
  const prompt = requestBody.prompt ?? '';
  const model = requestBody.model ?? 'nai-diffusion';
  const width = requestBody.width ?? 512;
  const height = requestBody.height ?? 512;
  const parameters = {
    ...buildCommonParameters(requestBody, model, width, height),
    add_original_image: false,
    reference_image_multiple: references,
    reference_strength_multiple: requestBody.reference_strength_multiple ?? [],
  };

  if (!isV4Model(model)) {
    parameters.reference_information_extracted_multiple =
      requestBody.reference_information_extracted_multiple ?? [];
  }

  return {action: 'generate', input: prompt, model, parameters};
}

export function buildNovelAiInpaintRequestBody(requestBody) {
  const prompt = requestBody.prompt ?? '';
  const model = resolveInpaintingModel(requestBody.model);
  const width = requestBody.width ?? 512;
  const height = requestBody.height ?? 512;
  const parameters = buildCommonParameters(requestBody, model, width, height);
  const seed = parameters.seed;
  const extraNoiseSeed =
    requestBody.extra_noise_seed >= 0 ? requestBody.extra_noise_seed : seed;
  const strength = requestBody.strength ?? 0.6;
  const noise = requestBody.noise ?? 0;

  return {
    action: 'infill',
    input: prompt,
    model,
    parameters: {
      ...parameters,
      add_original_image: true,
      reference_image_multiple: [],
      reference_information_extracted_multiple: [],
      reference_strength_multiple: [],
      image: normalizeBase64Image(requestBody.image),
      mask: normalizeBase64Image(requestBody.mask),
      strength,
      noise,
      extra_noise_seed: extraNoiseSeed,
      img2img: {
        strength,
        noise,
        extra_noise_seed: extraNoiseSeed,
        color_correct: requestBody.color_correct ?? false,
      },
    },
  };
}
