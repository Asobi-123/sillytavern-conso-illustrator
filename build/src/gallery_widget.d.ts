/**
 * Gallery Widget Module
 * Displays all generated images in the current chat, grouped by messages
 *
 * Architecture: Permanent widget separate from progress widget
 * - Scans chat messages to find all generated images
 * - Groups images by assistant message
 * - Provides thumbnail grid and modal viewer
 * - Reuses UI components from progress widget for consistency
 */
import type { ProgressManager } from './progress_manager';
/**
 * Gallery Widget View
 * Displays all generated images grouped by messages
 */
export declare class GalleryWidgetView {
    private progressManager;
    private messageGroups;
    private isWidgetVisible;
    private isWidgetMinimized;
    private messageOrder;
    private refreshTimeout;
    private readonly REFRESH_DEBOUNCE_MS;
    constructor(manager: ProgressManager);
    /**
     * Get gallery widget state from chat metadata
     */
    private getGalleryState;
    /**
     * Load saved state from chat metadata
     * Made public for use by chat_changed_handler
     */
    loadStateFromChatMetadata(): void;
    /**
     * Save current state to chat metadata
     */
    private saveStateToChatMetadata;
    /**
     * Load expanded messages state from chat metadata
     */
    private loadExpandedState;
    /**
     * Setup event listeners for auto-updates
     */
    private setupEventListeners;
    /**
     * Toggle gallery widget visibility
     */
    toggleVisibility(): void;
    /**
     * Show the gallery widget
     */
    show(): void;
    /**
     * Hide the gallery widget
     */
    hide(): void;
    /**
     * Refresh gallery by rescanning chat (debounced to prevent freeze with large galleries)
     * When multiple images complete rapidly, this batches the refreshes to avoid
     * scanning 629+ images multiple times per second
     */
    refreshGallery(): void;
    /**
     * Update gallery for a single message (incremental update)
     * Called when an image completes - much faster than full rescan
     */
    private updateSingleMessage;
    /**
     * Scan chat messages to extract all generated images (async to prevent blocking)
     * Yields control to event loop every 10 messages to prevent UI freeze with large chats
     */
    private scanChatForImagesAsync;
    /**
     * Get message groups in the configured display order
     */
    private getOrderedMessageGroups;
    /**
     * Immediately updates the display, bypassing any throttle
     * Used for user-triggered actions that need immediate feedback
     */
    private updateImmediately;
    /**
     * Update the gallery display
     */
    private updateDisplay;
    /**
     * Render minimized widget (FAB button)
     */
    private renderMinimizedWidget;
    /**
     * Update minimized widget without full rebuild
     */
    private updateMinimizedWidget;
    /**
     * Update expanded widget without full rebuild
     */
    private updateExpandedWidget;
    /**
     * Update message groups in the gallery content
     */
    private updateMessageGroups;
    /**
     * Update a message group element in place (for expand/collapse)
     */
    private updateMessageGroupInPlace;
    /**
     * Render expanded widget with all message groups
     */
    private renderExpandedWidget;
    /**
     * Render a single message group
     */
    private renderMessageGroup;
    /**
     * Create thumbnail gallery for a message group
     * Adapted from progress_widget.ts createThumbnailGallery
     */
    private createThumbnailGallery;
    /**
     * Show image modal viewer starting from a specific image
     * Opens global viewer with ALL chat images, not just from one message
     */
    private showImageModal;
    /**
     * Show all images from all messages in a single modal
     */
    private showAllImagesModal;
    /**
     * Get or create the gallery widget element
     */
    private getOrCreateGalleryWidget;
}
/**
 * Initialize the gallery widget
 */
export declare function initializeGalleryWidget(manager: ProgressManager): void;
/**
 * Get the gallery widget instance
 */
export declare function getGalleryWidget(): GalleryWidgetView | null;
/**
 * Reload gallery for new chat (called by chat_changed_handler)
 */
export declare function reloadGalleryForNewChat(): void;
