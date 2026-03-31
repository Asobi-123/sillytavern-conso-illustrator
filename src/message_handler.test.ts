/**
 * Tests for Message Handler V2 Module
 */

import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';
import {
  handleStreamTokenStarted,
  handleMessageReceived,
  handleGenerationEnded,
  handleChatChanged,
  cancelAllDelayedReconciliations,
  handleManualIndependentPromptRetry,
} from './message_handler';
import {AutoIllustratorError} from './utils/error_utils';
import {
  clearIndependentPromptRetryState,
  hasIndependentPromptRetryState,
} from './independent_prompt_retry';

const {
  generatePromptsForMessageMock,
  insertPromptTagsWithContextMock,
  toastrErrorMock,
} = vi.hoisted(() => ({
  generatePromptsForMessageMock: vi.fn(),
  insertPromptTagsWithContextMock: vi.fn(),
  toastrErrorMock: vi.fn(),
}));

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

vi.mock('./i18n', () => ({
  t: (key: string, replacements?: Record<string, string>) =>
    replacements ? `${key} ${JSON.stringify(replacements)}` : key,
}));

vi.mock('./services/prompt_generation_service', () => ({
  generatePromptsForMessage: generatePromptsForMessageMock,
}));

vi.mock('./prompt_insertion', () => ({
  insertPromptTagsWithContext: insertPromptTagsWithContextMock,
}));

vi.mock('./session_manager', () => ({
  sessionManager: {
    startStreamingSession: vi.fn(),
    setupStreamingCompletion: vi.fn(),
    finalizeStreamingAndInsert: vi.fn(),
    getSession: vi.fn(),
    cancelSession: vi.fn(),
    getAllSessions: vi.fn(() => []),
  },
}));

vi.mock('./utils/message_renderer', () => ({
  renderMessageUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./metadata', () => ({
  getMetadata: vi.fn(() => ({})),
  saveMetadata: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./reconciliation', () => ({
  reconcileMessage: vi.fn(() => ({
    updatedText: 'message text',
    result: {restoredCount: 0, missingCount: 0, errors: []},
  })),
}));

// Mock global SillyTavern
global.SillyTavern = {
  getContext: vi.fn(),
} as any;

