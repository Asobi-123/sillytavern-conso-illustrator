/**
 * Message Handler Module (v2)
 * Unified event handling using SessionManager
 *
 * Updates:
 * - Uses SessionManager for both streaming and regeneration
 * - Removed old streaming detection/coordination logic
 * - Simplified to two events: STREAM_TOKEN_STARTED and MESSAGE_RECEIVED
 */
import { sessionManager } from './session_manager';
/**
 * Cancels all pending delayed reconciliations
 * Called when chat changes
 */
export declare function cancelAllDelayedReconciliations(): void;
/**
 * Handles STREAM_TOKEN_STARTED event
 * Starts a streaming session for the message
 *
 * @param messageId - Message ID being streamed
 * @param context - SillyTavern context
 * @param settings - Extension settings
 */
export declare function handleStreamTokenStarted(messageId: number, context: SillyTavernContext, settings: AutoIllustratorSettings): Promise<void>;
/**
 * Handles MESSAGE_RECEIVED event
 * Finalizes streaming session if active, otherwise processes complete message
 *
 * @param messageId - Message ID that was received
 * @param context - SillyTavern context
 * @param settings - Extension settings
 */
export declare function handleMessageReceived(messageId: number, context: SillyTavernContext, settings: AutoIllustratorSettings): Promise<void>;
/**
 * Handles GENERATION_ENDED event
 * Runs immediate reconciliation and schedules delayed final reconciliation
 *
 * @param messageId - Message ID that finished generation
 * @param context - SillyTavern context
 * @param settings - Extension settings
 */
export declare function handleGenerationEnded(messageId: number, context: SillyTavernContext, settings: AutoIllustratorSettings): Promise<void>;
/**
 * Creates event handlers for SillyTavern events
 *
 * @param settings - Extension settings
 * @returns Object with event handler functions
 */
export declare function createEventHandlers(settings: AutoIllustratorSettings): {
    onStreamTokenStarted: (messageId: number) => Promise<void>;
    onMessageReceived: (messageId: number) => Promise<void>;
    onGenerationEnded: (messageId: number) => Promise<void>;
};
/**
 * Handles chat change event
 * Cancels all active sessions and delayed reconciliations when switching chats
 */
export declare function handleChatChanged(): void;
/**
 * Gets current status of all active sessions (for debugging)
 *
 * @returns Status object with session details
 */
export declare function getSessionStatus(): ReturnType<typeof sessionManager.getStatus>;
