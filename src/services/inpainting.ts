import {NAI_IMAGE_EDIT} from '../constants';
import {createLogger} from '../logger';
import {getInternalRequestHeaders} from '../utils/api';
import {AutoIllustratorError, extractErrorMessage} from '../utils/error_utils';
import {
  buildNovelAiBasePayload,
  combinePrefixes,
  normalizeBase64Image,
  type NovelAiBasePayload,
  type NovelAiImageRouteResponse,
  saveBase64AsFile,
} from './novelai_common';

const logger = createLogger('Inpainting');

export interface NovelAiInpaintPayload extends NovelAiBasePayload {
  image: string;
  mask: string;
  strength: number;
  color_correct: boolean;
}

export interface InpaintGenerationInput {
  prompt: string;
  baseImageDataUrl: string;
  maskDataUrl: string;
  width: number;
  height: number;
  strength: number;
  colorCorrect?: boolean;
  negativePrompt?: string;
}

export interface InpaintGenerationResponse {
  data: string;
  format: string;
}

async function readErrorResponse(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return String(response.status);
  }

  try {
    const data = JSON.parse(text) as {error?: unknown};
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error;
    }
  } catch {
    // Fall back to raw response text below.
  }

  return text;
}

function clampStrength(value: number): number {
  if (!Number.isFinite(value)) {
    return NAI_IMAGE_EDIT.DEFAULT_INPAINTING_STRENGTH;
  }
  return Math.max(
    NAI_IMAGE_EDIT.MIN_STRENGTH,
    Math.min(NAI_IMAGE_EDIT.MAX_STRENGTH, value)
  );
}

export function buildNovelAiInpaintPayload(
  input: InpaintGenerationInput,
  context: SillyTavernContext
): NovelAiInpaintPayload {
  const image = normalizeBase64Image(input.baseImageDataUrl);
  const mask = normalizeBase64Image(input.maskDataUrl);

  if (!image) {
    throw new AutoIllustratorError(
      'image-empty-response',
      'Inpaint base image is empty'
    );
  }

  if (!mask) {
    throw new AutoIllustratorError(
      'image-empty-response',
      'Inpaint mask is empty'
    );
  }

  if (
    !Number.isFinite(input.width) ||
    !Number.isFinite(input.height) ||
    input.width <= 0 ||
    input.height <= 0
  ) {
    throw new AutoIllustratorError(
      'image-request-failed',
      'Invalid inpaint canvas dimensions'
    );
  }

  const basePayload = buildNovelAiBasePayload(input.prompt, context, {
    width: Math.round(input.width),
    height: Math.round(input.height),
  });
  const extraNegative = input.negativePrompt?.trim();

  return {
    ...basePayload,
    steps: Math.min(basePayload.steps, NAI_IMAGE_EDIT.MAX_INPAINTING_STEPS),
    negative_prompt: extraNegative
      ? combinePrefixes(basePayload.negative_prompt, extraNegative)
      : basePayload.negative_prompt,
    image,
    mask,
    strength: clampStrength(input.strength),
    color_correct: input.colorCorrect ?? true,
  };
}

async function requestNovelAiInpaintImage(
  input: InpaintGenerationInput,
  context: SillyTavernContext,
  signal?: AbortSignal
): Promise<NovelAiImageRouteResponse> {
  const payload = buildNovelAiInpaintPayload(input, context);

  logger.debug('Calling NovelAI inpaint route');
  const response = await fetch(NAI_IMAGE_EDIT.INPAINT_ROUTE, {
    method: 'POST',
    headers: await getInternalRequestHeaders(),
    signal,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await readErrorResponse(response);
    const code =
      response.status === 404
        ? 'image-advanced-backend-unavailable'
        : 'image-request-failed';
    throw new AutoIllustratorError(
      code,
      'NovelAI inpaint generation failed',
      detail || String(response.status)
    );
  }

  let result: NovelAiImageRouteResponse;
  try {
    result = (await response.json()) as NovelAiImageRouteResponse;
  } catch (error) {
    throw new AutoIllustratorError(
      'image-request-failed',
      'NovelAI inpaint route returned invalid JSON',
      extractErrorMessage(error)
    );
  }

  return result;
}

export async function generateNovelAiInpaintBase64(
  input: InpaintGenerationInput,
  context: SillyTavernContext,
  signal?: AbortSignal
): Promise<InpaintGenerationResponse> {
  const result = await requestNovelAiInpaintImage(input, context, signal);
  const data = result.data ?? result.image;
  if (!data) {
    throw new AutoIllustratorError(
      'image-empty-response',
      'NovelAI inpaint route returned no image'
    );
  }

  return {
    data,
    format: result.format || 'png',
  };
}

export async function generateNovelAiInpaintImage(
  input: InpaintGenerationInput,
  context: SillyTavernContext,
  signal?: AbortSignal
): Promise<string> {
  const result = await generateNovelAiInpaintBase64(input, context, signal);

  return saveBase64AsFile(result.data, context, result.format);
}
