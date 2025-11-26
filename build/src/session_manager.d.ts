/**
 * Session Manager Module
 * Unified coordinator for streaming and regeneration sessions
 *
 * Architecture:
 * - Single pipeline for both streaming and click-to-regenerate modes
 * - One GenerationSession per message (mutually exclusive types)
 * - Explicit await conditions instead of Barrier
 * - Auto-finalize regenerations when all tasks complete (event-driven)
 *
 * Session Lifecycle:
 * 1. Streaming: startStreamingSession → finalizeStreamingAndInsert → endSession
 * 2. Regeneration: queueRegeneration → (auto-finalize on progress:all-tasks-complete) → endSession
 */
import type { GenerationSession, SessionType, ImageInsertionMode } from './types';
/**
 * Session Manager - Unified coordinator for streaming and regeneration
 */
export declare class SessionManager {
    private sessions;
    private completionListeners;
    /**
     * Starts a streaming session for a message
     * Creates queue, processor, and monitor for detecting prompts
     *
     * @param messageId - Message ID being streamed
     * @param context - SillyTavern context
     * @param settings - Extension settings
     * @returns The created streaming session
     */
    startStreamingSession(messageId: number, _context: SillyTavernContext, settings: AutoIllustratorSettings): Promise<GenerationSession>;
    /**
     * Sets up auto-finalization for streaming session (used for non-streaming messages)
     * Listens for progress:all-tasks-complete event and triggers finalization
     *
     * This is used when streaming is disabled in SillyTavern but we still need to
     * process the complete message and wait for images to generate before inserting.
     *
     * @param messageId - Message ID
     * @param context - SillyTavern context
     * @param settings - Extension settings
     */
    setupStreamingCompletion(messageId: number, context: SillyTavernContext, settings: AutoIllustratorSettings): void;
    /**
     * Finalizes non-streaming session and inserts all deferred images
     * Similar to finalizeStreamingAndInsert but also runs reconciliation
     *
     * @param messageId - Message ID to finalize
     * @param context - SillyTavern context
     * @param settings - Extension settings
     */
    private finalizeNonStreamingAndInsert;
    /**
     * Finalizes streaming and inserts all deferred images
     * Uses explicit await conditions instead of Barrier
     *
     * Steps:
     * 1. Stop monitor and seal totals (EXPLICIT CONDITION 1)
     * 2. Wait for all tasks to complete (EXPLICIT CONDITION 2)
     * 3. Batch insert all deferred images
     * 4. Cleanup
     *
     * @param messageId - Message ID to finalize
     * @param context - SillyTavern context
     * @returns Number of images successfully inserted
     */
    finalizeStreamingAndInsert(messageId: number, context: SillyTavernContext): Promise<number>;
    /**
     * Queues a regeneration request for a specific image
     * Creates or reuses regeneration session for the message
     * Auto-finalizes when all queued tasks complete (event-driven)
     *
     * @param messageId - Message ID containing the image
     * @param promptId - Prompt ID being regenerated (PromptNode.id)
     * @param imageUrl - URL of image to regenerate/replace
     * @param context - SillyTavern context
     * @param settings - Extension settings
     * @param mode - Insertion mode (default: 'replace-image')
     */
    queueRegeneration(messageId: number, promptId: string, imageUrl: string, context: SillyTavernContext, settings: AutoIllustratorSettings, mode?: ImageInsertionMode): Promise<void>;
    /**
     * Sets up completion listener for regeneration session
     * Listens for progress:all-tasks-complete event and triggers finalization
     *
     * @param messageId - Message ID
     * @param context - SillyTavern context
     */
    private setupCompletionListener;
    /**
     * Finalizes regeneration session and inserts all deferred images
     *
     * Steps:
     * 1. Wait for all regenerations to complete
     * 2. Batch insert all deferred images
     * 3. Cleanup
     *
     * @param messageId - Message ID to finalize
     * @param context - SillyTavern context
     * @returns Number of images successfully inserted
     */
    finalizeRegenerationAndInsert(messageId: number, context: SillyTavernContext): Promise<number>;
    /**
     * Cancels an active session and cleans up resources
     * Does NOT insert deferred images - use finalize methods for that
     *
     * @param messageId - Message ID to cancel
     */
    cancelSession(messageId: number): void;
    /**
     * Ends a session normally (after successful completion)
     *
     * @param messageId - Message ID
     */
    endSession(messageId: number): void;
    /**
     * Gets the active session for a message
     *
     * @param messageId - Message ID
     * @returns Active session or null if none exists
     */
    getSession(messageId: number): GenerationSession | null;
    /**
     * Gets all active sessions
     *
     * @returns Array of all active sessions
     */
    getAllSessions(): GenerationSession[];
    /**
     * Checks if a session is active for a specific message or any message
     *
     * @param messageId - Optional message ID to check
     * @returns True if session(s) exist
     */
    isActive(messageId?: number): boolean;
    /**
     * Gets session type for a message
     *
     * @param messageId - Message ID
     * @returns Session type or null if no session
     */
    getSessionType(messageId: number): SessionType | null;
    /**
     * Gets status summary of all active sessions
     *
     * @returns Status object with session counts and details
     */
    getStatus(): {
        totalSessions: number;
        streamingSessions: number;
        regenerationSessions: number;
        sessions: Array<{
            messageId: number;
            sessionId: string;
            type: SessionType;
            queueSize: number;
            uptime: number;
        }>;
    };
}
export declare const sessionManager: SessionManager;
