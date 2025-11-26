/**
 * Message Renderer Utility
 *
 * Provides a standardized way to render message updates with proper event sequence
 * to ensure consistency across the extension.
 */
/**
 * Options for renderMessageUpdate function
 */
export interface RenderMessageUpdateOptions {
    /**
     * Skip saving metadata and chat.
     * Use this for optimization when save is not needed (e.g., when no changes were made).
     * Default: false
     */
    skipSave?: boolean;
}
/**
 * Renders message updates with proper event sequence:
 * 1. Emit MESSAGE_EDITED (triggers regex "Run on Edit" and other processing)
 * 2. Call updateMessageBlock() (render the message in DOM)
 * 3. Emit MESSAGE_UPDATED (notify other extensions that message is updated)
 * 4. Save metadata (persists changes to disk, includes chat save)
 *
 * This function ensures a consistent rendering pattern across the extension,
 * preventing bugs from missing events or incorrect save sequences.
 *
 * @param messageId - The message index to render
 * @param options - Optional configuration
 * @param options.skipSave - Set to true to skip saving (optimization when no changes made)
 *
 * @throws Error if context is not available
 *
 * @example
 * ```typescript
 * // Standard usage: render and save
 * await renderMessageUpdate(messageId);
 *
 * // Optimization: render without saving
 * await renderMessageUpdate(messageId, { skipSave: true });
 * ```
 */
export declare function renderMessageUpdate(messageId: number, options?: RenderMessageUpdateOptions): Promise<void>;
