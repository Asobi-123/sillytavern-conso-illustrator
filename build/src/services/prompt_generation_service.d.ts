/**
 * Prompt Generation Service
 * Generates image prompts using a separate LLM call
 */
import type { PromptSuggestion } from '../prompt_insertion';
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
export declare function generatePromptsForMessage(messageText: string, context: SillyTavernContext, settings: AutoIllustratorSettings): Promise<PromptSuggestion[]>;
