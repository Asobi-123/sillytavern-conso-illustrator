/**
 * Streaming Preview Widget Module
 * Displays streaming text with inline images for an immersive experience
 *
 * Architecture: Independent widget that doesn't modify existing features
 * - Shows streaming text in real-time
 * - Inserts images inline at their detected positions
 * - Remains visible until manually dismissed by user
 * - Works alongside existing progress and gallery widgets
 */
import type { ProgressManager } from './progress_manager';
/**
 * Streaming Preview Widget - Shows text and inline images during streaming
 */
export declare class StreamingPreviewWidget {
    private readonly progressManager;
    private readonly STORAGE_KEY;
    private isMinimized;
    private isVisible;
    private currentMessageId;
    private lastSeenText;
    private contentSegments;
    private widget;
    private promptDetectionPatterns;
    private autoScrollEnabled;
    private scrollCheckTimeout;
    private isUserScrolling;
    private lastScrollTop;
    private textBuffer;
    private displayedText;
    private animationFrameId;
    private lastUpdateTime;
    private lastRenderTime;
    private lastRenderedText;
    private renderScheduled;
    private readonly CHARS_PER_SECOND;
    private readonly RENDER_INTERVAL_MS;
    private readonly INITIAL_BUFFER_DELAY;
    private streamingStartTime;
    private hasStartedDisplaying;
    /**
     * Initialize the streaming preview widget
     * @param manager - Progress manager for image completion events
     * @param promptPatterns - Regex patterns for detecting image prompts
     */
    constructor(manager: ProgressManager, promptPatterns?: string[]);
    /**
     * Load widget state from localStorage
     */
    private loadStateFromStorage;
    /**
     * Save widget state to localStorage
     */
    private saveStateToStorage;
    /**
     * Start showing the widget for a streaming message
     * @param messageId - Index of the message being streamed
     */
    start(messageId: number): void;
    /**
     * Update the widget with new streaming text
     * @param text - Current message text
     */
    updateText(text: string): void;
    /**
     * Parse text and create segments with text and image placeholders
     * @param text - Full message text
     */
    private parseTextAndUpdateSegments;
    /**
     * Handle image completion event
     * @param detail - Image completion event details
     */
    private handleImageCompleted;
    /**
     * Animation loop using requestAnimationFrame
     * CRITICAL: Must be fast (< 1ms) - only updates displayedText position
     * Rendering happens separately via scheduleRender()
     */
    private animate;
    /**
     * Schedule a render if not already scheduled
     * Renders are throttled to RENDER_INTERVAL_MS (~10fps) to avoid excessive DOM updates
     * This is called from the fast animate() loop but executes independently
     */
    private scheduleRender;
    /**
     * Actually perform the render
     * Only renders if displayedText has changed since last render
     */
    private performRender;
    /**
     * Get segments adjusted for current display position
     * Truncates text content to match displayedText length
     */
    private getDisplaySegments;
    /**
     * Mark streaming as complete (but keep widget visible)
     */
    markComplete(): void;
    /**
     * Toggle minimize/expand state
     */
    toggleMinimize(): void;
    /**
     * Close and hide the widget
     */
    close(): void;
    /**
     * Clear state when chat changes
     */
    clearState(): void;
    /**
     * Render the widget to DOM
     */
    private render;
    /**
     * Create the widget HTML structure
     */
    private createWidget;
    /**
     * Handle scroll event to detect manual scrolling
     * @param content - Content element
     */
    private handleScroll;
    /**
     * Update widget content with current segments
     * Uses smart DOM updates to prevent flickering
     */
    private updateWidgetContent;
    /**
     * Check if content is scrolled to bottom
     * @param element - Scrollable element
     * @returns True if at bottom
     */
    private isScrolledToBottom;
    /**
     * Update an existing image element with smooth transition
     * @param container - Existing container element
     * @param segment - New segment data
     * @param oldStatus - Previous status
     */
    private updateImageElement;
    /**
     * Create an image element (placeholder or completed image)
     * @param segment - Image segment data
     * @returns HTML element
     */
    private createImageElement;
    /**
     * Open image in modal viewer
     * @param segment - Image segment with imageUrl
     */
    private openImageInModal;
    /**
     * Truncate prompt text for display
     * @param prompt - Full prompt text
     * @param maxLength - Maximum length
     * @returns Truncated prompt
     */
    private truncatePrompt;
    /**
     * Insert widget into DOM
     */
    private insertIntoDom;
    /**
     * Remove widget from DOM
     */
    private removeFromDOM;
    /**
     * Check if widget is currently visible
     * @returns True if visible
     */
    isActive(): boolean;
    /**
     * Get current widget state for debugging
     * @returns Widget state information
     */
    getStatus(): {
        isVisible: boolean;
        isMinimized: boolean;
        messageId: number;
        segmentCount: number;
    };
}
