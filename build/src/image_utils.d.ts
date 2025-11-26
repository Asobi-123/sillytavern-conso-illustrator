/**
 * Image Utilities Module
 * Shared utilities for extracting and processing AI-generated images
 */
import type { ModalImage } from './modal_viewer';
/**
 * Normalizes an image URL by converting absolute URLs to relative paths
 * and decoding URL encoding for consistent lookups
 * This is needed because img.src returns absolute URL but we store relative paths
 * Special case: Data URIs (e.g., base64 SVG placeholders) are returned as-is
 * @param url - Image URL (absolute, relative, or data URI)
 * @returns Normalized relative path with decoded characters, or original data URI
 */
export declare function normalizeImageUrl(url: string): string;
/**
 * Extracts all AI-generated images from a message
 * @param messageText - Raw message text (HTML)
 * @param messageId - Message ID
 * @returns Array of images found in the message
 */
export declare function extractImagesFromMessage(messageText: string, messageId: number): ModalImage[];
/**
 * Collects all AI-generated images from all messages in the chat
 * @param context - SillyTavern context
 * @returns Array of all images in chat order
 */
export declare function collectAllImagesFromChat(context: SillyTavernContext): ModalImage[];
