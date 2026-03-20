/**
 * Character Fixed Tags UI Module
 * Renders the character tag management panel and handles interactions.
 *
 * Visibility rules:
 * - Auto-detected participants (name1, name2) → always shown
 * - Manually added NPCs → stored in per-chat metadata, shown only for that chat
 * - All other saved entries → hidden (but persist in global settings)
 */
/**
 * Initializes the character tags panel.
 * @param settings - Extension settings reference
 * @param saveFn - Function to call when settings change
 */
export declare function initializeCharacterTagsPanel(settings: AutoIllustratorSettings, saveFn: () => void): void;
/**
 * Reloads the character tag list for the current chat.
 * Call on CHAT_CHANGED.
 * Uses a short delay because SillyTavern may not have updated
 * name1 (persona) yet when CHAT_CHANGED fires.
 */
export declare function reloadCharacterTagsForChat(): void;
