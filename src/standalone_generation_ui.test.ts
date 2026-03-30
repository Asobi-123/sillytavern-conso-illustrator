import {beforeEach, describe, expect, it, vi} from 'vitest';

const {
  generateStandalonePromptsMock,
  generateImageMock,
  setImageSubfolderLabelMock,
  toastrErrorMock,
  toastrWarningMock,
} = vi.hoisted(() => ({
  generateStandalonePromptsMock: vi.fn(),
  generateImageMock: vi.fn(),
  setImageSubfolderLabelMock: vi.fn(),
  toastrErrorMock: vi.fn(),
  toastrWarningMock: vi.fn(),
}));

vi.mock('./i18n', () => ({
  t: (key: string, replacements?: Record<string, string>) =>
    replacements ? `${key} ${JSON.stringify(replacements)}` : key,
}));

vi.mock('./logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./services/prompt_generation_service', () => ({
  generateStandalonePrompts: generateStandalonePromptsMock,
}));

vi.mock('./image_generator', () => ({
  generateImage: generateImageMock,
  setImageSubfolderLabel: setImageSubfolderLabelMock,
}));

describe('standalone_generation_ui', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    generateStandalonePromptsMock.mockReset();
    generateImageMock.mockReset();
    setImageSubfolderLabelMock.mockReset();
    toastrErrorMock.mockReset();
    toastrWarningMock.mockReset();
    global.toastr = {
      error: toastrErrorMock,
      warning: toastrWarningMock,
      info: vi.fn(),
      success: vi.fn(),
    } as any;
  });

  it('should restore and persist standalone subfolder label via localStorage', async () => {
    const localStorageMock = {
      getItem: vi.fn(() => 'saved_label'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });

    const standaloneUi = await import('./standalone_generation_ui');
    document.body.innerHTML = standaloneUi.createStandaloneGenerationContent();

    standaloneUi.initializeStandaloneGeneration(
      {} as SillyTavernContext,
      {} as AutoIllustratorSettings,
      undefined
    );

    const input = document.getElementById(
      'auto_illustrator_conso_standalone_subfolder_label'
    ) as HTMLInputElement;

    expect(input.value).toBe('saved_label');

    input.value = 'new_label';
    input.dispatchEvent(new Event('input', {bubbles: true}));
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'auto_illustrator_conso_standalone_subfolder_label',
      'new_label'
    );

    input.value = '   ';
    input.dispatchEvent(new Event('change', {bubbles: true}));
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'auto_illustrator_conso_standalone_subfolder_label'
    );
  });

  it('should show a toast when standalone prompt generation fails', async () => {
    const {AutoIllustratorError} = await import('./utils/error_utils');
    generateStandalonePromptsMock.mockRejectedValue(
      new AutoIllustratorError(
        'api-request-failed',
        'Standalone LLM generation failed',
        '500 Server Error'
      )
    );

    const standaloneUi = await import('./standalone_generation_ui');
    document.body.innerHTML = standaloneUi.createStandaloneGenerationContent();
    standaloneUi.initializeStandaloneGeneration(
      {generateRaw: vi.fn()} as unknown as SillyTavernContext,
      {} as AutoIllustratorSettings,
      undefined
    );

    const input = document.getElementById(
      'auto_illustrator_conso_standalone_scene_input'
    ) as HTMLTextAreaElement;
    const button = document.getElementById(
      'auto_illustrator_conso_standalone_generate_prompts'
    ) as HTMLButtonElement;
    const results = document.getElementById(
      'auto_illustrator_conso_standalone_results'
    ) as HTMLElement;

    input.value = 'A moonlit garden';
    button.click();
    await vi.waitFor(() => {
      expect(toastrErrorMock).toHaveBeenCalledTimes(1);
    });

    expect(results.innerHTML).toContain('standalone.promptFailed');
    expect(String(toastrErrorMock.mock.calls[0][0])).toContain(
      '500 Server Error'
    );
  });

  it('should show a toast when standalone manual image generation fails', async () => {
    const {AutoIllustratorError} = await import('./utils/error_utils');
    generateImageMock.mockRejectedValue(
      new AutoIllustratorError(
        'image-command-unavailable',
        'SD command not available'
      )
    );

    const standaloneUi = await import('./standalone_generation_ui');
    document.body.innerHTML = standaloneUi.createStandaloneGenerationContent();
    standaloneUi.initializeStandaloneGeneration(
      {generateRaw: vi.fn()} as unknown as SillyTavernContext,
      {characterFixedTags: {}} as AutoIllustratorSettings,
      undefined
    );

    const manualRadio = document.getElementById(
      'auto_illustrator_conso_standalone_mode_manual'
    ) as HTMLInputElement;
    const promptInput = document.getElementById(
      'auto_illustrator_conso_standalone_manual_prompt'
    ) as HTMLTextAreaElement;
    const button = document.getElementById(
      'auto_illustrator_conso_standalone_manual_generate'
    ) as HTMLButtonElement;
    const imageContainer = document.getElementById(
      'auto_illustrator_conso_standalone_manual_image'
    ) as HTMLElement;

    manualRadio.checked = true;
    manualRadio.dispatchEvent(new Event('change', {bubbles: true}));
    promptInput.value = '1girl, moonlight';
    button.click();
    await vi.waitFor(() => {
      expect(toastrErrorMock).toHaveBeenCalledTimes(1);
    });

    expect(imageContainer.innerHTML).toContain('standalone.imageFailed');
    expect(String(toastrErrorMock.mock.calls[0][0])).toContain(
      'errorReason.imageCommandUnavailable'
    );
  });
});
