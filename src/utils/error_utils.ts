import {t} from '../i18n';

export type AutoIllustratorErrorCode =
  | 'api-request-failed'
  | 'llm-empty-response'
  | 'no-valid-prompts'
  | 'llm-unavailable'
  | 'main-response-empty'
  | 'prompt-insertion-failed'
  | 'image-command-unavailable'
  | 'image-empty-response'
  | 'image-request-failed'
  | 'unknown';

export class AutoIllustratorError extends Error {
  readonly code: AutoIllustratorErrorCode;
  readonly detail?: string;

  constructor(
    code: AutoIllustratorErrorCode,
    message: string,
    detail?: string
  ) {
    super(message);
    this.name = 'AutoIllustratorError';
    this.code = code;
    this.detail = normalizeErrorDetail(detail);
    Object.setPrototypeOf(this, AutoIllustratorError.prototype);
  }
}

function normalizeErrorDetail(
  detail?: string,
  maxLength = 160
): string | undefined {
  if (!detail) {
    return undefined;
  }

  const normalized = detail
    .replace(/\s+/g, ' ')
    .replace(/^Error:\s*/i, '')
    .trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof AutoIllustratorError) {
    return error.detail || error.message;
  }

  if (error instanceof Error) {
    return error.message || error.name;
  }

  if (typeof error === 'string') {
    return error;
  }

  return String(error);
}

export function toAutoIllustratorError(
  error: unknown,
  code: AutoIllustratorErrorCode,
  fallbackMessage: string
): AutoIllustratorError {
  if (error instanceof AutoIllustratorError) {
    return error;
  }

  return new AutoIllustratorError(
    code,
    fallbackMessage,
    extractErrorMessage(error)
  );
}

function appendDetail(base: string, detail?: string): string {
  return detail ? `${base}: ${detail}` : base;
}

export function getUserFacingErrorReason(error: unknown): string {
  if (error instanceof AutoIllustratorError) {
    switch (error.code) {
      case 'api-request-failed':
        return appendDetail(t('errorReason.apiRequestFailed'), error.detail);
      case 'llm-empty-response':
        return appendDetail(t('errorReason.apiReturnedEmpty'), error.detail);
      case 'no-valid-prompts':
        return appendDetail(t('errorReason.noValidPrompts'), error.detail);
      case 'llm-unavailable':
        return appendDetail(t('errorReason.llmUnavailable'), error.detail);
      case 'main-response-empty':
        return appendDetail(t('errorReason.mainResponseEmpty'), error.detail);
      case 'prompt-insertion-failed':
        return appendDetail(
          t('errorReason.promptInsertionFailed'),
          error.detail
        );
      case 'image-command-unavailable':
        return appendDetail(
          t('errorReason.imageCommandUnavailable'),
          error.detail
        );
      case 'image-empty-response':
        return appendDetail(t('errorReason.imageReturnedEmpty'), error.detail);
      case 'image-request-failed':
        return appendDetail(t('errorReason.imageRequestFailed'), error.detail);
      case 'unknown':
        return appendDetail(t('errorReason.unknown'), error.detail);
    }
  }

  return appendDetail(
    t('errorReason.unknown'),
    normalizeErrorDetail(extractErrorMessage(error))
  );
}
