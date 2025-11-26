/**
 * Image Generator Module
 * Handles image generation using the SD slash command and replacing prompts with images
 */
import type { DeferredImage } from './types';
import { type ReconciliationConfig } from './reconciliation';
/**
 * Updates reconciliation configuration
 * @param config - Partial configuration to update
 */
export declare function updateReconciliationConfig(config: Partial<ReconciliationConfig>): void;
/**
 * Initializes the global image generation limiter
 * @param maxConcurrent - Maximum concurrent generations
 * @param minInterval - Minimum interval between generations (milliseconds)
 */
export declare function initializeConcurrencyLimiter(maxConcurrent: number, minInterval?: number): void;
/**
 * Updates the maximum concurrent limit
 * @param maxConcurrent - New max concurrent limit
 */
export declare function updateMaxConcurrent(maxConcurrent: number): void;
/**
 * Updates the minimum generation interval
 * @param minInterval - New minimum interval (milliseconds)
 */
export declare function updateMinInterval(minInterval: number): void;
/**
 * Generates an image using the SD slash command
 * All image generation goes through the global rate limiter
 * @param prompt - Image generation prompt
 * @param context - SillyTavern context
 * @param commonTags - Optional common style tags to apply
 * @param tagsPosition - Position for common tags ('prefix' or 'suffix')
 * @param signal - Optional AbortSignal for cancellation
 * @returns URL of generated image or null on failure
 */
export declare function generateImage(prompt: string, context: SillyTavernContext, commonTags?: string, tagsPosition?: 'prefix' | 'suffix', signal?: AbortSignal): Promise<string | null>;
/**
 * Parses a comma-separated string of tags into an array
 * @param tagsString - Comma-separated tags string
 * @returns Array of trimmed tag strings
 */
export declare function parseCommonTags(tagsString: string): string[];
/**
 * Deduplicates tags in a case-insensitive manner
 * Preserves the original case of the first occurrence
 * @param tags - Array of tag strings
 * @returns Deduplicated array of tags
 */
export declare function deduplicateTags(tags: string[]): string[];
/**
 * Validates common tags input
 * @param tags - Comma-separated tags string
 * @returns Validation result with error message if invalid
 */
export declare function validateCommonTags(tags: string): {
    valid: boolean;
    error?: string;
};
/**
 * Applies common style tags to a prompt based on position setting
 * Deduplicates tags to avoid repetition
 * @param prompt - Original image generation prompt
 * @param commonTags - Comma-separated common tags
 * @param position - Where to add tags ('prefix' or 'suffix')
 * @returns Enhanced prompt with common tags applied
 */
export declare function applyCommonTags(prompt: string, commonTags: string, position: 'prefix' | 'suffix'): string;
/**
 * Unified batch insertion for both streaming and regeneration modes
 * Handles new images (streaming) and regenerated images atomically
 *
 * Uses regex for prompt detection
 * Uses prompt_manager for image associations
 * Includes idempotency checks, validation, and reconciliation support
 *
 * @param deferredImages - Images to insert (streaming or regeneration)
 * @param messageId - Message ID to update
 * @param context - SillyTavern context
 * @param metadata - Auto-illustrator chat metadata
 * @returns Number of successfully inserted images
 */
export declare function insertDeferredImages(deferredImages: DeferredImage[], messageId: number, context: SillyTavernContext, metadata: import('./types').AutoIllustratorChatMetadata, settings: AutoIllustratorSettings): Promise<number>;
