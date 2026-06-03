import {Buffer} from 'node:buffer';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

import express from 'express';
import fetch from 'node-fetch';

const IMAGE_NOVELAI = 'https://image.novelai.net';
const API_NOVELAI = 'https://api.novelai.net';
const REFERENCE_PIXEL_COUNT = 1011712;
const SIGMA_MAGIC_NUMBER = 19;
const SIGMA_MAGIC_NUMBER_V4_5 = 58;
const MAX_ENCODED_CACHE_PER_REFERENCE = 8;
const INPAINT_TIMEOUT_MS = 120000;
const SERVER_PLUGIN_VERSION = '2026-06-03-inpaint-v3';

export const info = {
  id: 'auto-illustrator-nai-advanced',
  name: 'Auto Illustrator NovelAI Advanced',
  description:
    'Adds a NovelAI advanced generation route for Auto Illustrator Vibe Transfer.',
};

async function importFromSillyTavern(modulePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), modulePath)).href;
  return import(fileUrl);
}

async function loadSillyTavernInternals() {
  const secrets = await importFromSillyTavern('src/endpoints/secrets.js');
  const util = await importFromSillyTavern('src/util.js');
  return {
    readSecret: secrets.readSecret,
    SECRET_KEYS: secrets.SECRET_KEYS,
    extractFileFromZipBuffer: util.extractFileFromZipBuffer,
  };
}

function calculateSkipCfgAboveSigma(width, height, modelName) {
  const magicConstant = modelName?.includes('nai-diffusion-4-5')
    ? SIGMA_MAGIC_NUMBER_V4_5
    : SIGMA_MAGIC_NUMBER;
  const pixelCount = width * height;
  const ratio = pixelCount / REFERENCE_PIXEL_COUNT;
  return Math.pow(ratio, 0.5) * magicConstant;
}

function isV4Model(modelName) {
  return String(modelName ?? '').includes('nai-diffusion-4');
}

function resolveInpaintingModel(modelName) {
  const model = String(modelName ?? 'nai-diffusion');
  if (model.includes('inpainting')) {
    return model;
  }
  if (model === 'nai-diffusion') {
    return 'nai-diffusion-inpainting';
  }
  return `${model.replace('-preview', '')}-inpainting`;
}

function normalizeBase64Image(image) {
  if (typeof image !== 'string') {
    return '';
  }

  const trimmed = image.trim();
  const commaIndex = trimmed.indexOf(',');
  const payload =
    trimmed.startsWith('data:') && commaIndex >= 0
      ? trimmed.slice(commaIndex + 1)
      : trimmed;
  return payload.replace(/\s+/g, '');
}

function createRequestId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function summarizeInpaintRequest(body, routeRequestId) {
  const {parameters} = body;
  return {
    requestId: routeRequestId,
    action: body.action,
    model: body.model,
    width: parameters.width,
    height: parameters.height,
    steps: parameters.steps,
    sampler: parameters.sampler,
    scheduler: parameters.noise_schedule,
    strength: parameters.strength,
    noise: parameters.noise,
    color_correct: parameters.img2img?.color_correct,
    imageLength: parameters.image?.length ?? 0,
    maskLength: parameters.mask?.length ?? 0,
    timeoutMs: INPAINT_TIMEOUT_MS,
  };
}

async function readNovelAiKey(request) {
  const {readSecret, SECRET_KEYS} = await loadSillyTavernInternals();
  return readSecret(request.user.directories, SECRET_KEYS.NOVEL) || '';
}

function buildNovelAiRequestBody(requestBody, references) {
  const prompt = requestBody.prompt ?? '';
  const model = requestBody.model ?? 'nai-diffusion';
  const width = requestBody.width ?? 512;
  const height = requestBody.height ?? 512;
  const negativePrompt = requestBody.negative_prompt ?? '';
  const parameters = {
    params_version: 3,
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
    add_original_image: false,
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
    reference_image_multiple: references,
    reference_strength_multiple: requestBody.reference_strength_multiple ?? [],
    v4_negative_prompt: {
      caption: {
        base_caption: negativePrompt,
        char_captions: [],
      },
    },
    v4_prompt: {
      caption: {
        base_caption: prompt,
        char_captions: [],
      },
      use_coords: false,
      use_order: true,
    },
  };

  if (!isV4Model(model)) {
    parameters.reference_information_extracted_multiple =
      requestBody.reference_information_extracted_multiple ?? [];
  }

  return {
    action: 'generate',
    input: prompt,
    model,
    parameters,
  };
}

