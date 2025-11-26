/**
 * Message Reconciliation Module
 *
 * Provides utilities for:
 * - Idempotency checking (preventing duplicate image insertions)
 * - Message validation (detecting if message modified since prompt detection)
 * - Reconciliation (restoring missing images from metadata)
 *
 * These utilities protect against race conditions where other handlers
 * modify message.mes between detection and insertion.
 */
import type { AutoIllustratorChatMetadata } from './types';
/**
 * Configuration for reconciliation behavior
 */
export interface ReconciliationConfig {
    /** Enable idempotency markers (default: true) */
    enableMarkers: boolean;
    /** Enable message validation via hashing (default: true) */
    enableValidation: boolean;
    /** Enable auto-reconciliation on missing images (default: true) */
    enableReconciliation: boolean;
    /** Micro-delay before reading message.mes (ms, default: 100) */
    insertionDelayMs: number;
}
/**
 * Default configuration
 */
export declare const DEFAULT_RECONCILIATION_CONFIG: ReconciliationConfig;
/**
 * Result of an idempotency check
 */
export interface IdempotencyCheckResult {
    /** True if image already inserted (marker found) */
    alreadyInserted: boolean;
    /** Position where marker was found (-1 if not found) */
    markerPosition: number;
    /** The marker text if found */
    markerText?: string;
}
/**
 * Result of message validation
 */
export interface ValidationResult {
    /** True if message appears significantly modified */
    modified: boolean;
    /** Original hash at detection time */
    originalHash: string;
    /** Current hash */
    currentHash: string;
    /** Percentage change (0-100) */
    changePercent: number;
}
/**
 * Result of reconciliation operation
 */
export interface ReconciliationResult {
    /** Number of missing images detected */
    missingCount: number;
    /** Number of images successfully restored */
    restoredCount: number;
    /** Errors encountered during reconciliation */
    errors: string[];
}
/**
 * Creates an idempotency marker for an image insertion
 * Normalizes the image URL to ensure consistency
 */
export declare function createMarker(promptId: string, imageUrl: string): string;
/**
 * Parses a marker to extract promptId and imageUrl
 */
export declare function parseMarker(marker: string): {
    promptId: string;
    imageUrl: string;
} | null;
/**
 * Checks if an image has already been inserted (idempotency check)
 * Normalizes the image URL to ensure consistent comparison
 */
export declare function checkIdempotency(messageText: string, promptId: string, imageUrl: string): IdempotencyCheckResult;
/**
 * Computes a simple hash of a string (FNV-1a algorithm)
 * Used for detecting message modifications
 */
export declare function hashString(str: string): string;
/**
 * Validates that a message hasn't been significantly modified since detection
 */
export declare function validateMessageState(originalText: string, currentText: string, threshold?: number): ValidationResult;
/**
 * Finds all markers in message text
 */
export declare function findAllMarkers(messageText: string): string[];
/**
 * Reconciles missing images in a message by comparing metadata with message text
 * Returns the updated message text with missing images restored
 */
export declare function reconcileMessage(messageId: number, messageText: string, metadata: AutoIllustratorChatMetadata): {
    updatedText: string;
    result: ReconciliationResult;
};
/**
 * Utility to introduce a micro-delay before insertion
 * Allows other post-processors to finish
 */
export declare function microDelay(ms: number): Promise<void>;
/**
 * Removes all idempotency markers from text
 * Used for cleaning chat history before sending to LLM
 *
 * @param text - Text to clean
 * @returns Text with all markers removed
 */
export declare function removeAllMarkers(text: string): string;
/**
 * Creates an image tag with consistent formatting
 * Used by both image insertion and reconciliation to ensure consistent format
 *
 * @param imageUrl - URL of the image (or placeholder data URI)
 * @param promptText - Full text of the prompt
 * @param promptId - ID of the prompt node
 * @param includeMarker - Whether to include the idempotency marker (default: true)
 * @param isFailed - Whether this is a failed placeholder image (default: false)
 * @param displayWidth - Display width percentage (default: 100)
 * @returns HTML string with marker and img tag
 */
export declare function createImageTag(imageUrl: string, promptText: string, promptId: string, includeMarker?: boolean, isFailed?: boolean, displayWidth?: number): string;
