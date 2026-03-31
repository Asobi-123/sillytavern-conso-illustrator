/**
 * Prompt Generation Service
 * Generates image prompts using a separate LLM call
 */
import type { PromptSuggestion } from '../prompt_insertion';
import type { AutoIllustratorChatMetadata, StandalonePromptResult } from '../types';
/**
 * Cleans message text for LLM consumption by removing noise content.
 * Strips HTML comments, user-specified tag blocks, CSS noise, and remaining HTML tags (keeping text content).
 *
 * @param text - Raw message text potentially containing HTML
 * @param filterTags - HTML tag names to remove entirely (e.g., ['style', 'script'])
 * @returns Cleaned plain text suitable for LLM analysis
 */
export declare function cleanMessageTextForLlm(text: string, filterTags?: string[]): string;
/**
 * Builds the CHARACTER INFO section from SillyTavern context.
 * Includes character description/personality, user persona, and scenario
 * based on settings flags.
 *
 * @param context - SillyTavern context
 * @param settings - Extension settings
 * @returns Formatted character info section, or empty string if nothing to include
 */
export declare function buildCharacterInfoSection(context: SillyTavernContext, settings: AutoIllustratorSettings): string;
/**
 * Builds the WORLD INFO section from selected world book entries.
 * Only includes entries explicitly enabled by the user (default off).
 *
 * @param settings - Extension settings
 * @param metadata - Current chat metadata
 * @returns Formatted world info section, or empty string if nothing to include
 */
export declare function buildWorldInfoSection(settings: AutoIllustratorSettings, metadata?: AutoIllustratorChatMetadata): Promise<string>;
/**
 * Generates image prompts for a message using separate LLM call
 *
 * Uses context.generateRaw() to analyze the message text and suggest
 * image prompts with context-based insertion points.
 *
 * @param messageText - The complete message text to analyze
 * @param context - SillyTavern context
 * @param settings - Extension settings
 * @returns Array of prompt suggestions, or empty array on failure
 *
 * @example
 * const suggestions = await generatePromptsForMessage(
 *   "She walked through the forest under the pale moonlight.",
 *   context,
 *   settings
 * );
 * // Returns: [{
 * //   text: "1girl, forest, moonlight, highly detailed",
 * //   insertAfter: "through the forest",
 * //   insertBefore: "under the pale"
 * // }]
 */
export declare function generatePromptsForMessage(messageText: string, context: SillyTavernContext, settings: AutoIllustratorSettings, metadata?: AutoIllustratorChatMetadata, options?: {
    messageId?: number;
}): Promise<PromptSuggestion[]>;
/**
 * Parses LLM response for standalone prompt generation.
 * Only extracts TEXT and REASONING fields (no INSERT_AFTER/INSERT_BEFORE).
 *
 * @param response - Raw LLM response text
 * @returns Array of parsed standalone prompt results
 */
export declare function parseStandalonePromptSuggestions(response: string): StandalonePromptResult[];
/**
 * Generates standalone image prompts from a scene description using LLM.
 *
 * @param sceneDescription - User-provided scene description
 * @param promptCount - Number of prompts to generate
 * @param includeCharInfo - Whether to include character info in context
 * @param includeWorldInfo - Whether to include world info in context
 * @param context - SillyTavern context
 * @param settings - Extension settings
 * @param metadata - Chat metadata (for world info config)
 * @returns Array of standalone prompt results
 */
export declare function generateStandalonePrompts(sceneDescription: string, promptCount: number, includeCharInfo: boolean, includeWorldInfo: boolean, context: SillyTavernContext, settings: AutoIllustratorSettings, metadata?: AutoIllustratorChatMetadata): Promise<StandalonePromptResult[]>;
