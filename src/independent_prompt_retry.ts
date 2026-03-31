import {t} from './i18n';
import {createLogger} from './logger';
import {extractImagePromptsMultiPattern} from './regex';

const logger = createLogger('PromptRetry');

interface PromptRetryState {
  reason?: string;
  retrying: boolean;
}

const promptRetryStates = new Map<number, PromptRetryState>();

function messageHasPromptTags(
  messageText: string | undefined,
  patterns: string[]
): boolean {
  if (!messageText) {
    return false;
  }

  return extractImagePromptsMultiPattern(messageText, patterns).length > 0;
}

function getRetryHost(messageEl: HTMLElement): HTMLElement {
  return (
    (messageEl.querySelector('.mes_text') as HTMLElement | null) ?? messageEl
  );
}

function removeRetryButtonsForMessage(messageId: number): void {
  document
    .querySelectorAll(
      `.auto-illustrator-prompt-retry[data-message-id="${messageId}"]`
    )
    .forEach(button => button.remove());
}

export function hasIndependentPromptRetryState(messageId: number): boolean {
  return promptRetryStates.has(messageId);
}

export function markIndependentPromptRetryAvailable(
  messageId: number,
  reason?: string
): void {
  promptRetryStates.set(messageId, {
    reason,
    retrying: false,
  });
}

export function clearIndependentPromptRetryState(messageId?: number): void {
  if (messageId === undefined) {
    promptRetryStates.clear();
    document
      .querySelectorAll('.auto-illustrator-prompt-retry')
      .forEach(button => button.remove());
    return;
  }

  promptRetryStates.delete(messageId);
  removeRetryButtonsForMessage(messageId);
}

export function syncIndependentPromptRetryButtons(
  context: SillyTavernContext,
  settings: AutoIllustratorSettings,
  onRetry: (messageId: number) => Promise<void>
): void {
  const validMessageIds = new Set<number>();

  for (const [messageId, state] of promptRetryStates) {
    const message = context.chat?.[messageId];
    if (!message || message.is_user) {
      clearIndependentPromptRetryState(messageId);
      continue;
    }

    if (messageHasPromptTags(message.mes, settings.promptDetectionPatterns)) {
      clearIndependentPromptRetryState(messageId);
      continue;
    }

    const messageEl = document.querySelector(
      `.mes[mesid="${messageId}"]`
    ) as HTMLElement | null;
    if (!messageEl) {
      continue;
    }

    validMessageIds.add(messageId);
    const host = getRetryHost(messageEl);

    let button = host.querySelector(
      `.auto-illustrator-prompt-retry[data-message-id="${messageId}"]`
    ) as HTMLButtonElement | null;

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className =
        'menu_button auto-illustrator-action-btn auto-illustrator-prompt-retry';
      button.dataset.messageId = String(messageId);
      host.appendChild(button);
    }

    button.disabled = state.retrying;
    button.textContent = state.retrying
      ? t('message.retryingPromptGeneration')
      : t('message.retryPromptGeneration');
    button.title = state.reason || '';

    if (button.dataset.aiPromptRetryBound === 'true') {
      continue;
    }

    button.dataset.aiPromptRetryBound = 'true';
    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();

      const currentState = promptRetryStates.get(messageId);
      if (!currentState || currentState.retrying) {
        return;
      }

      currentState.retrying = true;
      syncIndependentPromptRetryButtons(context, settings, onRetry);

      try {
        await onRetry(messageId);
      } catch (error) {
        logger.error(
          `Manual prompt retry failed for message ${messageId}:`,
          error
        );
      } finally {
        clearIndependentPromptRetryState(messageId);
      }
    });
  }

  document.querySelectorAll('.auto-illustrator-prompt-retry').forEach(node => {
    const messageId = Number((node as HTMLElement).dataset.messageId);
    if (!validMessageIds.has(messageId)) {
      node.remove();
    }
  });
}
