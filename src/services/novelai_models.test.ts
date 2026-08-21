import {beforeEach, describe, expect, it} from 'vitest';
import {
  initializeNovelAiV5ModelCompatibility,
  NOVELAI_MODELS,
  normalizeNovelAiGenerationSettings,
  reconcileNovelAiV5ModelOptions,
} from './novelai_models';

function createContext(source = 'novel', model = 'nai-diffusion-4-5-full') {
  return {
    extensionSettings: {sd: {source, model}},
  } as unknown as SillyTavernContext;
}

function renderSelectors(): HTMLSelectElement {
  document.body.innerHTML = `
    <select id="sd_source">
      <option value="novel">NovelAI</option>
      <option value="openai">OpenAI</option>
    </select>
    <select id="sd_model">
      <option value="nai-diffusion-4-5-full">NAI Diffusion Anime V4.5 (Full)</option>
    </select>
  `;
  return document.querySelector<HTMLSelectElement>('#sd_model')!;
}

async function flushMutationObservers(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('NovelAI V5 model compatibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('generation setting normalization', () => {
    it('resets an unsupported NovelAI upscale ratio and synchronizes the native UI', () => {
      const context = createContext();
      context.extensionSettings.sd.hr_scale = 1.1;
      document.body.innerHTML = `
        <input id="sd_hr_scale" value="1.1">
        <span id="sd_hr_scale_value">1.1</span>
      `;
      const input = document.querySelector<HTMLInputElement>('#sd_hr_scale')!;
      const onInput = vi.fn();
      input.addEventListener('input', onInput);

      const result = normalizeNovelAiGenerationSettings(context);

      expect(result).toEqual({
        upscaleRatioChanged: true,
        previousUpscaleRatio: 1.1,
      });
      expect(context.extensionSettings.sd.hr_scale).toBe(1);
      expect(input.value).toBe('1');
      expect(document.querySelector('#sd_hr_scale_value')?.textContent).toBe(
        '1'
      );
      expect(onInput).toHaveBeenCalledOnce();
    });

    it.each([1, 2, 4])('preserves the supported NovelAI ratio %s', ratio => {
      const context = createContext();
      context.extensionSettings.sd.hr_scale = ratio;

      expect(normalizeNovelAiGenerationSettings(context)).toEqual({
        upscaleRatioChanged: false,
      });
      expect(context.extensionSettings.sd.hr_scale).toBe(ratio);
    });

    it('does not change settings for another image source', () => {
      const context = createContext('openai');
      context.extensionSettings.sd.hr_scale = 1.1;

      expect(normalizeNovelAiGenerationSettings(context)).toEqual({
        upscaleRatioChanged: false,
      });
      expect(context.extensionSettings.sd.hr_scale).toBe(1.1);
    });

    it('persists the reset when the native input is not mounted', () => {
      const context = createContext();
      const saveSettingsDebounced = vi.fn();
      context.extensionSettings.sd.hr_scale = Number.NaN;
      context.saveSettingsDebounced = saveSettingsDebounced;

      normalizeNovelAiGenerationSettings(context);

      expect(context.extensionSettings.sd.hr_scale).toBe(1);
      expect(saveSettingsDebounced).toHaveBeenCalledOnce();
    });
  });

  it('adds the missing V5 models only for the NovelAI source', () => {
    const select = renderSelectors();

    reconcileNovelAiV5ModelOptions(createContext(), select);

    expect(Array.from(select.options, option => option.value)).toEqual([
      'nai-diffusion-4-5-full',
      NOVELAI_MODELS.V5_CURATED,
      NOVELAI_MODELS.V5_FULL,
    ]);

    const nonNovelSelect = renderSelectors();
    reconcileNovelAiV5ModelOptions(createContext('openai'), nonNovelSelect);
    expect(Array.from(nonNovelSelect.options, option => option.value)).toEqual([
      'nai-diffusion-4-5-full',
    ]);
  });

  it('does not duplicate or relabel V5 options supplied by SillyTavern', () => {
    const select = renderSelectors();
    const nativeOption = document.createElement('option');
    nativeOption.value = NOVELAI_MODELS.V5_FULL;
    nativeOption.textContent = 'Native V5 Full label';
    select.append(nativeOption);

    reconcileNovelAiV5ModelOptions(createContext(), select);
    reconcileNovelAiV5ModelOptions(createContext(), select);

    expect(
      Array.from(select.options).filter(
        option => option.value === NOVELAI_MODELS.V5_FULL
      )
    ).toHaveLength(1);
    expect(nativeOption.textContent).toBe('Native V5 Full label');
  });

  it('retires a compatibility option when a native option arrives later', async () => {
    const select = renderSelectors();
    const cleanup = initializeNovelAiV5ModelCompatibility(createContext());
    const nativeOption = document.createElement('option');
    nativeOption.value = NOVELAI_MODELS.V5_FULL;
    nativeOption.textContent = 'Later native V5 Full label';

    select.append(nativeOption);
    await flushMutationObservers();

    const matchingOptions = Array.from(select.options).filter(
      option => option.value === NOVELAI_MODELS.V5_FULL
    );
    expect(matchingOptions).toEqual([nativeOption]);
    expect(nativeOption.textContent).toBe('Later native V5 Full label');
    cleanup();
  });

  it('restores a selected V5 model after SillyTavern rebuilds the selector', async () => {
    const select = renderSelectors();
    const context = createContext('novel', NOVELAI_MODELS.V5_FULL);
    const cleanup = initializeNovelAiV5ModelCompatibility(context);

    expect(select.value).toBe(NOVELAI_MODELS.V5_FULL);

    select.replaceChildren();
    const oldModel = document.createElement('option');
    oldModel.value = 'nai-diffusion-4-5-full';
    select.append(oldModel);
    await flushMutationObservers();

    expect(select.value).toBe(NOVELAI_MODELS.V5_FULL);
    expect(context.extensionSettings.sd.model).toBe(NOVELAI_MODELS.V5_FULL);
    cleanup();
  });

  it('removes only compatibility options after switching sources', async () => {
    const select = renderSelectors();
    const context = createContext();
    const cleanup = initializeNovelAiV5ModelCompatibility(context);
    const nativeOption = document.createElement('option');
    nativeOption.value = 'custom-model';
    select.append(nativeOption);

    context.extensionSettings.sd.source = 'openai';
    document.querySelector('#sd_source')?.dispatchEvent(new Event('change'));
    await flushMutationObservers();

    expect(Array.from(select.options, option => option.value)).toEqual([
      'nai-diffusion-4-5-full',
      'custom-model',
    ]);
    cleanup();
  });
});
