/**
 * Chat Change Operations Module
 *
 * Contains UI and settings operations that need to be executed when chat changes.
 * Extracted from index.ts to avoid circular dependencies with chat_changed_handler.
 */
/**
 * Initialize the module with current context and settings
 * Called once during extension initialization
 */
export declare function initializeChatChangeOperations(context: SillyTavernContext, settings: AutoIllustratorSettings, updateMaxConcurrent: (max: number) => void, updateMinInterval: (interval: number) => void, updateUI: () => void): void;
/**
 * Get current settings (for external access)
 */
export declare function getCurrentSettings(): AutoIllustratorSettings | null;
/**
 * Update current settings (called when settings are reloaded)
 */
export declare function updateCurrentSettings(settings: AutoIllustratorSettings): void;
/**
 * Execute all chat change operations
 * Called by chat_changed_handler after metadata is loaded and sessions are cancelled
 */
export declare function executeChatChangeOperations(): void;
