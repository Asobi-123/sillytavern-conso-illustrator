/**
 * Tests for Prompt Updater Module
 * Covers LLM provider selection logic (independent vs shared API fallback)
 */

import {describe, it, expect, beforeEach, vi} from 'vitest';

// Mock dependencies
vi.mock('./logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./presets/prompt_update.md', () => ({
  default: 'Current: {{{currentPrompt}}}\nFeedback: {{{userFeedback}}}',
}));

vi.mock('./prompt_manager', () => ({
  getPromptForImage: vi.fn(),
  refinePrompt: vi.fn(),
  replacePromptTextInMessage: vi.fn(),
}));

vi.mock('./metadata', () => ({
  getMetadata: vi.fn(() => ({
    promptRegistry: {nodes: {}, imageToPromptId: {}},
  })),
}));

vi.mock('./services/independent_llm', () => ({
  callIndependentLlmApi: vi.fn(),
  isIndependentLlmConfigured: vi.fn(),
}));

vi.mock('./constants', () => ({
  DEFAULT_PROMPT_DETECTION_PATTERNS: [
    '<!--img-prompt="([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"\\s*-->',
  ],
}));

vi.mock('./utils/message_renderer', () => ({
  renderMessageUpdate: vi.fn(),
}));

vi.mock('./image_utils', () => ({
  normalizeImageUrl: vi.fn((url: string) => url),
}));

import {generateUpdatedPrompt} from './prompt_updater';
import {getPromptForImage, refinePrompt} from './prompt_manager';
import {
  callIndependentLlmApi,
  isIndependentLlmConfigured,
} from './services/independent_llm';

describe('generateUpdatedPrompt - LLM provider selection', () => {
  let mockContext: any;
  let baseSettings: AutoIllustratorSettings;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      generateRaw: vi.fn(),
      chat: [{mes: 'test message', name: 'Bot', is_user: false, send_date: 0}],
    };

    baseSettings = {
      promptGenerationMode: 'shared-api',
      useIndependentLlmApi: false,
      independentLlmApiUrl: '',
      independentLlmApiKey: '',
      independentLlmModel: '',
      independentLlmMaxTokens: 4096,
      promptDetectionPatterns: [
        '<!--img-prompt="([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"\\s*-->',
      ],
    } as any;

    // Default: prompt found for image
    (getPromptForImage as any).mockReturnValue({
      id: 'prompt-1',
      text: 'old prompt text',
    });

    // Default: refine succeeds
    (refinePrompt as any).mockResolvedValue({
      id: 'child-1',
      text: 'updated prompt text',
    });
  });

  it('should use independent API when in independent mode, enabled, and configured', async () => {
    baseSettings.promptGenerationMode = 'independent-api';
    baseSettings.useIndependentLlmApi = true;
    baseSettings.independentLlmApiUrl = 'https://api.example.com/v1';
    baseSettings.independentLlmModel = 'gpt-4o-mini';

    (isIndependentLlmConfigured as any).mockReturnValue(true);
    (callIndependentLlmApi as any).mockResolvedValue(
      '<!--img-prompt="updated prompt text"-->'
    );

    const result = await generateUpdatedPrompt(
      '/images/test.png',
      'make it better',
      mockContext,
      baseSettings
    );

    expect(callIndependentLlmApi).toHaveBeenCalledOnce();
    expect(mockContext.generateRaw).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
  });

  it('should use shared API when in shared-api mode even if independent toggle is ON', async () => {
    baseSettings.promptGenerationMode = 'shared-api';
    baseSettings.useIndependentLlmApi = true;
    baseSettings.independentLlmApiUrl = 'https://api.example.com/v1';
    baseSettings.independentLlmModel = 'gpt-4o-mini';

    (isIndependentLlmConfigured as any).mockReturnValue(true);
    mockContext.generateRaw.mockResolvedValue(
      '<!--img-prompt="updated via shared"-->'
    );

    const result = await generateUpdatedPrompt(
      '/images/test.png',
      'make it better',
      mockContext,
      baseSettings
    );

    expect(callIndependentLlmApi).not.toHaveBeenCalled();
    expect(mockContext.generateRaw).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
  });

  it('should fall back to shared API when independent mode but config incomplete', async () => {
    baseSettings.promptGenerationMode = 'independent-api';
    baseSettings.useIndependentLlmApi = true;
    baseSettings.independentLlmApiUrl = '';
    baseSettings.independentLlmModel = '';

    (isIndependentLlmConfigured as any).mockReturnValue(false);
    mockContext.generateRaw.mockResolvedValue(
      '<!--img-prompt="updated via shared"-->'
    );

    const result = await generateUpdatedPrompt(
      '/images/test.png',
      'make it better',
      mockContext,
      baseSettings
    );

    expect(callIndependentLlmApi).not.toHaveBeenCalled();
    expect(mockContext.generateRaw).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
  });

  it('should use shared API when independent is disabled', async () => {
    baseSettings.promptGenerationMode = 'independent-api';
    baseSettings.useIndependentLlmApi = false;

    mockContext.generateRaw.mockResolvedValue(
      '<!--img-prompt="updated via shared"-->'
    );

    const result = await generateUpdatedPrompt(
      '/images/test.png',
      'make it better',
      mockContext,
      baseSettings
    );

    expect(callIndependentLlmApi).not.toHaveBeenCalled();
    expect(mockContext.generateRaw).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
  });

  it('should throw when both paths are unavailable', async () => {
    baseSettings.promptGenerationMode = 'independent-api';
    baseSettings.useIndependentLlmApi = true;
    (isIndependentLlmConfigured as any).mockReturnValue(false);
    mockContext.generateRaw = undefined;

    await expect(
      generateUpdatedPrompt(
        '/images/test.png',
        'make it better',
        mockContext,
        baseSettings
      )
    ).rejects.toThrow('LLM generation not available');
  });

  it('should return null when no prompt found for image', async () => {
    (getPromptForImage as any).mockReturnValue(null);

    const result = await generateUpdatedPrompt(
      '/images/unknown.png',
      'feedback',
      mockContext,
      baseSettings
    );

    expect(result).toBeNull();
  });
});
