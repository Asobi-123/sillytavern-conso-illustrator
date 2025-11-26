/**
 * Centralized CHAT_CHANGED event handler
 *
 * This module owns the single CHAT_CHANGED listener and orchestrates
 * all cleanup/reload operations in the correct order to prevent race conditions.
 *
 * Execution Order:
 * 1. Load fresh metadata from new chat
 * 2. Cancel all active streaming sessions
 * 3. Execute UI/settings operations (clear state, reload settings, update UI)
 * 4. Reload gallery widget for new chat
 */
/**
 * Initialize the CHAT_CHANGED handler
 * Call this once during extension initialization
 */
export declare function initializeChatChangedHandler(): void;
