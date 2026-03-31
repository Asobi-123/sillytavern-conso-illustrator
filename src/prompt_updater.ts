/**
 * Prompt Updater (v2)
 * Uses LLM to update prompts based on user feedback
 * Upgraded to use PromptManager tree structure instead of flat PromptMetadata
 */

import {createLogger} from './logger';
import promptUpdateTemplate from './presets/prompt_update.md';
import {
  getPromptForImage,
  refinePrompt,
  replacePromptTextInMessage,
  type PromptNode,
} from './prompt_manager';
import {getMetadata} from './metadata';
import {
  callIndependentLlmApi,
  isIndependentLlmConfigured,
} from './services/independent_llm';
import {DEFAULT_PROMPT_DETECTION_PATTERNS} from './constants';
import {renderMessageUpdate} from './utils/message_renderer';
import {htmlEncode} from './utils/dom_utils';
import {normalizeImageUrl} from './image_utils';

// Re-export PromptNode type for consumers
export type {PromptNode};

const logger = createLogger('PromptUpdater');

/**
 * Extracts updated prompt from LLM response
 * Expects <!--img-prompt="..."-->  or <img_prompt="..."> format
 *
 * @param llmResponse - Raw LLM response text
 * @returns Extracted prompt text or null if not found
 */
function extractUpdatedPrompt(llmResponse: string): string | null {
  for (const pattern of DEFAULT_PROMPT_DETECTION_PATTERNS) {
    const regex = new RegExp(pattern, 'i');
    const match = llmResponse.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

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
export async function generateUpdatedPrompt(
  imageUrl: string,
  userFeedback: string,
  context: SillyTavernContext,
  settings: AutoIllustratorSettings
): Promise<PromptNode | null> {
  logger.info(`Updating prompt for image with feedback: "${userFeedback}"`, {
    imageUrl,
  });

  const metadata = getMetadata();

  // Find parent prompt for this image
  const parent = getPromptForImage(imageUrl, metadata);
  if (!parent) {
    logger.error('No prompt found for image:', imageUrl);
    return null;
  }

  const currentPrompt = parent.text;
  const parentPromptId = parent.id;
  logger.debug('Current prompt:', currentPrompt);

  // Build system prompt and user prompt using template
  const systemPrompt =
    'You are a technical assistant helping to update image generation prompts. Output ONLY the updated prompt in HTML comment format. Do NOT write stories, explanations, or continue any roleplay.';

  // Use the template and replace placeholders
  const userPrompt = promptUpdateTemplate
    .replace('{{{currentPrompt}}}', currentPrompt)
    .replace('{{{userFeedback}}}', userFeedback);

  logger.debug('Sending prompt to LLM for update');

  // Determine which LLM path to use:
  // Independent LLM is only eligible when prompt generation mode is 'independent-api',
  // the toggle is ON, and the config (URL + model) is actually filled in.
  const isIndependentMode = settings.promptGenerationMode === 'independent-api';
  const useIndependent =
    isIndependentMode &&
    settings.useIndependentLlmApi &&
    isIndependentLlmConfigured(settings);

  let llmResponse: string;
  try {
    if (useIndependent) {
      // Use independent LLM API
      llmResponse = await callIndependentLlmApi(
        systemPrompt,
        userPrompt,
        settings
      );
    } else {
      if (
        isIndependentMode &&
        settings.useIndependentLlmApi &&
        !isIndependentLlmConfigured(settings)
      ) {
        // Toggle on but config incomplete — log and fall back
        logger.warn(
          'Independent LLM enabled but missing URL/model, falling back to shared API'
        );
      }
      // Use SillyTavern API (shared / fallback)
      if (!context.generateRaw) {
        logger.error('generateRaw not available in context');
        throw new Error('LLM generation not available');
      }
      llmResponse = await context.generateRaw({
        systemPrompt,
        prompt: userPrompt,
      });
    }
  } catch (error) {
    logger.error('LLM generation failed:', error);
    throw error;
  }

  // Extract updated prompt (expects <!--img-prompt="..."--> format)
  const updatedPrompt = extractUpdatedPrompt(llmResponse);
  if (!updatedPrompt) {
    logger.error('Failed to extract prompt from LLM response:', llmResponse);
    return null;
  }

  logger.info(`LLM generated updated prompt: "${updatedPrompt}"`);

  // Create child node in PromptManager tree
  const childNode = await refinePrompt(
    parentPromptId,
    updatedPrompt,
    userFeedback,
    'ai-refined',
    metadata
  );

  logger.info(`Created child node ${childNode.id} (parent: ${parentPromptId})`);
  logger.info(`Generated updated prompt: "${updatedPrompt}"`);

  return childNode;
}

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
export async function applyPromptUpdate(
  imageUrl: string,
  parentPromptId: string,
  childNode: PromptNode,
  context: SillyTavernContext,
  settings: AutoIllustratorSettings
): Promise<boolean> {
  const metadata = getMetadata();
  const normalized = normalizeImageUrl(imageUrl);
  const encodedNormalized = htmlEncode(normalized);
  const uriEncodedNormalized = encodeURI(normalized);

  // Find message containing this image (try normalized, encoded, and raw forms)
  const message = context.chat?.find(msg => {
    const text = msg.mes || '';
    return (
      text.includes(normalized) ||
      text.includes(uriEncodedNormalized) ||
      text.includes(encodedNormalized) ||
      text.includes(imageUrl)
    );
  });

  if (!message) {
    logger.error('Message containing image not found');
    return false;
  }

  const messageId = context.chat?.indexOf(message) ?? -1;
  if (messageId === -1) {
    logger.error('Could not determine message ID');
    return false;
  }

  // Replace prompt text in message (at parent's position, with child's text)
  const patterns =
    settings.promptDetectionPatterns || DEFAULT_PROMPT_DETECTION_PATTERNS;
  const updatedText = replacePromptTextInMessage(
    parentPromptId, // Replace at parent's position
    message.mes || '',
    childNode.text, // Use child's text
    patterns,
    metadata
  );

  // Update message
  message.mes = updatedText;

  // Render message with proper event sequence and save
  await renderMessageUpdate(messageId);

  logger.info('Prompt updated successfully in message', {
    messageId,
    newPrompt: childNode.text,
  });

  return true;
}