function buildNovelAiInpaintRequestBody(requestBody) {
  const prompt = requestBody.prompt ?? '';
  const model = resolveInpaintingModel(requestBody.model);
  const width = requestBody.width ?? 512;
  const height = requestBody.height ?? 512;
  const negativePrompt = requestBody.negative_prompt ?? '';
  const seed =
    requestBody.seed >= 0
      ? requestBody.seed
      : Math.floor(Math.random() * 9999999999);
  const extraNoiseSeed =
    requestBody.extra_noise_seed >= 0
      ? requestBody.extra_noise_seed
      : seed;
  const strength = requestBody.strength ?? 0.6;
  const noise = requestBody.noise ?? 0;
  const parameters = {
    params_version: 3,
    prefer_brownian: true,
    negative_prompt: negativePrompt,
    height,
    width,
    scale: requestBody.scale ?? 9,
    seed,
    sampler: requestBody.sampler ?? 'k_dpmpp_2m',
    noise_schedule: requestBody.scheduler ?? 'karras',
    steps: requestBody.steps ?? 28,
    n_samples: 1,
    ucPreset: 0,
    qualityToggle: false,
    add_original_image: true,
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
    v4_negative_prompt: {
      caption: {
        base_caption: negativePrompt,
        char_captions: [],
      },
    },
    v4_prompt: {
      caption: {
        base_caption: prompt,
        char_captions: [],
      },
      use_coords: false,
      use_order: true,
    },
  };

  return {
    action: 'infill',
    input: prompt,
    model,
    parameters,
  };
}

function validateRequestBody(body) {
  const references = body.reference_image_multiple;
  const information = body.reference_information_extracted_multiple;
  const strengths = body.reference_strength_multiple;

  if (typeof body.prompt !== 'string' || body.prompt.trim() === '') {
    return 'prompt is required';
  }

  if (!Array.isArray(references) || references.length === 0) {
    return 'reference_image_multiple must contain at least one image';
  }

  if (!Array.isArray(information) || !Array.isArray(strengths)) {
    return 'reference parameter arrays are required';
  }

  if (
    references.length !== information.length ||
    references.length !== strengths.length
  ) {
    return 'reference parameter arrays must have the same length';
  }

  if (
    !references.every(value => typeof value === 'string' && value.length > 0)
  ) {
    return 'reference images must be non-empty base64 strings';
  }

  return null;
}

function validateInpaintRequestBody(body) {
  if (typeof body.prompt !== 'string' || body.prompt.trim() === '') {
    return 'prompt is required';
  }

  if (typeof body.image !== 'string' || body.image.trim() === '') {
    return 'image is required';
  }

  if (typeof body.mask !== 'string' || body.mask.trim() === '') {
    return 'mask is required';
  }

  const width = Number(body.width);
  const height = Number(body.height);
  if (!Number.isFinite(width) || width <= 0) {
    return 'width must be a positive number';
  }
  if (!Number.isFinite(height) || height <= 0) {
    return 'height must be a positive number';
  }

  const strength = Number(body.strength ?? 0.6);
  if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
    return 'strength must be between 0 and 1';
  }

  return null;
}

