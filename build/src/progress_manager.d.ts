/**
 * Progress Manager Module
 * Centralized management of image generation progress tracking
 * Unifies progress widget state and regeneration tracking into a single source of truth
 *
 * Architecture: Pure domain layer using event-driven design
 * - No DOM dependencies
 * - No UI/widget coupling
 * - Emits events for all state changes
 * - Consumers (e.g., ProgressWidget) subscribe to events
 */
/**
 * Event detail for progress:started event
 */
export interface ProgressStartedEventDetail {
    messageId: number;
    total: number;
}
/**
 * Event detail for progress:updated event
 */
export interface ProgressUpdatedEventDetail {
    messageId: number;
    total: number;
    completed: number;
    succeeded: number;
    failed: number;
}
/**
 * Event detail for progress:all-tasks-complete event
 * Emitted when all currently registered tasks are complete (completed === total)
 * NOTE: More tasks may still be added! This does NOT mean the operation is finished.
 */
export interface ProgressAllTasksCompleteEventDetail {
    messageId: number;
    total: number;
    succeeded: number;
    failed: number;
    duration: number;
}
/**
 * Event detail for progress:cleared event
 * Emitted when tracking is cleared (operation finished, no more tasks coming)
 * This is when the widget should hide.
 */
export interface ProgressClearedEventDetail {
    messageId: number;
}
/**
 * Event detail for progress:image-completed event
 * Emitted when an image generation completes during streaming
 * Allows UI to show preview of completed images before insertion
 */
export interface ProgressImageCompletedEventDetail {
    messageId: number;
    imageUrl: string;
    promptText: string;
    promptPreview: string;
    completedAt: number;
}
/**
 * Centralized progress manager for image generation tasks
 * Pure domain layer with no UI dependencies
 *
 * Key features:
 * - Idempotent task registration (multiple calls just increment total)
 * - Event-driven architecture (emits events for all state changes)
 * - Single source of truth for all generation types (streaming, batch, regeneration)
 * - Success/failure tracking for detailed progress reporting
 *
 * Events emitted:
 * - progress:started - When tracking begins (first task registered)
 * - progress:updated - When task state changes or total changes
 * - progress:all-tasks-complete - When all CURRENT tasks complete (more may be added)
 * - progress:cleared - When tracking is cleared (operation finished, widget can hide)
 * - progress:image-completed - When an image completes during streaming (for preview UI)
 */
export declare class ProgressManager extends EventTarget {
    private states;
    constructor();
    /**
     * Registers new task(s) for a message
     * On first call: initializes tracking and emits progress:started (only if incrementBy > 0)
     * On subsequent calls: increments total and emits progress:updated
     *
     * Fix for issue #76: When incrementBy=0, we initialize state but defer progress:started
     * emission until actual tasks are registered. This prevents the progress widget from
     * appearing prematurely for existing messages.
     *
     * @param messageId - Message ID to track
     * @param incrementBy - Number of tasks to add (default: 1)
     * @returns New cumulative total task count
     */
    registerTask(messageId: number, incrementBy?: number): number;
    /**
     * Marks one task as completed (successful)
     * Emits progress:updated event, does NOT auto-clear
     * This allows streaming sessions to continue tracking even when current tasks complete
     *
     * @param messageId - Message ID
     */
    completeTask(messageId: number): void;
    /**
     * Marks one task as failed
     * Treats failure as completion for progress tracking purposes
     * Emits progress:updated event, does NOT auto-clear
     *
     * @param messageId - Message ID
     */
    failTask(messageId: number): void;
    /**
     * Updates the total count without changing completed count
     * Used when new prompts are discovered during streaming
     * Emits progress:updated event, or progress:started if transitioning from 0 tasks
     *
     * Fix for issue #76: When transitioning from total=0 to total>0, emit progress:started
     * instead of progress:updated to properly initialize the progress widget.
     *
     * @param messageId - Message ID
     * @param newTotal - New total task count
     */
    updateTotal(messageId: number, newTotal: number): void;
    /**
     * Clears all tracking for a message
     * Emits progress:cleared event (widget will hide)
     *
     * WHEN TO CALL (Operation Boundaries):
     * 1. Streaming operations: Call after LLM streaming completes/fails/cancels
     *    - NOT after each individual task completes during streaming
     *    - More tasks may be added dynamically during streaming
     * 2. Batch operations: Call after the entire batch completes
     *    - After all images in a batch have been generated
     * 3. Manual operations: Call only if isComplete() returns true
     *    - Multiple regeneration tasks may be queued
     *    - Check completion before clearing
     *
     * WHY: Tasks may be registered dynamically (streaming mode) or queued
     * (manual regeneration). Clearing should respect operation boundaries,
     * not task boundaries.
     *
     * @param messageId - Message ID to clear tracking for
     */
    clear(messageId: number): void;
    /**
     * Gets current state for a message (for debugging/UI)
     *
     * @param messageId - Message ID
     * @returns Current state or null if not tracked
     */
    getState(messageId: number): {
        current: number;
        total: number;
        succeeded: number;
        failed: number;
    } | null;
    /**
     * Checks if all tasks for a message are complete
     *
     * @param messageId - Message ID
     * @returns True if completed >= total
     */
    isComplete(messageId: number): boolean;
    /**
     * Checks if a message is currently being tracked
     *
     * @param messageId - Message ID
     * @returns True if tracking is active
     */
    isTracking(messageId: number): boolean;
    /**
     * Gets all tracked message IDs
     *
     * @returns Array of message IDs currently being tracked
     */
    getTrackedMessageIds(): number[];
    /**
     * Waits for all tasks to complete for a specific message
     * Returns a promise that resolves when completed >= total
     * Used for explicit await conditions in unified generation pipeline
     *
     * @param messageId - Message ID to wait for
     * @param options - Optional timeout and abort signal
     * @returns Promise that resolves when all tasks complete
     * @throws Error if timeout expires or operation is aborted
     */
    waitAllComplete(messageId: number, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<void>;
    /**
     * Decrements the total count (used when a task is cancelled before starting)
     * Emits progress:updated event
     *
     * @param messageId - Message ID
     * @param decrementBy - Number of tasks to remove (default: 1)
     */
    decrementTotal(messageId: number, decrementBy?: number): void;
    /**
     * Emits progress:started event
     * @private
     */
    private emitStarted;
    /**
     * Emits progress:updated event
     * @private
     */
    private emitUpdated;
    /**
     * Emits progress:all-tasks-complete event
     * @private
     */
    private emitAllTasksComplete;
    /**
     * Emits progress:cleared event
     * @private
     */
    private emitCleared;
    /**
     * Emits progress:image-completed event
     * Called externally when an image generation completes during streaming
     *
     * @param messageId - Message ID
     * @param imageUrl - URL of completed image
     * @param promptText - Full prompt text
     * @param promptPreview - Truncated prompt for display
     */
    emitImageCompleted(messageId: number, imageUrl: string, promptText: string, promptPreview: string): void;
}
export declare const progressManager: ProgressManager;
/**
 * Helper function: Marks a task as failed and clears progress if all tasks complete
 * Use this in manual generation operations where each task is independent.
 * For streaming operations, use failTask() + manual clear after streaming ends.
 *
 * @param messageId - Message ID
 */
export declare function failTaskAndClearIfComplete(messageId: number): void;
