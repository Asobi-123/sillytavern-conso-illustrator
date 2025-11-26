/**
 * Queue Processor Module
 * Processes image generation queue asynchronously
 */
import { ImageGenerationQueue } from './streaming_image_queue';
import type { DeferredImage } from './types';
/**
 * Processes queued image generation prompts
 */
export declare class QueueProcessor {
    private queue;
    private settings;
    private messageId;
    private isRunning;
    private isProcessing;
    private maxConcurrent;
    private activeGenerations;
    private processPromise;
    private deferredImages;
    /**
     * Creates a new queue processor
     * @param queue - Image generation queue
     * @param settings - Extension settings
     * @param maxConcurrent - Maximum concurrent generations (default: 1)
     */
    constructor(queue: ImageGenerationQueue, settings: AutoIllustratorSettings, maxConcurrent?: number);
    /**
     * Starts processing the queue with deferred insertions
     * Images are generated during processing but inserted in batch after completion
     * @param messageId - Message being generated
     */
    start(messageId: number): void;
    /**
     * Stops processing the queue
     */
    stop(): void;
    /**
     * Processes the next item in the queue
     * This function is recursive and will continue until queue is empty or processor is stopped
     */
    private processNext;
    /**
     * Generates an image for a queued prompt
     * @param prompt - Queued prompt to process
     */
    private generateImageForPrompt;
    /**
     * Handles generation failure by creating a placeholder image
     * @param prompt - The prompt that failed
     * @param errorMessage - Error message to log
     */
    private handleGenerationFailure;
    /**
     * Processes all remaining prompts in the queue
     * Used when streaming ends to ensure all images are generated
     * Processes sequentially to respect maxConcurrent limit and avoid 429 errors
     * @returns Promise that resolves when all prompts are processed
     */
    processRemaining(): Promise<void>;
    /**
     * Triggers processing of next items in queue
     * Call this when new items are added to the queue
     */
    trigger(): void;
    /**
     * Gets deferred images that are ready for batch insertion
     * @returns Array of deferred images
     */
    getDeferredImages(): DeferredImage[];
    /**
     * Clears the deferred images array after batch insertion
     */
    clearDeferredImages(): void;
    /**
     * Gets the current status of the processor
     * @returns Processor status information
     */
    getStatus(): {
        isRunning: boolean;
        messageId: number;
        activeGenerations: number;
        maxConcurrent: number;
        queueStats: ReturnType<ImageGenerationQueue['getStats']>;
    };
}
