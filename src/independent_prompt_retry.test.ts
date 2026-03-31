import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {
  clearIndependentPromptRetryState,
  hasIndependentPromptRetryState,
  markIndependentPromptRetryAvailable,
  syncIndependentPromptRetryButtons,
} from './independent_prompt_retry';

vi.mock('./logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./i18n', () => ({
  t: (key: string) => key,
}));

describe('independent_prompt_retry', () => {
  let context: SillyTavernContext;
  let settings: AutoIllustratorSettings;

  beforeEach(() => {
    document.body.innerHTML = `
      <div class="mes" mesid="0">
        <div class="mes_text">Message 0</div>
      </div>
    `;

    context = {
      chat: [
        {
          mes: 'Message 0',
          is_user: false,
          name: 'Assistant',
        },
      ],
    } as any;

    settings = {
      promptDetectionPatterns: ['<!--img-prompt="([^"]+)"-->'],
    } as any;

    clearIndependentPromptRetryState();
  });

  afterEach(() => {
    clearIndependentPromptRetryState();
    document.body.innerHTML = '';
  });

  it('should render a retry button for retryable messages without prompts', () => {
    markIndependentPromptRetryAvailable(0, 'API request failed');

    syncIndependentPromptRetryButtons(context, settings, vi.fn());

    const button = document.querySelector(
      '.auto-illustrator-prompt-retry'
    ) as HTMLButtonElement | null;

    expect(button).not.toBeNull();
    expect(button?.textContent).toBe('message.retryPromptGeneration');
    expect(button?.title).toBe('API request failed');
  });

  it('should clear retry state once the message already has prompt tags', () => {
    context.chat![0].mes = 'Message 0 <!--img-prompt="test prompt"-->';
    markIndependentPromptRetryAvailable(0);

    syncIndependentPromptRetryButtons(context, settings, vi.fn());

    expect(hasIndependentPromptRetryState(0)).toBe(false);
    expect(
      document.querySelector('.auto-illustrator-prompt-retry')
    ).toBeNull();
  });

  it('should invoke retry callback once and remove the button afterwards', async () => {
    const retryCallback = vi.fn().mockResolvedValue(undefined);
    markIndependentPromptRetryAvailable(0);

    syncIndependentPromptRetryButtons(context, settings, retryCallback);

    const button = document.querySelector(
      '.auto-illustrator-prompt-retry'
    ) as HTMLButtonElement;

    button.click();
    await vi.waitFor(() => {
      expect(retryCallback).toHaveBeenCalledWith(0);
    });

    expect(hasIndependentPromptRetryState(0)).toBe(false);
    expect(
      document.querySelector('.auto-illustrator-prompt-retry')
    ).toBeNull();
  });
});
