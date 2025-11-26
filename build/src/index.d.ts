/**
 * Auto Illustrator Extension for SillyTavern
 * Automatically generates inline images based on story context
 */
import './style.css';
import { StreamingPreviewWidget } from './streaming_preview_widget';
export declare let currentGenerationType: string | null;
/**
 * Get the streaming preview widget instance
 * @returns Streaming preview widget or null if not initialized
 */
export declare function getStreamingPreviewWidget(): StreamingPreviewWidget | null;
/**
 * Checks if streaming generation is currently active
 * @param messageId - Optional message ID to check. If provided, checks if THIS message is streaming.
 *                    If omitted, checks if ANY message is streaming.
 * @returns True if streaming is in progress
 */
export declare function isStreamingActive(messageId?: number): boolean;
/**
 * Checks if a specific message is currently being streamed
 * @param messageId - Message ID to check
 * @returns True if this message is being streamed
 */
export declare function isMessageBeingStreamed(messageId: number): boolean;
/**
 * Applies the current image display width setting to all AI-generated images in chat
 * This allows retroactive width changes to already-generated images by updating the message HTML
 */
export declare function applyImageWidthToAllImages(): void;
