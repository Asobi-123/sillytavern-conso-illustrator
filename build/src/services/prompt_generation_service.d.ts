/**
 * Prompt Generation Service
 * Generates image prompts using a separate LLM call
 */
import type { PromptSuggestion } from '../prompt_insertion';
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
