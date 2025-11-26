/**
 * Prompt Updater (v2)
 * Uses LLM to update prompts based on user feedback
 * Upgraded to use PromptManager tree structure instead of flat PromptMetadata
 */
import { type PromptNode } from './prompt_manager';
export type { PromptNode };
/**
 * Generates an updated prompt using LLM feedback (without updating message text)
 *
 * Flow:
 * 1. Find parent prompt for image via PromptManager
 * 2. Call LLM to generate refined prompt based on feedback
 * 3. Create child node in PromptManager tree
 *
 * @param imageUrl - URL of the image whose prompt to update
 * @param userFeedback - User's requested changes
 * @param context - SillyTavern context
 * @param settings - Extension settings
 * @returns New child prompt node, or null if generation failed
 *
 * @example
 * const childNode = await generateUpdatedPrompt(
 *   "/images/test.png",
 *   "make the background more detailed",
 *   context,
 *   settings
 * );
 * if (childNode) {
 *   console.log("New prompt:", childNode.text);
 * }
 */
export declare function generateUpdatedPrompt(imageUrl: string, userFeedback: string, context: SillyTavernContext, settings: AutoIllustratorSettings): Promise<PromptNode | null>;
/**
 * Applies a prompt update to the message text
 *
 * Flow:
 * 1. Find message containing the image
 * 2. Replace prompt text in message (at parent's position, with child's text)
 * 3. Emit events and save chat
 *
 * @param imageUrl - URL of the image
 * @param parentPromptId - ID of the parent prompt node
 * @param childNode - Child node with updated prompt text
 * @param context - SillyTavern context
 * @param settings - Extension settings
 * @returns true if update succeeded, false otherwise
 */
export declare function applyPromptUpdate(imageUrl: string, parentPromptId: string, childNode: PromptNode, context: SillyTavernContext, settings: AutoIllustratorSettings): Promise<boolean>;
