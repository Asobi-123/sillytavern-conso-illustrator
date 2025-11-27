/**
 * Image Cleaner Module
 * Handles cleanup of expired AI-generated images from chat messages
 */
import type { AutoIllustratorChatMetadata } from './types';
/**
 * Image retention period configuration
 */
export declare const IMAGE_RETENTION_DAYS: {
    readonly DEFAULT: 1;
    readonly MIN: 1;
    readonly MAX: 7;
    readonly STEP: 1;
};
/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
    removedFromChat: number;
    removedFromRegistry: number;
    removedImageUrls: string[];
    messagesModified: number;
}
/**
 * Extracts timestamp from image URL
 * Expected format: /user/images/CharName/CharName_2025-11-26@23h33m48s.png
 */
export declare function extractImageTimestamp(imageUrl: string): Date | null;
/**
 * Checks if an image is expired based on retention period
 */
export declare function isImageExpired(imageUrl: string, retentionDays: number): boolean;
/**
 * Removes expired image blocks from a message text
 */
export declare function removeExpiredImagesFromText(messageText: string, retentionDays: number): {
    cleanedText: string;
    removedUrls: string[];
};
/**
 * Cleans up the PromptRegistry by removing references to deleted images
 */
export declare function cleanupRegistry(removedUrls: string[], metadata: AutoIllustratorChatMetadata): Promise<number>;
/**
 * Runs cleanup on all messages in the current chat
 */
export declare function cleanupCurrentChat(context: SillyTavernContext, metadata: AutoIllustratorChatMetadata, retentionDays: number): Promise<CleanupResult>;
/**
 * Exports the list of removed image URLs to localStorage
 * This is read by the cleanup.js script to delete actual files
 */
export declare function exportRemovedUrls(removedUrls: string[]): void;
/**
 * Main entry point for image cleanup
 * Called on extension initialization
 */
export declare function runStartupCleanup(context: SillyTavernContext, metadata: AutoIllustratorChatMetadata, settings: AutoIllustratorSettings): Promise<void>;
