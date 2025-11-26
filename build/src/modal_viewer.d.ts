/**
 * Shared Modal Viewer Module
 * Provides a reusable image modal viewer for both progress widget and gallery widget
 */
/**
 * Image data for modal viewer
 */
export interface ModalImage {
    imageUrl: string;
    promptText: string;
    promptPreview: string;
    messageId?: number;
    imageIndex?: number;
}
/**
 * Modal viewer options
 */
export interface ModalViewerOptions {
    images: ModalImage[];
    initialIndex?: number;
    onClose?: () => void;
    onNavigate?: (newIndex: number) => void;
    title?: string;
}
/**
 * Image Modal Viewer Class
 * Handles displaying images in a full-screen modal with zoom, pan, and navigation
 */
export declare class ImageModalViewer {
    private images;
    private currentIndex;
    private onClose?;
    private onNavigate?;
    private title?;
    private backdrop?;
    private container?;
    private img?;
    private imageContainer?;
    private prevBtn?;
    private nextBtn?;
    private meta?;
    private promptDiv?;
    private info?;
    private zoomIndicator?;
    private tapIndicator?;
    private fullscreenBtn?;
    private rotateBtn?;
    private isFullscreen;
    private static rotationDegrees;
    private zoomState;
    private readonly MIN_ZOOM;
    private readonly MAX_ZOOM;
    private readonly ZOOM_STEP;
    private boundHandlers;
    private zoomIndicatorTimeout;
    constructor(options: ModalViewerOptions);
    /**
     * Create modal DOM structure
     */
    private createModal;
    /**
     * Setup all event handlers
     */
    private setupEventHandlers;
    /**
     * Setup zoom and pan event handlers
     */
    private setupZoomHandlers;
    /**
     * Setup touch event handlers for mobile
     */
    private setupTouchHandlers;
    /**
     * Navigate to a different image
     */
    private navigate;
    /**
     * Navigate to a specific index
     */
    private navigateToIndex;
    /**
     * Update the modal display
     */
    private updateDisplay;
    /**
     * Update navigation button states
     */
    private updateNavButtons;
    /**
     * Preload an image by index
     */
    private preloadImage;
    /**
     * Attach action button handlers
     */
    private attachActionHandlers;
    /**
     * Copy prompt text to clipboard
     */
    private copyPromptToClipboard;
    /**
     * Show a toast notification
     */
    private showToast;
    /**
     * Check if device is iOS
     */
    private isIOS;
    /**
     * Toggle fullscreen mode
     */
    private toggleFullscreen;
    /**
     * Enter fullscreen mode
     */
    private enterFullscreen;
    /**
     * Exit fullscreen mode
     */
    private exitFullscreen;
    /**
     * Update fullscreen button state
     */
    private updateFullscreenButton;
    /**
     * Rotate the image 90 degrees clockwise
     */
    private rotateImage;
    /**
     * Apply rotation and zoom transform to the image
     * Adds CSS class to swap dimensions when rotated 90° or 270°
     */
    private applyImageTransform;
    /**
     * Determine navigation direction based on tap position and image rotation
     * @param tapX - X coordinate of tap in viewport
     * @param tapY - Y coordinate of tap in viewport
     * @returns -1 for previous, 1 for next, 'fullscreen' for center tap, null for no action
     */
    private getNavigationFromTap;
    /**
     * Check if device is mobile
     */
    private isMobile;
    /**
     * Download an image (with iOS fallback)
     */
    private downloadImage;
    private updateImageTransform;
    private constrainToBounds;
    private resetZoom;
    private applyMomentum;
    private zoomTo;
    private updateZoomIndicator;
    private getTouchDistance;
    /**
     * Close the modal viewer
     */
    close(): void;
    /**
     * Update images in the modal (for dynamic updates)
     */
    updateImages(images: ModalImage[]): void;
}
/**
 * Open an image modal viewer
 */
export declare function openImageModal(options: ModalViewerOptions): ImageModalViewer;
