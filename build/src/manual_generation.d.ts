/**
 * Manual Generation Module (v2)
 * Simplified to support only click-to-regenerate functionality
 *
 * Removed:
 * - Batch manual generation operations
 * - Manual generation dialog/button
 * - Replace/append mode selection
 *
 * Kept:
 * - Click-to-regenerate image handlers
 * - Image click listeners
 */
/**
 * Handles click on an image to regenerate it
 *
 * Flow:
 * 1. Show dialog to get user's choice (replace/append/delete)
 * 2. Get prompt associated with the image (from prompt_manager)
 * 3. Queue regeneration via sessionManager
 * 4. SessionManager auto-finalizes after 2s idle
 *
 * @param imageUrl - URL of the image to regenerate (can be absolute or relative)
 * @param messageId - Message ID containing the image
 * @param context - SillyTavern context
 * @param settings - Extension settings
 */
export declare function handleImageRegenerationClick(imageUrl: string, messageId: number, context: SillyTavernContext, settings: AutoIllustratorSettings): Promise<void>;
/**
 * Attaches click handlers to images in a message for regeneration
 *
 * @param messageId - Message ID to attach handlers to
 * @param context - SillyTavern context
 * @param settings - Extension settings
 */
export declare function attachRegenerationHandlers(messageId: number, context: SillyTavernContext, settings: AutoIllustratorSettings): void;
/**
 * Adds image click handlers to all messages in chat
 * Called on extension initialization and settings updates
 *
 * @param settings - Extension settings
 */
export declare function addImageClickHandlers(settings: AutoIllustratorSettings): void;
/**
 * Removes all image click handlers
 * Called when click-to-regenerate is disabled
 */
export declare function removeImageClickHandlers(): void;
