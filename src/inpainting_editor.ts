import {NAI_IMAGE_EDIT} from './constants';
import {t} from './i18n';
import {createLogger} from './logger';
import {
  applyCharacterFixedTags,
  resolveActiveCharacterFixedTags,
} from './services/character_fixed_tags_service';
import {generateNovelAiInpaintBase64} from './services/inpainting';
import {
  normalizeBase64Image,
  saveBase64AsFile,
} from './services/novelai_common';
import {applyCommonTags} from './services/prompt_tags';
import {getUserFacingErrorReason} from './utils/error_utils';

const logger = createLogger('InpaintEditor');

export type InpaintingInsertionMode = 'append-after-image' | 'replace-image';

export interface InpaintingEditorOptions {
  imageUrl: string;
  promptText: string;
  messageText: string;
  context: SillyTavernContext;
  settings: AutoIllustratorSettings;
}

export interface InpaintingEditorResult {
  imageUrl: string;
  promptText: string;
  insertionMode: InpaintingInsertionMode;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ColorOffset {
  r: number;
  g: number;
  b: number;
}

interface PendingInpaintPreview {
  dataUrl: string;
  format: string;
  promptText: string;
  insertionMode: InpaintingInsertionMode;
}

function readNumberInput(input: HTMLInputElement, fallback: number): number {
  const value = Number.parseInt(input.value, 10);
  return Number.isFinite(value) ? value : fallback;
}

function readFloatInput(input: HTMLInputElement, fallback: number): number {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function dataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageDataUrl(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:image/')) {
    return imageUrl;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.status}`);
  }
  return dataUrlFromBlob(await response.blob());
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image'));
    image.src = dataUrl;
  });
}

function setCanvasSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): void {
  canvas.width = width;
  canvas.height = height;
}

function hasMaskPixels(maskCanvas: HTMLCanvasElement): boolean {
  const ctx = maskCanvas.getContext('2d');
  if (!ctx) {
    return false;
  }
  const data = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) {
      return true;
    }
  }
  return false;
}

function findMaskBounds(maskCanvas: HTMLCanvasElement): CropRect | null {
  const ctx = maskCanvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  const {width, height} = maskCanvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 0) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function exportMaskDataUrl(maskCanvas: HTMLCanvasElement): string {
  const exportCanvas = document.createElement('canvas');
  setCanvasSize(exportCanvas, maskCanvas.width, maskCanvas.height);
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot export mask');
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ctx.drawImage(maskCanvas, 0, 0);
  return exportCanvas.toDataURL('image/png');
}

function chooseFocusedCropSize(required: number, max: number): number {
  const step = NAI_IMAGE_EDIT.FOCUSED_DIMENSION_STEP;
  const stepped = Math.ceil(required / step) * step;
  return clampInt(Math.max(NAI_IMAGE_EDIT.FOCUSED_MIN_SIZE, stepped), 1, max);
}

function buildFocusedCropRect(maskCanvas: HTMLCanvasElement): CropRect | null {
  const bounds = findMaskBounds(maskCanvas);
  if (!bounds) {
    return null;
  }

  const contextPx = NAI_IMAGE_EDIT.FOCUSED_CONTEXT_PX;
  const cropWidth = chooseFocusedCropSize(
    bounds.width + contextPx * 2,
    maskCanvas.width
  );
  const cropHeight = chooseFocusedCropSize(
    bounds.height + contextPx * 2,
    maskCanvas.height
  );
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const x = clampInt(
    centerX - cropWidth / 2,
    0,
    Math.max(0, maskCanvas.width - cropWidth)
  );
  const y = clampInt(
    centerY - cropHeight / 2,
    0,
    Math.max(0, maskCanvas.height - cropHeight)
  );
  const fullArea = maskCanvas.width * maskCanvas.height;
  const cropArea = cropWidth * cropHeight;

  if (cropWidth >= maskCanvas.width && cropHeight >= maskCanvas.height) {
    return null;
  }

  if (cropArea / fullArea > NAI_IMAGE_EDIT.FOCUSED_MAX_FULL_CANVAS_RATIO) {
    return null;
  }

  return {
    x,
    y,
    width: cropWidth,
    height: cropHeight,
  };
}

function cropImageDataUrl(image: HTMLImageElement, rect: CropRect): string {
  const crop = document.createElement('canvas');
  setCanvasSize(crop, rect.width, rect.height);
  const ctx = crop.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot crop image');
  }
  ctx.drawImage(
    image,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height
  );
  return crop.toDataURL('image/png');
}

function cropMaskCanvas(
  maskCanvas: HTMLCanvasElement,
  rect: CropRect
): HTMLCanvasElement {
  const crop = document.createElement('canvas');
  setCanvasSize(crop, rect.width, rect.height);
  const ctx = crop.getContext('2d');
  if (!ctx) {
    return maskCanvas;
  }
  ctx.drawImage(
    maskCanvas,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height
  );
  return crop;
}

function imageDataUrlFromBase64(base64: string, format: string): string {
  const normalizedFormat = format === 'jpg' ? 'jpeg' : format || 'png';
  return `data:image/${normalizedFormat};base64,${base64}`;
}

function getDataUrlImageFormat(dataUrl: string, fallback: string): string {
  const match = /^data:image\/([^;,]+)/i.exec(dataUrl);
  const format = match?.[1]?.toLowerCase();
  if (format === 'jpeg') {
    return 'jpg';
  }
  return format || fallback || 'png';
}

function buildPaddedMaskCanvas(
  maskCanvas: HTMLCanvasElement,
  paddingPx: number
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  setCanvasSize(out, maskCanvas.width, maskCanvas.height);
  const ctx = out.getContext('2d');
  if (!ctx) {
    return maskCanvas;
  }

  const radius = clampInt(paddingPx, 0, NAI_IMAGE_EDIT.MAX_MASK_PADDING_PX);
  if (radius <= 0) {
    ctx.drawImage(maskCanvas, 0, 0);
    return out;
  }

  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.filter = 'none';

  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] > 8 ? 255 : 0;
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = alpha;
  }
  ctx.putImageData(imageData, 0, 0);

  return out;
}

function buildFeatheredMaskCanvas(
  maskCanvas: HTMLCanvasElement,
  featherPx: number
): HTMLCanvasElement {
  if (featherPx <= 0) {
    const out = document.createElement('canvas');
    setCanvasSize(out, maskCanvas.width, maskCanvas.height);
    const ctx = out.getContext('2d');
    if (!ctx) {
      return maskCanvas;
    }
    ctx.drawImage(maskCanvas, 0, 0);
    return out;
  }

  const out = document.createElement('canvas');
  setCanvasSize(out, maskCanvas.width, maskCanvas.height);
  const ctx = out.getContext('2d');
  if (!ctx) {
    return maskCanvas;
  }

  const feather = clampInt(
    featherPx,
    NAI_IMAGE_EDIT.MIN_MASK_FEATHER_PX,
    NAI_IMAGE_EDIT.MAX_MASK_FEATHER_PX
  );
  ctx.filter = `blur(${feather}px)`;
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return out;
}

function buildEdgeGuardMaskCanvas(
  maskCanvas: HTMLCanvasElement,
  edgeGuardPx: number
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  setCanvasSize(out, maskCanvas.width, maskCanvas.height);
  const outCtx = out.getContext('2d');
  const maskCtx = maskCanvas.getContext('2d');
  if (!outCtx || !maskCtx) {
    return maskCanvas;
  }

  const guardPx = clampInt(
    edgeGuardPx,
    NAI_IMAGE_EDIT.MIN_MASK_EDGE_GUARD_PX,
    NAI_IMAGE_EDIT.MAX_MASK_EDGE_GUARD_PX
  );
  if (guardPx <= 0) {
    outCtx.drawImage(maskCanvas, 0, 0);
    return out;
  }

  const {width, height} = maskCanvas;
  const source = maskCtx.getImageData(0, 0, width, height);
  const pixelCount = width * height;
  const inf = 65535;
  const dist = new Uint16Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    dist[i] = source.data[i * 4 + 3] > 0 ? inf : 0;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let best = dist[idx];
      if (x > 0) best = Math.min(best, dist[idx - 1] + 10);
      if (y > 0) best = Math.min(best, dist[idx - width] + 10);
      if (x > 0 && y > 0) best = Math.min(best, dist[idx - width - 1] + 14);
      if (x + 1 < width && y > 0) {
        best = Math.min(best, dist[idx - width + 1] + 14);
      }
      dist[idx] = best;
    }
  }

  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = y * width + x;
      let best = dist[idx];
      if (x + 1 < width) best = Math.min(best, dist[idx + 1] + 10);
      if (y + 1 < height) best = Math.min(best, dist[idx + width] + 10);
      if (x + 1 < width && y + 1 < height) {
        best = Math.min(best, dist[idx + width + 1] + 14);
      }
      if (x > 0 && y + 1 < height) {
        best = Math.min(best, dist[idx + width - 1] + 14);
      }
      dist[idx] = best;
    }
  }

  const output = outCtx.createImageData(width, height);
  const threshold = guardPx * 10;
  for (let i = 0; i < pixelCount; i++) {
    const sourceOffset = i * 4;
    const keep = source.data[sourceOffset + 3] > 0 && dist[i] >= threshold;
    output.data[sourceOffset] = 255;
    output.data[sourceOffset + 1] = 255;
    output.data[sourceOffset + 2] = 255;
    output.data[sourceOffset + 3] = keep ? 255 : 0;
  }
  outCtx.putImageData(output, 0, 0);
  if (!hasMaskPixels(out)) {
    outCtx.clearRect(0, 0, width, height);
    outCtx.drawImage(maskCanvas, 0, 0);
  }
  return out;
}

function buildMaskRingCanvas(
  maskCanvas: HTMLCanvasElement,
  paddingPx: number
): HTMLCanvasElement {
  const ring = buildPaddedMaskCanvas(maskCanvas, paddingPx);
  const ctx = ring.getContext('2d');
  if (!ctx) {
    return ring;
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return ring;
}

function calculateEdgeColorOffset(
  baseData: Uint8ClampedArray,
  resultData: Uint8ClampedArray,
  ringData: Uint8ClampedArray
): ColorOffset | null {
  let samples = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (let i = 0; i < ringData.length; i += 4) {
    if (ringData[i + 3] <= 0) {
      continue;
    }
    r += baseData[i] - resultData[i];
    g += baseData[i + 1] - resultData[i + 1];
    b += baseData[i + 2] - resultData[i + 2];
    samples++;
  }

  if (samples < 32) {
    return null;
  }

  return {
    r: clampInt(r / samples, -48, 48),
    g: clampInt(g / samples, -48, 48),
    b: clampInt(b / samples, -48, 48),
  };
}

function applyEdgeColorMatch(
  baseImage: HTMLImageElement,
  resultImage: HTMLImageElement,
  maskCanvas: HTMLCanvasElement,
  featherPx: number,
  width: number,
  height: number,
  enabled: boolean
): HTMLCanvasElement | null {
  if (!enabled) {
    return null;
  }

  const baseCanvas = document.createElement('canvas');
  const resultCanvas = document.createElement('canvas');
  setCanvasSize(baseCanvas, width, height);
  setCanvasSize(resultCanvas, width, height);
  const baseCtx = baseCanvas.getContext('2d');
  const resultCtx = resultCanvas.getContext('2d');
  if (!baseCtx || !resultCtx) {
    return null;
  }

  baseCtx.drawImage(baseImage, 0, 0, width, height);
  resultCtx.drawImage(resultImage, 0, 0, width, height);

  const baseImageData = baseCtx.getImageData(0, 0, width, height);
  const resultImageData = resultCtx.getImageData(0, 0, width, height);
  const ringPadding = clampInt(Math.max(16, featherPx * 2), 16, 64);
  const ringCtx = buildMaskRingCanvas(maskCanvas, ringPadding).getContext('2d');
  if (!ringCtx) {
    return resultCanvas;
  }

  const offset = calculateEdgeColorOffset(
    baseImageData.data,
    resultImageData.data,
    ringCtx.getImageData(0, 0, width, height).data
  );
  if (!offset) {
    return resultCanvas;
  }

  const edgeMaskData = ringCtx.getImageData(0, 0, width, height).data;
  const data = resultImageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (edgeMaskData[i + 3] <= 0) {
      continue;
    }
    data[i] = clampChannel(data[i] + offset.r);
    data[i + 1] = clampChannel(data[i + 1] + offset.g);
    data[i + 2] = clampChannel(data[i + 2] + offset.b);
  }

  resultCtx.putImageData(resultImageData, 0, 0);
  return resultCanvas;
}

// Blends the redrawn area back onto the true source using a blurred mask as
// alpha, so the masked region fades into the original instead of leaving a hard
// seam.
async function compositeFeatheredResult(
  baseDataUrl: string,
  resultDataUrl: string,
  maskCanvas: HTMLCanvasElement,
  featherPx: number,
  width: number,
  height: number,
  colorMatch: boolean
): Promise<string> {
  const [baseImage, resultImage] = await Promise.all([
    loadImage(baseDataUrl),
    loadImage(resultDataUrl),
  ]);

  const composite = document.createElement('canvas');
  setCanvasSize(composite, width, height);
  const compositeCtx = composite.getContext('2d');
  if (!compositeCtx) {
    return resultDataUrl;
  }
  compositeCtx.drawImage(baseImage, 0, 0, width, height);

  const maskedResult = document.createElement('canvas');
  setCanvasSize(maskedResult, width, height);
  const maskedResultCtx = maskedResult.getContext('2d');
  if (!maskedResultCtx) {
    return resultDataUrl;
  }
  maskedResultCtx.drawImage(
    applyEdgeColorMatch(
      baseImage,
      resultImage,
      maskCanvas,
      featherPx,
      width,
      height,
      colorMatch
    ) ?? resultImage,
    0,
    0,
    width,
    height
  );
  maskedResultCtx.globalCompositeOperation = 'destination-in';
  maskedResultCtx.drawImage(
    buildFeatheredMaskCanvas(maskCanvas, featherPx),
    0,
    0
  );

  compositeCtx.drawImage(maskedResult, 0, 0);
  return composite.toDataURL('image/png');
}

async function composeCropResult(
  baseDataUrl: string,
  cropResultDataUrl: string,
  cropRect: CropRect,
  width: number,
  height: number
): Promise<string> {
  const [baseImage, cropImage] = await Promise.all([
    loadImage(baseDataUrl),
    loadImage(cropResultDataUrl),
  ]);
  const composite = document.createElement('canvas');
  setCanvasSize(composite, width, height);
  const ctx = composite.getContext('2d');
  if (!ctx) {
    return cropResultDataUrl;
  }
  ctx.drawImage(baseImage, 0, 0, width, height);
  ctx.drawImage(
    cropImage,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height
  );
  return composite.toDataURL('image/png');
}

async function buildBlendedInpaintDataUrl(
  resultDataUrl: string,
  baseDataUrl: string,
  maskCanvas: HTMLCanvasElement,
  featherPx: number,
  width: number,
  height: number,
  colorMatch: boolean
): Promise<string> {
  try {
    return await compositeFeatheredResult(
      baseDataUrl,
      resultDataUrl,
      maskCanvas,
      featherPx,
      width,
      height,
      colorMatch
    );
  } catch (error) {
    logger.warn('Feather blend failed; using raw inpaint result', error);
    return resultDataUrl;
  }
}

async function savePreviewAsResult(
  preview: PendingInpaintPreview,
  context: SillyTavernContext
): Promise<InpaintingEditorResult> {
  const base64 = normalizeBase64Image(preview.dataUrl);
  if (!base64) {
    throw new Error('Cannot save inpaint result');
  }
  const imageUrl = await saveBase64AsFile(base64, context, preview.format);
  return {
    imageUrl,
    promptText: preview.promptText,
    insertionMode: preview.insertionMode,
  };
}

function createLabeledInput(
  labelText: string,
  input: HTMLInputElement,
  hint?: HTMLElement
): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'ai-inpaint-field';
  const span = document.createElement('span');
  span.textContent = labelText;
  label.append(span, input);
  if (hint) {
    label.append(hint);
  }
  return label;
}

function createNumberInput(
  value: number,
  min: number,
  max: number
): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.step = '1';
  return input;
}

function createCheckboxField(
  labelText: string,
  checked: boolean
): {label: HTMLLabelElement; input: HTMLInputElement} {
  const label = document.createElement('label');
  label.className = 'ai-inpaint-field ai-inpaint-checkbox-field';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  const span = document.createElement('span');
  span.textContent = labelText;
  label.append(input, span);
  return {label, input};
}

function enhancePromptForInpaint(
  promptText: string,
  messageText: string,
  settings: AutoIllustratorSettings,
  context: SillyTavernContext
): string {
  const characterPrompt = applyCharacterFixedTags(
    promptText,
    messageText,
    resolveActiveCharacterFixedTags(settings.characterFixedTagScopes, context)
      .entries,
    settings.characterFixedTagInjectionMode
  );
  return applyCommonTags(
    characterPrompt,
    settings.commonStyleTags,
    settings.commonStyleTagsPosition
  );
}

export async function openInpaintingEditor(
  options: InpaintingEditorOptions
): Promise<InpaintingEditorResult | null> {
  const baseDataUrl = await fetchImageDataUrl(options.imageUrl);
  const baseImage = await loadImage(baseDataUrl);
  const currentBaseDataUrl = baseDataUrl;

  return new Promise<InpaintingEditorResult | null>(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'ai-inpaint-dialog';

    const header = document.createElement('div');
    header.className = 'ai-inpaint-header';
    const title = document.createElement('strong');
    title.textContent = t('inpaint.title');
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'menu_button ai-inpaint-close';
    closeButton.textContent = t('modal.close');
    header.append(title, closeButton);

    const body = document.createElement('div');
    body.className = 'ai-inpaint-body';

    const canvasColumn = document.createElement('div');
    canvasColumn.className = 'ai-inpaint-canvas-column';
    const canvasPanel = document.createElement('div');
    canvasPanel.className = 'ai-inpaint-canvas-panel';
    const canvas = document.createElement('canvas');
    canvas.className = 'ai-inpaint-canvas';
    const previewImage = document.createElement('img');
    previewImage.className = 'ai-inpaint-preview-image';
    previewImage.alt = t('inpaint.previewAlt');
    previewImage.hidden = true;
    const maskCanvas = document.createElement('canvas');
    setCanvasSize(
      canvas,
      baseImage.naturalWidth || baseImage.width,
      baseImage.naturalHeight || baseImage.height
    );
    setCanvasSize(maskCanvas, canvas.width, canvas.height);
    canvasPanel.append(canvas, previewImage);
    const quickControls = document.createElement('div');
    quickControls.className = 'ai-inpaint-quick-controls';
    canvasColumn.append(canvasPanel, quickControls);

    const controls = document.createElement('div');
    controls.className = 'ai-inpaint-controls';

    const promptLabel = document.createElement('label');
    promptLabel.className = 'ai-inpaint-field ai-inpaint-prompt-field';
    const promptSpan = document.createElement('span');
    promptSpan.textContent = t('dialog.currentPrompt');
    const promptTextarea = document.createElement('textarea');
    promptTextarea.value = options.promptText;
    promptTextarea.rows = 4;
    const promptHint = document.createElement('small');
    promptHint.textContent = t('inpaint.promptHint');
    promptLabel.append(promptSpan, promptTextarea, promptHint);

    const negativeLabel = document.createElement('label');
    negativeLabel.className = 'ai-inpaint-field ai-inpaint-prompt-field';
    const negativeSpan = document.createElement('span');
    negativeSpan.textContent = t('inpaint.negativePrompt');
    const negativeTextarea = document.createElement('textarea');
    negativeTextarea.rows = 2;
    negativeTextarea.placeholder = t('inpaint.negativePromptPlaceholder');
    const negativeHint = document.createElement('small');
    negativeHint.textContent = t('inpaint.negativePromptHint');
    negativeLabel.append(negativeSpan, negativeTextarea, negativeHint);

    const parameterGuide = document.createElement('div');
    parameterGuide.className = 'ai-inpaint-parameter-guide';
    const parameterGuideTitle = document.createElement('strong');
    parameterGuideTitle.textContent = t('inpaint.parameterGuideTitle');
    const parameterGuideText = document.createElement('span');
    parameterGuideText.textContent = t('inpaint.parameterGuideText');
    parameterGuide.append(parameterGuideTitle, parameterGuideText);

    const brushInput = createNumberInput(36, 1, 256);
    const brushHint = document.createElement('small');
    brushHint.textContent = t('inpaint.brushSizeHint');
    const zoomInput = createNumberInput(
      100,
      NAI_IMAGE_EDIT.MIN_ZOOM_PERCENT,
      NAI_IMAGE_EDIT.MAX_ZOOM_PERCENT
    );
    zoomInput.step = String(NAI_IMAGE_EDIT.ZOOM_STEP_PERCENT);
    const zoomHint = document.createElement('small');
    zoomHint.textContent = t('inpaint.zoomHint');
    const paddingInput = createNumberInput(
      NAI_IMAGE_EDIT.DEFAULT_MASK_PADDING_PX,
      NAI_IMAGE_EDIT.MIN_MASK_PADDING_PX,
      NAI_IMAGE_EDIT.MAX_MASK_PADDING_PX
    );
    const paddingHint = document.createElement('small');
    paddingHint.textContent = t('inpaint.maskPaddingHint');
    const featherInput = createNumberInput(
      NAI_IMAGE_EDIT.DEFAULT_MASK_FEATHER_PX,
      NAI_IMAGE_EDIT.MIN_MASK_FEATHER_PX,
      NAI_IMAGE_EDIT.MAX_MASK_FEATHER_PX
    );
    const featherHint = document.createElement('small');
    featherHint.textContent = t('inpaint.maskFeatherHint');
    const edgeGuardInput = createNumberInput(
      NAI_IMAGE_EDIT.DEFAULT_MASK_EDGE_GUARD_PX,
      NAI_IMAGE_EDIT.MIN_MASK_EDGE_GUARD_PX,
      NAI_IMAGE_EDIT.MAX_MASK_EDGE_GUARD_PX
    );
    const edgeGuardHint = document.createElement('small');
    edgeGuardHint.textContent = t('inpaint.maskEdgeGuardHint');
    const colorMatchField = createCheckboxField(t('inpaint.colorMatch'), false);
    const colorMatchHint = document.createElement('small');
    colorMatchHint.textContent = t('inpaint.colorMatchHint');
    colorMatchField.label.append(colorMatchHint);
    const strengthInput = document.createElement('input');
    strengthInput.type = 'range';
    strengthInput.min = String(NAI_IMAGE_EDIT.MIN_STRENGTH);
    strengthInput.max = String(NAI_IMAGE_EDIT.MAX_STRENGTH);
    strengthInput.step = String(NAI_IMAGE_EDIT.STRENGTH_STEP);
    strengthInput.value = String(NAI_IMAGE_EDIT.DEFAULT_INPAINTING_STRENGTH);
    const strengthValue = document.createElement('small');
    strengthValue.textContent = strengthInput.value;
    strengthInput.addEventListener('input', () => {
      strengthValue.textContent = strengthInput.value;
    });
    const strengthWrap = document.createElement('div');
    strengthWrap.className = 'ai-inpaint-strength-wrap';
    strengthWrap.append(strengthInput, strengthValue);
    const strengthLabel = document.createElement('label');
    strengthLabel.className = 'ai-inpaint-field';
    const strengthSpan = document.createElement('span');
    strengthSpan.textContent = t('inpaint.strength');
    const strengthHint = document.createElement('small');
    strengthHint.textContent = t('inpaint.strengthHint');
    strengthLabel.append(strengthSpan, strengthWrap, strengthHint);

    const toolRow = document.createElement('div');
    toolRow.className = 'ai-inpaint-tool-row';
    const paintButton = document.createElement('button');
    paintButton.type = 'button';
    paintButton.className = 'menu_button active';
    paintButton.textContent = t('inpaint.brush');
    const eraseButton = document.createElement('button');
    eraseButton.type = 'button';
    eraseButton.className = 'menu_button';
    eraseButton.textContent = t('inpaint.erase');
    const undoButton = document.createElement('button');
    undoButton.type = 'button';
    undoButton.className = 'menu_button';
    undoButton.textContent = t('inpaint.undo');
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'menu_button';
    clearButton.textContent = t('inpaint.clearMask');
    toolRow.append(paintButton, eraseButton, undoButton, clearButton);
    quickControls.append(
      createLabeledInput(t('inpaint.brushSize'), brushInput, brushHint),
      createLabeledInput(t('inpaint.zoom'), zoomInput, zoomHint),
      toolRow
    );

    const modeGroup = document.createElement('div');
    modeGroup.className = 'ai-inpaint-mode-group';
    const appendMode = document.createElement('label');
    appendMode.innerHTML = `<input type="radio" name="ai_inpaint_insert_mode" value="append-after-image" checked> ${t('inpaint.appendResult')}`;
    const replaceMode = document.createElement('label');
    replaceMode.innerHTML = `<input type="radio" name="ai_inpaint_insert_mode" value="replace-image"> ${t('inpaint.replaceResult')}`;
    modeGroup.append(appendMode, replaceMode);

    const previewRow = document.createElement('div');
    previewRow.className = 'ai-inpaint-preview-actions';
    previewRow.hidden = true;
    const viewLatestButton = document.createElement('button');
    viewLatestButton.type = 'button';
    viewLatestButton.className = 'menu_button';
    viewLatestButton.textContent = t('inpaint.viewLatestResult');
    const editMaskButton = document.createElement('button');
    editMaskButton.type = 'button';
    editMaskButton.className = 'menu_button';
    editMaskButton.textContent = t('inpaint.editMask');
    previewRow.append(viewLatestButton, editMaskButton);

    const status = document.createElement('p');
    status.className = 'ai-inpaint-status';
    status.textContent = t('inpaint.maskHint');

    const actionRow = document.createElement('div');
    actionRow.className = 'ai-inpaint-actions';
    const generateButton = document.createElement('button');
    generateButton.type = 'button';
    generateButton.className = 'menu_button';
    generateButton.textContent = t('inpaint.generate');
    const finishButton = document.createElement('button');
    finishButton.type = 'button';
    finishButton.className = 'menu_button';
    finishButton.textContent = t('inpaint.insertAndFinish');
    finishButton.disabled = true;
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'menu_button';
    cancelButton.textContent = t('dialog.cancel');
    actionRow.append(generateButton, finishButton, cancelButton);

    controls.append(
      promptLabel,
      negativeLabel,
      parameterGuide,
      createLabeledInput(t('inpaint.maskPadding'), paddingInput, paddingHint),
      createLabeledInput(t('inpaint.maskFeather'), featherInput, featherHint),
      createLabeledInput(
        t('inpaint.maskEdgeGuard'),
        edgeGuardInput,
        edgeGuardHint
      ),
      colorMatchField.label,
      strengthLabel,
      modeGroup,
      previewRow,
      status,
      actionRow
    );

    body.append(canvasColumn, controls);
    dialog.append(header, body);
    document.body.append(dialog);

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    let isErasing = false;
    let isDrawing = false;
    let latestPreviewUrl: string | null = null;
    let pendingPreview: PendingInpaintPreview | null = null;
    let lastPoint: {x: number; y: number} | null = null;
    const undoStack: string[] = [];

    function showPreviewMode(enabled: boolean): void {
      const shouldPreview = enabled && Boolean(latestPreviewUrl);
      canvas.hidden = shouldPreview;
      previewImage.hidden = !shouldPreview;
      viewLatestButton.disabled = shouldPreview || !latestPreviewUrl;
      editMaskButton.disabled = !shouldPreview;
      finishButton.disabled = !pendingPreview;
    }

    function returnToMaskMode(message = t('inpaint.generatedKeepOpen')): void {
      showPreviewMode(false);
      if (latestPreviewUrl) {
        status.textContent = message;
      }
    }

    function readInsertionMode(): InpaintingInsertionMode {
      const checkedMode = dialog.querySelector(
        'input[name="ai_inpaint_insert_mode"]:checked'
      ) as HTMLInputElement | null;
      return checkedMode?.value === 'replace-image'
        ? 'replace-image'
        : 'append-after-image';
    }

    function applyZoom(): void {
      const zoomPercent = clampInt(
        readNumberInput(zoomInput, 100),
        NAI_IMAGE_EDIT.MIN_ZOOM_PERCENT,
        NAI_IMAGE_EDIT.MAX_ZOOM_PERCENT
      );
      zoomInput.value = String(zoomPercent);
      const scale = zoomPercent / 100;
      const scaledWidth = Math.max(1, Math.round(canvas.width * scale));
      const scaledHeight = Math.max(1, Math.round(canvas.height * scale));
      canvas.style.width = `${scaledWidth}px`;
      canvas.style.height = `${scaledHeight}px`;
      previewImage.style.width = `${scaledWidth}px`;
      previewImage.style.height = `${scaledHeight}px`;
    }

    function render(): void {
      if (!ctx) {
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

      const overlay = document.createElement('canvas');
      setCanvasSize(overlay, maskCanvas.width, maskCanvas.height);
      const overlayCtx = overlay.getContext('2d');
      if (!overlayCtx) {
        return;
      }
      overlayCtx.fillStyle = 'rgba(255, 64, 64, 0.48)';
      overlayCtx.fillRect(0, 0, overlay.width, overlay.height);
      overlayCtx.globalCompositeOperation = 'destination-in';
      overlayCtx.drawImage(maskCanvas, 0, 0);
      ctx.drawImage(overlay, 0, 0);
    }

    function pushUndo(): void {
      undoStack.push(maskCanvas.toDataURL('image/png'));
      if (undoStack.length > 20) {
        undoStack.shift();
      }
    }

    function restoreUndo(): void {
      const previous = undoStack.pop();
      if (!previous || !maskCtx) {
        return;
      }
      loadImage(previous)
        .then(image => {
          maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
          maskCtx.drawImage(image, 0, 0);
          render();
        })
        .catch(error => logger.warn('Failed to restore mask undo', error));
    }

    function pointFromEvent(event: PointerEvent): {x: number; y: number} {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * canvas.width,
        y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      };
    }

    function drawTo(point: {x: number; y: number}): void {
      if (!maskCtx || !lastPoint) {
        return;
      }
      const brushSize = clampInt(readNumberInput(brushInput, 36), 1, 256);
      maskCtx.save();
      maskCtx.globalCompositeOperation = isErasing
        ? 'destination-out'
        : 'source-over';
      maskCtx.strokeStyle = '#fff';
      maskCtx.fillStyle = '#fff';
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';
      maskCtx.lineWidth = brushSize;
      if (lastPoint.x === point.x && lastPoint.y === point.y) {
        maskCtx.beginPath();
        maskCtx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
        maskCtx.fill();
      } else {
        maskCtx.beginPath();
        maskCtx.moveTo(lastPoint.x, lastPoint.y);
        maskCtx.lineTo(point.x, point.y);
        maskCtx.stroke();
      }
      maskCtx.restore();
      lastPoint = point;
      render();
    }

    function setEraseMode(enabled: boolean): void {
      isErasing = enabled;
      paintButton.classList.toggle('active', !enabled);
      eraseButton.classList.toggle('active', enabled);
    }

    canvas.addEventListener('pointerdown', event => {
      event.preventDefault();
      pushUndo();
      isDrawing = true;
      lastPoint = pointFromEvent(event);
      canvas.setPointerCapture(event.pointerId);
      drawTo(lastPoint);
    });
    canvas.addEventListener('pointermove', event => {
      if (!isDrawing) {
        return;
      }
      event.preventDefault();
      drawTo(pointFromEvent(event));
    });
    canvas.addEventListener('pointerup', event => {
      isDrawing = false;
      lastPoint = null;
      canvas.releasePointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointercancel', () => {
      isDrawing = false;
      lastPoint = null;
    });

    paintButton.addEventListener('click', () => {
      returnToMaskMode();
      setEraseMode(false);
    });
    eraseButton.addEventListener('click', () => {
      returnToMaskMode();
      setEraseMode(true);
    });
    undoButton.addEventListener('click', () => {
      returnToMaskMode();
      restoreUndo();
    });
    clearButton.addEventListener('click', () => {
      if (!maskCtx) {
        return;
      }
      returnToMaskMode();
      pushUndo();
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      render();
    });
    zoomInput.addEventListener('input', applyZoom);

    function close(result: InpaintingEditorResult | null): void {
      if (dialog.open) {
        dialog.close();
      }
      dialog.remove();
      resolve(result);
    }

    closeButton.addEventListener('click', () => close(null));
    finishButton.addEventListener('click', async () => {
      if (!pendingPreview) {
        toastr.warning(t('inpaint.noPreviewToInsert'), t('extensionName'));
        return;
      }
      finishButton.disabled = true;
      finishButton.textContent = t('inpaint.saving');
      status.textContent = t('inpaint.saving');
      try {
        pendingPreview = {
          ...pendingPreview,
          insertionMode: readInsertionMode(),
        };
        close(await savePreviewAsResult(pendingPreview, options.context));
      } catch (error) {
        logger.error('Failed to save inpaint preview', error);
        const reason = getUserFacingErrorReason(error);
        toastr.error(reason, t('extensionName'));
        status.textContent = `${t('inpaint.failed')}: ${reason}`;
        finishButton.disabled = false;
        finishButton.textContent = t('inpaint.insertAndFinish');
      }
    });
    cancelButton.addEventListener('click', () => close(null));
    viewLatestButton.addEventListener('click', () => {
      if (latestPreviewUrl) {
        showPreviewMode(true);
        status.textContent = t('inpaint.previewHint');
      }
    });
    editMaskButton.addEventListener('click', () => {
      returnToMaskMode();
    });
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
    });

    generateButton.addEventListener('click', async () => {
      const promptText = promptTextarea.value.trim();
      if (!promptText) {
        toastr.warning(t('inpaint.promptRequired'), t('extensionName'));
        return;
      }

      if (!hasMaskPixels(maskCanvas)) {
        toastr.warning(t('inpaint.maskRequired'), t('extensionName'));
        return;
      }

      generateButton.disabled = true;
      generateButton.textContent = t('inpaint.generating');
      status.textContent = t('inpaint.generating');

      try {
        const paddedMaskCanvas = buildPaddedMaskCanvas(
          maskCanvas,
          readNumberInput(paddingInput, NAI_IMAGE_EDIT.DEFAULT_MASK_PADDING_PX)
        );
        const featherPx = clampInt(
          readNumberInput(featherInput, NAI_IMAGE_EDIT.DEFAULT_MASK_FEATHER_PX),
          NAI_IMAGE_EDIT.MIN_MASK_FEATHER_PX,
          NAI_IMAGE_EDIT.MAX_MASK_FEATHER_PX
        );
        const edgeGuardPx = clampInt(
          readNumberInput(
            edgeGuardInput,
            NAI_IMAGE_EDIT.DEFAULT_MASK_EDGE_GUARD_PX
          ),
          NAI_IMAGE_EDIT.MIN_MASK_EDGE_GUARD_PX,
          NAI_IMAGE_EDIT.MAX_MASK_EDGE_GUARD_PX
        );
        const focusedCropRect = buildFocusedCropRect(paddedMaskCanvas);
        const rawRequestBaseDataUrl = focusedCropRect
          ? cropImageDataUrl(baseImage, focusedCropRect)
          : currentBaseDataUrl;
        const rawRequestMaskCanvas = focusedCropRect
          ? cropMaskCanvas(paddedMaskCanvas, focusedCropRect)
          : paddedMaskCanvas;
        const generated = await generateNovelAiInpaintBase64(
          {
            prompt: enhancePromptForInpaint(
              promptText,
              options.messageText,
              options.settings,
              options.context
            ),
            negativePrompt: negativeTextarea.value.trim() || undefined,
            baseImageDataUrl: rawRequestBaseDataUrl,
            maskDataUrl: exportMaskDataUrl(rawRequestMaskCanvas),
            width: rawRequestMaskCanvas.width,
            height: rawRequestMaskCanvas.height,
            strength: readFloatInput(
              strengthInput,
              NAI_IMAGE_EDIT.DEFAULT_INPAINTING_STRENGTH
            ),
            colorCorrect: colorMatchField.input.checked,
          },
          options.context
        );
        const resultDataUrl = imageDataUrlFromBase64(
          generated.data,
          generated.format
        );
        const fullResultDataUrl = focusedCropRect
          ? await composeCropResult(
              currentBaseDataUrl,
              resultDataUrl,
              focusedCropRect,
              canvas.width,
              canvas.height
            )
          : resultDataUrl;
        const finalDataUrl = await buildBlendedInpaintDataUrl(
          fullResultDataUrl,
          currentBaseDataUrl,
          buildEdgeGuardMaskCanvas(maskCanvas, edgeGuardPx),
          featherPx,
          canvas.width,
          canvas.height,
          colorMatchField.input.checked
        );
        pendingPreview = {
          dataUrl: finalDataUrl,
          format: getDataUrlImageFormat(finalDataUrl, generated.format),
          promptText,
          insertionMode: readInsertionMode(),
        };
        latestPreviewUrl = finalDataUrl;
        previewImage.src = finalDataUrl;
        previewRow.hidden = false;
        showPreviewMode(true);
        toastr.success(t('inpaint.previewGenerated'), t('extensionName'));
        status.textContent = t('inpaint.previewHint');
        generateButton.disabled = false;
        generateButton.textContent = t('inpaint.generate');
      } catch (error) {
        logger.error('Inpaint generation failed', error);
        const reason = getUserFacingErrorReason(error);
        toastr.error(reason, t('extensionName'));
        status.textContent = `${t('inpaint.failed')}: ${reason}`;
        generateButton.disabled = false;
        generateButton.textContent = t('inpaint.generate');
      }
    });

    render();
    applyZoom();

    if (typeof dialog.showModal === 'function') {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    } else {
      dialog.setAttribute('open', '');
    }
  });
}
