/**
 * Image Generator Module
 * Handles image generation using the SD slash command and replacing prompts with images
 */
import type { DeferredImage, VibeTransferReferenceImage } from './types';
import { type ReconciliationConfig } from './reconciliation';
import { type SdStyleRandomConfig } from './services/sd_style_randomizer';
import type { VibeTransferGenerationConfig } from './types';
export { applyCommonTags, deduplicateTags, parseCommonTags, validateCommonTags, } from './services/prompt_tags';
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
 * Sets the subfolder label used for image storage.
 * When set, images will be saved to /user/images/{CharName}_{label}/ instead of /user/images/{CharName}/
 * @param label - Subfolder label, or null/empty to use default behavior
 * @param fullOverride - If true, ch_name is replaced entirely with label (no CharName prefix)
 */
export declare function setImageSubfolderLabel(label: string | null, fullOverride?: boolean): void;
/**
 * Generates an image using the SD slash command
 * All image generation goes through the global rate limiter
 * @param prompt - Image generation prompt
 * @param context - SillyTavern context
 * @param commonTags - Optional common style tags to apply
 * @param tagsPosition - Position for common tags ('prefix' or 'suffix')
 * @param signal - Optional AbortSignal for cancellation
 * @param sdStyleConfig - Optional config to randomly pick from extension_settings.sd.styles before each /sd call
 * @param vibeTransferConfig - Optional NovelAI Vibe Transfer config
 * @param onVibeReferencesUpdated - Optional callback for encoded Vibe cache persistence
 * @returns URL of generated image or null on failure
 */
export declare function generateImage(prompt: string, context: SillyTavernContext, commonTags?: string, tagsPosition?: 'prefix' | 'suffix', signal?: AbortSignal, sdStyleConfig?: SdStyleRandomConfig, vibeTransferConfig?: VibeTransferGenerationConfig, onVibeReferencesUpdated?: (references: VibeTransferReferenceImage[]) => void): Promise<string | null>;
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
