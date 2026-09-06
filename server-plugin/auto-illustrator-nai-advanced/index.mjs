import {Buffer} from 'node:buffer';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

import express from 'express';
import fetch from 'node-fetch';

import {
  hasVibeSource,
  listVibeSourceHashes,
  pruneVibeSources,
  readVibeSource,
  readVibeSourceBase64,
  storeVibeSource,
} from './vibe_source_store.mjs';
import {
  validatePresetMetadata,
  validateRequestBody,
} from './request_validation.mjs';
import {
  buildNovelAiInpaintRequestBody,
  buildNovelAiRequestBody,
  isV4Model,
  normalizeBase64Image,
} from './novelai_request.mjs';

const IMAGE_NOVELAI = 'https://image.novelai.net';
const API_NOVELAI = 'https://api.novelai.net';
const MAX_ENCODED_CACHE_PER_REFERENCE = 8;
const INPAINT_TIMEOUT_MS = 120000;
const SERVER_PLUGIN_VERSION = '2026-09-06-nai-presets-v1';

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

function validateInpaintRequestBody(body) {
  const presetError = validatePresetMetadata(body);
  if (presetError) return presetError;

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

/**
 * Resolves the base64 source image for a reference, preferring the inline
 * payload but falling back to the content-addressed on-disk store when the
 * frontend only sent a source hash (the new slim settings format).
 * @param {{files?: string}} directories
 * @param {unknown} inlineImage
 * @param {unknown} sourceHash
 * @returns {string} normalized base64, or '' when neither is usable
 */
function resolveReferenceSourceImage(directories, inlineImage, sourceHash) {
  const inline = normalizeBase64Image(inlineImage);
  if (inline) {
    return inline;
  }
  if (directories && sourceHash) {
    return readVibeSourceBase64(directories, sourceHash) ?? '';
  }
  return '';
}

async function encodeVibeReferences(requestBody, key, directories) {
  const references = requestBody.reference_image_multiple ?? [];
  const encodedVibes = requestBody.reference_encoded_vibe_multiple ?? [];
  const sourceHashes = requestBody.reference_source_hash_multiple ?? [];
  const information =
    requestBody.reference_information_extracted_multiple ?? [];
  const model = requestBody.model ?? 'nai-diffusion';

  if (!isV4Model(model)) {
    return {
      references: references
        .map((image, index) =>
          resolveReferenceSourceImage(directories, image, sourceHashes[index])
        )
        .filter(image => image.length > 0),
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

    const image = resolveReferenceSourceImage(
      directories,
      references[index],
      sourceHashes[index]
    );
    if (!image) {
      throw new Error(
        `Vibe reference ${index + 1} has no source image or encoded vibe`
      );
    }
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

async function generateBase64Image(requestBody, key, directories) {
  const {extractFileFromZipBuffer} = await loadSillyTavernInternals();
  const encodedResult = await encodeVibeReferences(
    requestBody,
    key,
    directories
  );
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
  return imageBuffer
    ? Buffer.from(imageBuffer).toString('base64')
    : base64Image;
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

  const generationResult = await generateBase64Image(
    request.body,
    key,
    request.user?.directories
  );
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

  // Stores one or more Vibe Transfer source images on disk and returns their
  // content hashes, so the frontend can drop the inline base64 from settings.
  router.post('/vibe-source', (request, response) => {
    try {
      const directories = request.user?.directories;
      if (!directories) {
        response.status(401).json({error: 'user directories unavailable'});
        return;
      }
      const images = Array.isArray(request.body?.images)
        ? request.body.images
        : [];
      if (images.length === 0) {
        response.status(400).json({error: 'images array is required'});
        return;
      }
      const hashes = images.map(image => storeVibeSource(directories, image));
      response.json({hashes});
    } catch (error) {
      response.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Returns a stored source image as raw bytes for UI thumbnails and re-encode.
  router.get('/vibe-source/:hash', (request, response) => {
    try {
      const directories = request.user?.directories;
      if (!directories) {
        response.status(401).json({error: 'user directories unavailable'});
        return;
      }
      const source = readVibeSource(directories, request.params.hash);
      if (!source) {
        response.status(404).json({error: 'source not found'});
        return;
      }
      response.setHeader('Content-Type', source.mimeType);
      response.setHeader(
        'Cache-Control',
        'private, max-age=31536000, immutable'
      );
      response.send(source.buffer);
    } catch (error) {
      response.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Reports which of the requested hashes exist on disk, so the frontend can
  // decide whether it still needs to upload a source before dropping inline data.
  router.post('/vibe-source/check', (request, response) => {
    try {
      const directories = request.user?.directories;
      if (!directories) {
        response.status(401).json({error: 'user directories unavailable'});
        return;
      }
      const hashes = Array.isArray(request.body?.hashes)
        ? request.body.hashes
        : [];
      const present = hashes.filter(hash => hasVibeSource(directories, hash));
      response.json({present});
    } catch (error) {
      response.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Deletes stored sources no longer referenced by any settings entry. The
  // frontend sends the full set of hashes it still uses; everything else is
  // removed. Passing an empty keep set is rejected to avoid accidental wipes.
  router.post('/vibe-source/prune', (request, response) => {
    try {
      const directories = request.user?.directories;
      if (!directories) {
        response.status(401).json({error: 'user directories unavailable'});
        return;
      }
      const keep = Array.isArray(request.body?.keep) ? request.body.keep : null;
      if (!keep || keep.length === 0) {
        response.status(400).json({error: 'non-empty keep array is required'});
        return;
      }
      const removed = pruneVibeSources(directories, keep);
      response.json({
        removed,
        remaining: listVibeSourceHashes(directories).length,
      });
    } catch (error) {
      response.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
