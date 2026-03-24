import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('./i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('./logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('standalone_generation_ui', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
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
});
