/**
 * Metadata Module
 * Centralized management of auto-illustrator chat metadata
 *
 * This module maintains a cached reference to the current chat's metadata
 * and automatically refreshes it when CHAT_CHANGED event is detected.
 *
 * Key design decisions:
 * - Cache metadata reference for performance (no need to call getContext() repeatedly)
 * - Auto-invalidate cache on CHAT_CHANGED (ensures we always use current chat's data)
 * - context.chatMetadata is a live reference, so cached pointer remains valid during session
 *
 * See docs/CHAT_METADATA_LIFECYCLE.md for detailed explanation
 */
import type { AutoIllustratorChatMetadata } from './types';
/**
 * Gets the current chat's auto-illustrator metadata
 * Returns cached reference (must be set by CHAT_CHANGED handler first)
 *
 * @returns Auto-illustrator metadata for current chat
 * @throws Error if metadata not initialized (CHAT_CHANGED hasn't fired yet)
 */
export declare function getMetadata(): AutoIllustratorChatMetadata;
/**
 * Loads and caches metadata from context
 * Called automatically on CHAT_CHANGED event
 * Exported for use by chat_changed_handler
 */
export declare function loadMetadataFromContext(): void;
/**
 * Saves the current metadata to the server
 * Call this after modifying metadata (e.g., after registering prompts or linking images)
 *
 * Uses debounced save to prevent blocking during streaming operations.
 * The save is delayed by 1 second to batch multiple rapid changes.
 */
export declare function saveMetadata(): Promise<void>;
