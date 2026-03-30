import {describe, expect, it, vi} from 'vitest';

vi.mock('../i18n', () => ({
  t: (key: string) => key,
}));

import {
  AutoIllustratorError,
  getUserFacingErrorReason,
  toAutoIllustratorError,
} from './error_utils';

describe('error_utils', () => {
  it('should format categorized reasons with detail', () => {
    const error = new AutoIllustratorError(
      'api-request-failed',
      'Request failed',
      '401 Unauthorized'
    );

    expect(getUserFacingErrorReason(error)).toBe(
      'errorReason.apiRequestFailed: 401 Unauthorized'
    );
  });

  it('should wrap unknown errors into AutoIllustratorError', () => {
    const wrapped = toAutoIllustratorError(
      new Error('Failed to fetch'),
      'image-request-failed',
      'Image generation failed'
    );

    expect(wrapped).toBeInstanceOf(AutoIllustratorError);
    expect(wrapped.code).toBe('image-request-failed');
    expect(wrapped.detail).toBe('Failed to fetch');
  });
});