function buildUpdatedReferences(requestBody, encodedRecords) {
  const referenceIds = requestBody.reference_image_ids ?? [];
  const sourceFingerprints =
    requestBody.reference_source_fingerprint_multiple ?? [];
  const information =
    requestBody.reference_information_extracted_multiple ?? [];
  const model = requestBody.model ?? 'nai-diffusion';
  const now = Date.now();

  return (requestBody.reference_objects ?? []).map(reference => {
    if (!reference || typeof reference !== 'object') {
      return reference;
    }
    const index = referenceIds.indexOf(reference.id);
    if (index < 0) {
      return reference;
    }
    const encoded = encodedRecords[index];
    if (!encoded) {
      return reference;
    }
    const cacheEntry = {
      model,
      informationExtracted:
        typeof information[index] === 'number' ? information[index] : 1,
      sourceFingerprint: sourceFingerprints[index] ?? '',
      encoded,
      createdAt: now,
    };
    const previousCaches = Array.isArray(reference.encodedVibes)
      ? reference.encodedVibes.filter(
          cache =>
            !(
              cache.model === cacheEntry.model &&
              cache.informationExtracted === cacheEntry.informationExtracted &&
              cache.sourceFingerprint === cacheEntry.sourceFingerprint
            )
        )
      : [];
    return {
      ...reference,
      encodedVibes: [cacheEntry, ...previousCaches].slice(
        0,
        MAX_ENCODED_CACHE_PER_REFERENCE
      ),
    };
  });
}

async function encodeVibeReferences(requestBody, key) {
  const references = requestBody.reference_image_multiple ?? [];
  const encodedVibes = requestBody.reference_encoded_vibe_multiple ?? [];
  const information =
    requestBody.reference_information_extracted_multiple ?? [];
  const model = requestBody.model ?? 'nai-diffusion';

  if (!isV4Model(model)) {
    return {
      references: references.map(normalizeBase64Image),
      encodedRecords: [],
      updatedReferences: null,
    };
  }

  const encodedReferences = [];
  const encodedRecords = [];
  for (let index = 0; index < references.length; index++) {
    if (typeof encodedVibes[index] === 'string' && encodedVibes[index]) {
      encodedReferences.push(encodedVibes[index]);
      encodedRecords[index] = null;
      continue;
    }

    const image = normalizeBase64Image(references[index]);
    const informationExtracted =
      typeof information[index] === 'number' ? information[index] : 1;
    const encodeResult = await fetch(`${IMAGE_NOVELAI}/ai/encode-vibe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image,
        model,
        information_extracted: informationExtracted,
      }),
    });

    if (!encodeResult.ok) {
      const text = await encodeResult.text();
      throw new Error(
        `NovelAI vibe encoding failed: ${encodeResult.status} ${text}`
      );
    }

    const encodedBuffer = await encodeResult.arrayBuffer();
    const encoded = Buffer.from(encodedBuffer).toString('base64');
    encodedReferences.push(encoded);
    encodedRecords[index] = encoded;
  }

  return {
    references: encodedReferences,
    encodedRecords,
    updatedReferences: encodedRecords.some(Boolean)
      ? buildUpdatedReferences(requestBody, encodedRecords)
      : null,
  };
}

async function generateBase64Image(requestBody, key) {
  const {extractFileFromZipBuffer} = await loadSillyTavernInternals();
  const encodedResult = await encodeVibeReferences(requestBody, key);
  const generateResult = await fetch(`${IMAGE_NOVELAI}/ai/generate-image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      buildNovelAiRequestBody(requestBody, encodedResult.references)
    ),
  });

  if (!generateResult.ok) {
    const text = await generateResult.text();
    throw new Error(
      `NovelAI image generation failed: ${generateResult.status} ${text}`
    );
  }

  const archiveBuffer = await generateResult.arrayBuffer();
  const imageBuffer = await extractFileFromZipBuffer(archiveBuffer, '.png');

  if (!imageBuffer) {
    throw new Error('NovelAI response did not contain a PNG file');
  }

  return {
    image: Buffer.from(imageBuffer).toString('base64'),
    updatedReferences: encodedResult.updatedReferences,
  };
}

