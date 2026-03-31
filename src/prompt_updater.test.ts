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

import {applyPromptUpdate, generateUpdatedPrompt} from './prompt_updater';
import {
  getPromptForImage,
  refinePrompt,
  replacePromptTextInMessage,
} from './prompt_manager';
import {
  callIndependentLlmApi,
  isIndependentLlmConfigured,
} from './services/independent_llm';
import {renderMessageUpdate} from './utils/message_renderer';

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

describe('applyPromptUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (replacePromptTextInMessage as any).mockReturnValue('updated message body');
  });

  it('should find messages containing encoded normalized image URLs', async () => {
    const context = {
      chat: [
        {
          mes: '<img src="/images/%E5%B0%8F%E8%AF%B4%E5%AE%B6/test.png">',
          is_user: false,
          name: 'Assistant',
        },
      ],
    } as any;

    const result = await applyPromptUpdate(
      '/images/小说家/test.png',
      'parent-1',
      {id: 'child-1', text: 'updated prompt text'} as any,
      context,
      {
        promptDetectionPatterns: [
          '<!--img-prompt="([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"\\s*-->',
        ],
      } as any
    );

    expect(result).toBe(true);
    expect(replacePromptTextInMessage).toHaveBeenCalledWith(
      'parent-1',
      '<img src="/images/%E5%B0%8F%E8%AF%B4%E5%AE%B6/test.png">',
      'updated prompt text',
      expect.any(Array),
      expect.anything()
    );
    expect(renderMessageUpdate).toHaveBeenCalledWith(0);
  });
});
