/**
 * World Info UI Module
 * Renders the world book selection panel and handles interactions.
 */
/**
 * Initializes the world info panel by fetching the book list.
 * Call after settings UI is mounted.
 */
export declare function initializeWorldInfoPanel(): Promise<void>;
/**
 * Renders the world book list with optional search filter.
 */
export declare function renderWorldBookList(filter?: string): void;
/**
 * Toggle world info panel visibility based on master toggle state.
 */
export declare function toggleWorldInfoPanelVisibility(enabled: boolean): void;
/**
 * Reloads world info UI for the current chat.
 * Call on CHAT_CHANGED.
 */
export declare function reloadWorldInfoForChat(): void;
/**
 * Registers event delegation on the world info containers.
 * Call once after settings HTML is inserted.
 */
export declare function registerWorldInfoEventListeners(): void;
