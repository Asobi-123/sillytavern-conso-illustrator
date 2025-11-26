/**
 * DOM Queue Module
 * Provides per-message DOM operation serialization using Bottleneck.Group
 * Prevents race conditions when multiple operations target the same message
 */
/**
 * Schedules a DOM operation for a specific message
 * Operations for the same message are serialized (one at a time)
 * Operations for different messages can run in parallel
 *
 * @param messageId - The message ID to schedule the operation for
 * @param operation - The async operation to perform
 * @param label - Optional label for debugging
 * @returns Result of the operation
 */
export declare function scheduleDomOperation<T>(messageId: number, operation: () => Promise<T>, label?: string): Promise<T>;
/**
 * Pauses the DOM queue for a message
 * Note: This is a placeholder for future implementation
 * Currently manual_generation.ts has its own queueing system
 *
 * @param messageId - The message ID to pause
 */
export declare function pauseMessageQueue(messageId: number): void;
/**
 * Resumes the DOM queue for a message
 * Note: This is a placeholder for future implementation
 *
 * @param messageId - The message ID to resume
 */
export declare function resumeMessageQueue(messageId: number): void;
/**
 * Checks if the queue for a message is paused
 * Note: This is a placeholder for future implementation
 *
 * @param _messageId - The message ID to check (unused)
 * @returns Always false in current implementation
 */
export declare function isMessageQueuePaused(_messageId: number): boolean;
/**
 * Gets the number of pending operations for a message
 *
 * @param messageId - The message ID to check
 * @returns Number of pending operations
 */
export declare function getQueueLength(messageId: number): number;
/**
 * Clears the queue for a message (useful when message is deleted)
 *
 * @param messageId - The message ID to clear
 */
export declare function clearMessageQueue(messageId: number): Promise<void>;
/**
 * Deletes all queues and cleans up
 * Useful for testing or extension cleanup
 */
export declare function deleteAllQueues(): Promise<void>;