async function generateBase64InpaintImage(requestBody, key, routeRequestId) {
  const {extractFileFromZipBuffer} = await loadSillyTavernInternals();
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), INPAINT_TIMEOUT_MS);
  const body = buildNovelAiInpaintRequestBody(requestBody);
  const summary = summarizeInpaintRequest(body, routeRequestId);
  console.info('[auto-illustrator] NovelAI inpaint request', summary);

  let generateResult;
  let upstreamErrorLogged = false;
  try {
    generateResult = await fetch(`${IMAGE_NOVELAI}/ai/generate-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!generateResult.ok) {
      const text = await generateResult.text();
      upstreamErrorLogged = true;
      console.error('[auto-illustrator] NovelAI inpaint response failed', {
        requestId: routeRequestId,
        elapsedMs: Date.now() - startedAt,
        status: generateResult.status,
        text,
      });
      throw new Error(
        `NovelAI inpaint generation failed: ${generateResult.status} ${text}`
      );
    }

    const archiveBuffer = await generateResult.arrayBuffer();
    const imageBuffer = await extractFileFromZipBuffer(archiveBuffer, '.png');

    if (!imageBuffer) {
      upstreamErrorLogged = true;
      console.error('[auto-illustrator] NovelAI inpaint response missing PNG', {
        requestId: routeRequestId,
        elapsedMs: Date.now() - startedAt,
      });
      throw new Error('NovelAI inpaint response did not contain a PNG file');
    }

    console.info('[auto-illustrator] NovelAI inpaint response ok', {
      requestId: routeRequestId,
      elapsedMs: Date.now() - startedAt,
      bytes: imageBuffer.length,
    });
    return Buffer.from(imageBuffer).toString('base64');
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    if (!upstreamErrorLogged) {
      console.error('[auto-illustrator] NovelAI inpaint request failed', {
        requestId: routeRequestId,
        elapsedMs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (error?.name === 'AbortError') {
      throw new Error(
        `NovelAI inpaint generation timed out after ${INPAINT_TIMEOUT_MS}ms`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function upscaleBase64Image(requestBody, base64Image, key) {
  const upscaleRatio = Number(requestBody.upscale_ratio ?? 1);
  if (!Number.isFinite(upscaleRatio) || upscaleRatio <= 1) {
    return base64Image;
  }

  const {extractFileFromZipBuffer} = await loadSillyTavernInternals();
  const upscaleResult = await fetch(`${API_NOVELAI}/ai/upscale`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: base64Image,
      height: requestBody.height,
      width: requestBody.width,
      scale: upscaleRatio,
    }),
  });

  if (!upscaleResult.ok) {
    return base64Image;
  }

  const archiveBuffer = await upscaleResult.arrayBuffer();
  const imageBuffer = await extractFileFromZipBuffer(archiveBuffer, '.png');
  return imageBuffer ? Buffer.from(imageBuffer).toString('base64') : base64Image;
}

async function callNovelAi(request, response) {
  const validationError = validateRequestBody(request.body || {});
  if (validationError) {
    response.status(400).json({error: validationError});
    return;
  }

  const key = await readNovelAiKey(request);
  if (!key) {
    response.status(401).json({
      error: 'NovelAI API key is not configured in SillyTavern secrets',
    });
    return;
  }

  const generationResult = await generateBase64Image(request.body, key);
  const finalImage = await upscaleBase64Image(
    request.body,
    generationResult.image,
    key
  );

  response.json({
    format: 'png',
    data: finalImage,
    updatedReferences: generationResult.updatedReferences ?? undefined,
  });
}

async function callNovelAiInpaint(request, response) {
  const validationError = validateInpaintRequestBody(request.body || {});
  if (validationError) {
    response.status(400).json({error: validationError});
    return;
  }

  const key = await readNovelAiKey(request);
  if (!key) {
    response.status(401).json({
      error: 'NovelAI API key is not configured in SillyTavern secrets',
    });
    return;
  }

  const routeRequestId = createRequestId('inpaint');
  const image = await generateBase64InpaintImage(
    request.body,
    key,
    routeRequestId
  );
  response.json({
    format: 'png',
    data: image,
  });
}

export async function init(router) {
  router.use(express.json({limit: '50mb'}));

  router.get('/status', (_request, response) => {
    response.json({
      ok: true,
      plugin: info.id,
      version: SERVER_PLUGIN_VERSION,
      features: ['vibe-transfer', 'inpaint'],
    });
  });

  router.post('/generate-image', (request, response) => {
    callNovelAi(request, response).catch(error => {
      response.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });

  router.post('/generate-inpaint-image', (request, response) => {
    callNovelAiInpaint(request, response).catch(error => {
      response.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
}