describe('Message Handler V2', () => {
  let mockContext: any;
  let mockSettings: any;
  let mockSessionManager: any;

  beforeEach(async () => {
    // Get the mocked sessionManager
    const {sessionManager} = await import('./session_manager');
    mockSessionManager = sessionManager;
    mockContext = {
      chat: [
        {mes: 'Message 0', is_user: true},
        {mes: 'Message 1', is_user: false, name: 'Assistant'},
        {mes: 'Message 2', is_user: false, name: 'Assistant'},
      ],
    };

    mockSettings = {
      streamingEnabled: true,
      promptDetectionPatterns: ['<!--img-prompt="([^"]+)"-->'],
      promptGenerationMode: 'regex', // Default to regex mode
      maxPromptsPerMessage: 5,
    };

    global.toastr = {
      error: toastrErrorMock,
      warning: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
    } as any;

    // Clear all mocks
    vi.clearAllMocks();
    generatePromptsForMessageMock.mockReset();
    insertPromptTagsWithContextMock.mockReset();
    toastrErrorMock.mockReset();
    clearIndependentPromptRetryState();
    global.SillyTavern.getContext = vi.fn().mockReturnValue(mockContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearIndependentPromptRetryState();
  });

  describe('handleStreamTokenStarted', () => {
    it('should start a streaming session', async () => {
      mockSessionManager.startStreamingSession.mockResolvedValue({
        sessionId: 'session1',
        messageId: 1,
        type: 'streaming',
      });

      await handleStreamTokenStarted(1, mockContext, mockSettings);

      expect(mockSessionManager.startStreamingSession).toHaveBeenCalledWith(
        1,
        mockContext,
        mockSettings
      );
    });

    it('should handle errors during session start', async () => {
      mockSessionManager.startStreamingSession.mockRejectedValue(
        new Error('Test error')
      );

      // Should not throw, just log error
      await expect(
        handleStreamTokenStarted(1, mockContext, mockSettings)
      ).resolves.not.toThrow();

      expect(mockSessionManager.startStreamingSession).toHaveBeenCalled();
    });
  });

  describe('handleMessageReceived', () => {
    it('should finalize streaming session when active', async () => {
      mockSessionManager.getSession.mockReturnValue({
        sessionId: 'session1',
        messageId: 1,
        type: 'streaming',
      });
      mockSessionManager.finalizeStreamingAndInsert.mockResolvedValue(3);

      await handleMessageReceived(1, mockContext, mockSettings);

      expect(mockSessionManager.getSession).toHaveBeenCalledWith(1);
      expect(
        mockSessionManager.finalizeStreamingAndInsert
      ).toHaveBeenCalledWith(1, mockContext);
    });

    it('should skip if message not found', async () => {
      await handleMessageReceived(999, mockContext, mockSettings);

      expect(mockSessionManager.getSession).not.toHaveBeenCalled();
      expect(
        mockSessionManager.finalizeStreamingAndInsert
      ).not.toHaveBeenCalled();
    });

    it('should skip if message is from user', async () => {
      await handleMessageReceived(0, mockContext, mockSettings);

      expect(mockSessionManager.getSession).not.toHaveBeenCalled();
      expect(
        mockSessionManager.finalizeStreamingAndInsert
      ).not.toHaveBeenCalled();
    });

    it('should skip if no active session exists', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      await handleMessageReceived(1, mockContext, mockSettings);

      expect(mockSessionManager.getSession).toHaveBeenCalledWith(1);
      expect(
        mockSessionManager.finalizeStreamingAndInsert
      ).not.toHaveBeenCalled();
    });

    it('should show a categorized toast when independent prompt generation fails', async () => {
      mockSessionManager.getSession.mockReturnValue(null);
      mockSettings.promptGenerationMode = 'independent-api';
      generatePromptsForMessageMock.mockRejectedValue(
        new AutoIllustratorError(
          'api-request-failed',
          'LLM generation failed',
          '401 Unauthorized'
        )
      );

      await handleMessageReceived(1, mockContext, mockSettings);

      expect(generatePromptsForMessageMock).toHaveBeenCalled();
      expect(toastrErrorMock).toHaveBeenCalledTimes(1);
      expect(hasIndependentPromptRetryState(1)).toBe(true);
      expect(String(toastrErrorMock.mock.calls[0][0])).toContain(
        '401 Unauthorized'
      );
    });

    it('should mark message as retryable when independent mode returns no prompts', async () => {
      mockSessionManager.getSession.mockReturnValue(null);
      mockSettings.promptGenerationMode = 'independent-api';
      generatePromptsForMessageMock.mockResolvedValue([]);

      await handleMessageReceived(1, mockContext, mockSettings);

      expect(hasIndependentPromptRetryState(1)).toBe(true);
      expect(mockSessionManager.startStreamingSession).not.toHaveBeenCalled();
    });

    it('should show a categorized toast when generated prompts cannot be inserted', async () => {
      mockSessionManager.getSession.mockReturnValue(null);
      mockSettings.promptGenerationMode = 'independent-api';
      generatePromptsForMessageMock.mockResolvedValue([
        {
          text: 'test prompt',
          insertAfter: 'Message',
          insertBefore: '1',
        },
      ]);
      insertPromptTagsWithContextMock.mockReturnValue({
        updatedText: 'Message 1',
        insertedCount: 0,
        failedSuggestions: [],
      });

      await handleMessageReceived(1, mockContext, mockSettings);

      expect(toastrErrorMock).toHaveBeenCalledTimes(1);
      expect(String(toastrErrorMock.mock.calls[0][0])).toContain(
        'promptInsertionFailed'
      );
    });

    it('should skip if session type is not streaming', async () => {
      mockSessionManager.getSession.mockReturnValue({
        sessionId: 'session1',
        messageId: 1,
        type: 'regeneration', // Not streaming
      });

      await handleMessageReceived(1, mockContext, mockSettings);

      expect(mockSessionManager.getSession).toHaveBeenCalledWith(1);
      expect(
        mockSessionManager.finalizeStreamingAndInsert
      ).not.toHaveBeenCalled();
    });

    it('should handle errors during finalization', async () => {
      mockSessionManager.getSession.mockReturnValue({
        sessionId: 'session1',
        messageId: 1,
        type: 'streaming',
      });
      mockSessionManager.finalizeStreamingAndInsert.mockRejectedValue(
        new Error('Test error')
      );

      // Should not throw, just log error
      await expect(
        handleMessageReceived(1, mockContext, mockSettings)
      ).resolves.not.toThrow();

      expect(mockSessionManager.finalizeStreamingAndInsert).toHaveBeenCalled();
    });

    it('should handle system messages', async () => {
      mockContext.chat[1].is_system = true;

      mockSessionManager.getSession.mockReturnValue({
        sessionId: 'session1',
        messageId: 1,
        type: 'streaming',
      });
      mockSessionManager.finalizeStreamingAndInsert.mockResolvedValue(2);

      await handleMessageReceived(1, mockContext, mockSettings);

      // Should process even for system messages (only skip user messages)
      expect(mockSessionManager.finalizeStreamingAndInsert).toHaveBeenCalled();
    });

    it('should skip if message has empty content', async () => {
      mockContext.chat[1].mes = '';

      await handleMessageReceived(1, mockContext, mockSettings);

      expect(mockSessionManager.getSession).not.toHaveBeenCalled();
      expect(
        mockSessionManager.finalizeStreamingAndInsert
      ).not.toHaveBeenCalled();
    });

    it('should show a toast for empty main replies in independent mode', async () => {
      mockContext.chat[1].mes = '';
      mockSettings.promptGenerationMode = 'independent-api';

      await handleMessageReceived(1, mockContext, mockSettings);

      expect(toastrErrorMock).toHaveBeenCalledTimes(1);
      expect(String(toastrErrorMock.mock.calls[0][0])).toContain(
        'errorReason.mainResponseEmpty'
      );
    });

    it('should skip if message has only whitespace', async () => {
      mockContext.chat[1].mes = '   \n  ';

      await handleMessageReceived(1, mockContext, mockSettings);

      expect(mockSessionManager.getSession).not.toHaveBeenCalled();
      expect(
        mockSessionManager.finalizeStreamingAndInsert
      ).not.toHaveBeenCalled();
    });

    it('should skip if message mes is undefined', async () => {
      mockContext.chat[1].mes = undefined;

      await handleMessageReceived(1, mockContext, mockSettings);

      expect(mockSessionManager.getSession).not.toHaveBeenCalled();
      expect(
        mockSessionManager.finalizeStreamingAndInsert
      ).not.toHaveBeenCalled();
    });
  });

  describe('handleGenerationEnded - Delayed Reconciliation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      global.SillyTavern.getContext = vi.fn().mockReturnValue(mockContext);
      mockSettings.finalReconciliationDelayMs = 5000;
    });

    afterEach(() => {
      vi.useRealTimers();
      cancelAllDelayedReconciliations(); // Clean up any pending timeouts
    });

    it('should run immediate reconciliation on GENERATION_ENDED', async () => {
      const {reconcileMessage} = await import('./reconciliation');

      await handleGenerationEnded(1, mockContext, mockSettings);

      // Should have called reconciliation once (immediate)
      expect(reconcileMessage).toHaveBeenCalledTimes(1);
      expect(reconcileMessage).toHaveBeenCalledWith(
        1,
        'Message 1',
        expect.anything()
      );
    });

    it('should schedule delayed reconciliation after GENERATION_ENDED', async () => {
      const {reconcileMessage} = await import('./reconciliation');
      vi.mocked(reconcileMessage).mockClear();

      await handleGenerationEnded(1, mockContext, mockSettings);

      // Should have immediate reconciliation
      expect(reconcileMessage).toHaveBeenCalledTimes(1);

      // Fast-forward 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      // Should have delayed reconciliation
      expect(reconcileMessage).toHaveBeenCalledTimes(2); // immediate + delayed
    });

    it('should not schedule delayed reconciliation if delay is 0', async () => {
      const {reconcileMessage} = await import('./reconciliation');
      vi.mocked(reconcileMessage).mockClear();

      mockSettings.finalReconciliationDelayMs = 0;
      await handleGenerationEnded(1, mockContext, mockSettings);

      // Only immediate reconciliation
      expect(reconcileMessage).toHaveBeenCalledTimes(1);

      // Fast-forward past any potential delay
      await vi.advanceTimersByTimeAsync(10000);

      // Still only immediate
      expect(reconcileMessage).toHaveBeenCalledTimes(1);
    });

    it('should cancel delayed reconciliation on chat change', async () => {
      const {reconcileMessage} = await import('./reconciliation');
      vi.mocked(reconcileMessage).mockClear();

      await handleGenerationEnded(1, mockContext, mockSettings);

      // Chat changes before delay expires
      handleChatChanged();

      // Fast-forward past the delay
      await vi.advanceTimersByTimeAsync(10000);

      // Should only have immediate reconciliation, delayed was cancelled
      expect(reconcileMessage).toHaveBeenCalledTimes(1);
    });

    it('should cancel existing delayed reconciliation when scheduling new one for same message', async () => {
      const {reconcileMessage} = await import('./reconciliation');
      vi.mocked(reconcileMessage).mockClear();

      // Schedule first
      await handleGenerationEnded(1, mockContext, mockSettings);

      // Schedule second for same message
      await handleGenerationEnded(1, mockContext, mockSettings);

      // Should have 2 immediate reconciliations
      expect(reconcileMessage).toHaveBeenCalledTimes(2);

      // Fast-forward
      await vi.advanceTimersByTimeAsync(5000);

      // Should have 2 immediate + 1 delayed (second one replaced first)
      expect(reconcileMessage).toHaveBeenCalledTimes(3);
    });

    it('should skip reconciliation for user messages', async () => {
      const {reconcileMessage} = await import('./reconciliation');
      vi.mocked(reconcileMessage).mockClear();

      await handleGenerationEnded(0, mockContext, mockSettings); // message 0 is user

      // Should not run reconciliation
      expect(reconcileMessage).not.toHaveBeenCalled();

      // Should not schedule delayed reconciliation either
      await vi.advanceTimersByTimeAsync(10000);
      expect(reconcileMessage).not.toHaveBeenCalled();
    });

    it('should handle missing message gracefully', async () => {
      const {reconcileMessage} = await import('./reconciliation');
      vi.mocked(reconcileMessage).mockClear();

      await handleGenerationEnded(999, mockContext, mockSettings); // non-existent message

      // Should not run reconciliation
      expect(reconcileMessage).not.toHaveBeenCalled();

      // Should not schedule delayed reconciliation either
      await vi.advanceTimersByTimeAsync(10000);
      expect(reconcileMessage).not.toHaveBeenCalled();
    });

    it('should skip reconciliation for empty messages (main API error)', async () => {
      const {reconcileMessage} = await import('./reconciliation');
      vi.mocked(reconcileMessage).mockClear();

      mockContext.chat[1].mes = '';
      await handleGenerationEnded(1, mockContext, mockSettings);

      expect(reconcileMessage).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(10000);
      expect(reconcileMessage).not.toHaveBeenCalled();
    });

    it('should skip reconciliation for whitespace-only messages', async () => {
      const {reconcileMessage} = await import('./reconciliation');
      vi.mocked(reconcileMessage).mockClear();

      mockContext.chat[1].mes = '   ';
      await handleGenerationEnded(1, mockContext, mockSettings);

      expect(reconcileMessage).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(10000);
      expect(reconcileMessage).not.toHaveBeenCalled();
    });

    it('should adjust messageId when it equals chat.length (SillyTavern bug)', async () => {
      const {reconcileMessage} = await import('./reconciliation');
      vi.mocked(reconcileMessage).mockClear();

      // GENERATION_ENDED sometimes emits chat.length instead of chat.length - 1
      // Our chat has 3 messages (indices 0, 1, 2), so chat.length = 3
      await handleGenerationEnded(3, mockContext, mockSettings);

      // Should have adjusted to messageId 2 and run reconciliation
      expect(reconcileMessage).toHaveBeenCalledTimes(1);
      expect(reconcileMessage).toHaveBeenCalledWith(
        2, // Adjusted from 3 to 2
        'Message 2',
        expect.anything()
      );

      // Should also schedule delayed reconciliation with adjusted messageId
      await vi.advanceTimersByTimeAsync(5000);
      expect(reconcileMessage).toHaveBeenCalledTimes(2);
      expect(reconcileMessage).toHaveBeenLastCalledWith(
        2,
        'Message 2',
        expect.anything()
      );
    });
  });

  describe('handleManualIndependentPromptRetry', () => {
    it('should regenerate prompts and restart non-streaming image generation', async () => {
      mockSettings.promptGenerationMode = 'independent-api';
      mockSettings.promptDetectionPatterns = ['<!--img-prompt="{PROMPT}"-->'];
      generatePromptsForMessageMock.mockResolvedValue([
        {
          text: 'test prompt',
          insertAfter: 'Message',
          insertBefore: '1',
        },
      ]);
      insertPromptTagsWithContextMock.mockReturnValue({
        updatedText: 'Message 1 <!--img-prompt="test prompt"-->',
        insertedCount: 1,
        failedSuggestions: [],
      });

      await handleManualIndependentPromptRetry(1, mockSettings);

      expect(generatePromptsForMessageMock).toHaveBeenCalledWith(
        'Message 1',
        mockContext,
        mockSettings,
        {}
      );
      expect(mockContext.chat[1].mes).toContain('<!--img-prompt="test prompt"-->');
      expect(mockSessionManager.startStreamingSession).toHaveBeenCalledWith(
        1,
        mockContext,
        mockSettings
      );
      expect(hasIndependentPromptRetryState(1)).toBe(false);
    });
  });
});
