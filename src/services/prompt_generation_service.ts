/**
 * Prompt Generation Service
 * Generates image prompts using a separate LLM call
 */

import {createLogger} from '../logger';
import promptGenerationTemplate from '../presets/prompt_generation.md';
import standalonePromptTemplate from '../presets/standalone_prompt_generation.md';
import type {PromptSuggestion} from '../prompt_insertion';
import {callIndependentLlmApi} from './independent_llm';
import {fetchWorldBookEntries} from './worldinfo_service';
import {isIndependentApiMode} from '../mode_utils';
import {
  AutoIllustratorError,
  toAutoIllustratorError,
} from '../utils/error_utils';
import type {
  AutoIllustratorChatMetadata,
  PluginWorldInfoConfig,
  StandalonePromptResult,
} from '../types';

const logger = createLogger('PromptGenService');

function normalizeDelimitedLlmResponse(response: string): string {
  let cleanedResponse = response.trim();
  if (cleanedResponse.startsWith('```')) {
    cleanedResponse = cleanedResponse.replace(/^```[a-z]*\s*\n?/, '');
    cleanedResponse = cleanedResponse.replace(/\n?```\s*$/, '');
    cleanedResponse = cleanedResponse.trim();
  }
  return cleanedResponse;
}

function isExplicitNoPromptResponse(response: string): boolean {
  return normalizeDelimitedLlmResponse(response) === '---END---';
}

/**
 * Cleans message text for LLM consumption by removing noise content.
 * Strips HTML comments, user-specified tag blocks, CSS noise, and remaining HTML tags (keeping text content).
 *
 * @param text - Raw message text potentially containing HTML
 * @param filterTags - HTML tag names to remove entirely (e.g., ['style', 'script'])
 * @returns Cleaned plain text suitable for LLM analysis
 */
export function cleanMessageTextForLlm(
  text: string,
  filterTags?: string[]
): string {
  let cleaned = text;

  // 1. Remove HTML comments (<!-- ... -->) including multiline
  //    These contain draft/compliance metadata that's pure noise
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // 2a. Remove user-specified HTML tag blocks (e.g., <style>...</style>, <script>...</script>)
  if (filterTags && filterTags.length > 0) {
    for (const tag of filterTags) {
      const sanitized = tag.trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (!sanitized) continue;
      const tagRegex = new RegExp(
        `<${sanitized}[^>]*>[\\s\\S]*?<\\/${sanitized}>`,
        'gi'
      );
      cleaned = cleaned.replace(tagRegex, '');
    }
  }

  // 2b. Built-in CSS noise removal
  // Remove @keyframes blocks: @keyframes name { ... }
  cleaned = cleaned.replace(
    /@keyframes\s+[^{]+\{[^}]*(?:\{[^}]*\}[^}]*)*\}/gi,
    ''
  );
  // Remove @media query blocks: @media (...) { ... }
  cleaned = cleaned.replace(/@media\s+[^{]+\{[^}]*(?:\{[^}]*\}[^}]*)*\}/gi, '');
  // Remove CSS selector rule blocks: .class { }, #id { }, element { }
  cleaned = cleaned.replace(
    /(?:^|\n)\s*(?:[.#][\w-]+|[\w]+(?:\s*[>+~]\s*[\w.#]+)*)\s*\{[^}]*\}/gm,
    ''
  );

  // 3. Strip remaining HTML tags but keep their text content
  //    e.g., <details><summary>Title</summary>Content</details> → Title Content
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // 4. Collapse multiple blank lines into at most two
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // 5. Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Builds the CHARACTER INFO section from SillyTavern context.
 * Includes character description/personality, user persona, and scenario
 * based on settings flags.
 *
 * @param context - SillyTavern context
 * @param settings - Extension settings
 * @returns Formatted character info section, or empty string if nothing to include
 */
export function buildCharacterInfoSection(
  context: SillyTavernContext,
  settings: AutoIllustratorSettings
): string {
  if (
    !settings.injectCharacterDescription &&
    !settings.injectUserPersona &&
    !settings.injectScenario
  ) {
    return '';
  }

  let fields: {
    description?: string;
    personality?: string;
    persona?: string;
    scenario?: string;
  } = {};
  try {
    fields = context.getCharacterCardFields?.() ?? {};
  } catch {
    logger.debug('getCharacterCardFields not available');
    return '';
  }

  // Get a fresh context snapshot for name1/name2/characterId
  // (the cached context passed in may have stale values from init time)
  const freshCtx = SillyTavern.getContext();

  const sections: string[] = [];

  if (settings.injectCharacterDescription) {
    const charName =
      freshCtx.characters?.[freshCtx.characterId]?.name ||
      freshCtx.name2 ||
      'Character';
    const desc = fields.description?.trim();
    const pers = fields.personality?.trim();
    if (desc || pers) {
      sections.push(`Character Name: ${charName}`);
      if (desc) sections.push(`Character Description: ${desc}`);
      if (pers) sections.push(`Character Personality: ${pers}`);
    }
  }

  if (settings.injectUserPersona) {
    const name1 = freshCtx.name1 || 'User';
    const persona = fields.persona?.trim();
    if (persona) {
      sections.push(`User Name: ${name1}`);
      sections.push(`User Persona: ${persona}`);
    }
  }

  if (settings.injectScenario) {
    const scenario = fields.scenario?.trim();
    if (scenario) {
      sections.push(`Scenario: ${scenario}`);
    }
  }

  if (sections.length === 0) return '';

  return `=== CHARACTER INFO ===\n${sections.join('\n')}\n\n`;
}

/**
 * Builds the WORLD INFO section from selected world book entries.
 * Only includes entries explicitly enabled by the user (default off).
 *
 * @param settings - Extension settings
 * @param metadata - Current chat metadata
 * @returns Formatted world info section, or empty string if nothing to include
 */
export async function buildWorldInfoSection(
  settings: AutoIllustratorSettings,
  metadata?: AutoIllustratorChatMetadata
): Promise<string> {
  if (!settings.injectWorldInfo) return '';

  const config: PluginWorldInfoConfig | undefined = metadata?.worldInfoConfig;
  if (
    !config ||
    !config.selectedWorldBooks ||
    config.selectedWorldBooks.length === 0
  ) {
    return '';
  }

  const bookSections = await Promise.all(
    config.selectedWorldBooks.map(async bookName => {
      const overrides =
        config.worldBookOverrides[bookName]?.entryOverrides ?? {};
      const enabledUids = Object.entries(overrides)
        .filter(([, enabled]) => enabled === true)
        .map(([uid]) => Number(uid));

      if (enabledUids.length === 0) {
        return '';
      }

      try {
        const entries = await fetchWorldBookEntries(bookName);
        const enabledSet = new Set(enabledUids);
        const enabledEntries = entries.filter(e => enabledSet.has(e.uid));

        if (enabledEntries.length === 0) {
          return '';
        }

        const entryLines = enabledEntries
          .map(e => {
            const title = e.comment || `Entry #${e.uid}`;
            return `${title}: ${e.content}`;
          })
          .join('\n');

        return `[${bookName}]\n${entryLines}`;
      } catch (error) {
        logger.warn(
          `Failed to fetch entries for world book "${bookName}":`,
          error
        );
        return '';
      }
    })
  );

  const nonEmptySections = bookSections.filter(Boolean);
  if (nonEmptySections.length === 0) return '';

  return `=== WORLD INFO ===\n${nonEmptySections.join('\n\n')}\n\n`;
}

/**
 * Builds user prompt with context from previous messages
 * Format: === CHARACTER INFO === ... === WORLD INFO === ... === CONTEXT === ... === CURRENT MESSAGE === ...
 *
 * @param context - SillyTavern context
 * @param currentMessageText - The message to generate prompts for
 * @param contextMessageCount - Number of previous messages to include as context
 * @param settings - Extension settings (for character info injection and content filter)
 * @param worldInfoSection - Pre-built world info section (async, built externally)
 * @returns Formatted user prompt with context
 */
function buildUserPromptWithContext(
  context: SillyTavernContext,
  currentMessageText: string,
  contextMessageCount: number,
  settings: AutoIllustratorSettings,
  worldInfoSection = ''
): string {
  // Get recent chat history (last N messages, excluding current)
  const chat = context.chat || [];
  const startIndex = Math.max(0, chat.length - contextMessageCount - 1);
  const recentMessages = chat.slice(startIndex, -1); // Last N messages before current

  let contextText = '';
  if (recentMessages.length > 0 && contextMessageCount > 0) {
    contextText = recentMessages
      .map(msg => {
        const name = msg.name || (msg.is_user ? 'User' : 'Assistant');
        const text = cleanMessageTextForLlm(
          msg.mes || '',
          settings.contentFilterTags
        );
        return `${name}: ${text}`;
      })
      .join('\n\n');
  } else {
    contextText = '(No previous messages)';
  }

  const characterInfo = buildCharacterInfoSection(context, settings);

  return `${characterInfo}${worldInfoSection}=== CONTEXT ===
${contextText}

=== CURRENT MESSAGE ===
${currentMessageText}`;
}

/**
 * Parses LLM response and extracts prompt suggestions
 * Expects plain text delimiter format:
 * ---PROMPT---
 * TEXT: ...
 * INSERT_AFTER: ...
 * INSERT_BEFORE: ...
 * REASONING: ...
 * ---END---
 *
 * @param llmResponse - Raw LLM response text
 * @returns Array of parsed prompt suggestions, or empty array if parsing fails
 */
function parsePromptSuggestions(llmResponse: string): PromptSuggestion[] {
  try {
    const cleanedResponse = normalizeDelimitedLlmResponse(llmResponse);

    // Split by ---PROMPT--- delimiter
    const promptBlocks = cleanedResponse.split('---PROMPT---');
    const validSuggestions: PromptSuggestion[] = [];

    for (const block of promptBlocks) {
      // Skip empty blocks or the part before first ---PROMPT---
      if (!block.trim() || !block.includes('TEXT:')) {
        continue;
      }

      // Stop at ---END--- marker if present
      const blockContent = block.split('---END---')[0];

      // Extract fields using regex - more robust than split
      // TEXT supports multi-line content (e.g. Scene/Character/UC structure)
      // Falls back to single-line capture for backward compatibility
      const textMatch =
        blockContent.match(
          /^TEXT:\s*([\s\S]+?)(?=\n\s*(?:INSERT_AFTER|INSERT_BEFORE|REASONING):)/m
        ) || blockContent.match(/^TEXT:\s*(.+?)$/m);
      const insertAfterMatch = blockContent.match(/^INSERT_AFTER:\s*(.+?)$/m);
      const insertBeforeMatch = blockContent.match(/^INSERT_BEFORE:\s*(.+?)$/m);
      const reasoningMatch = blockContent.match(/^REASONING:\s*(.+?)$/m);

      // Check required fields
      if (!textMatch || !insertAfterMatch || !insertBeforeMatch) {
        const missingFields = [];
        if (!textMatch) missingFields.push('TEXT');
        if (!insertAfterMatch) missingFields.push('INSERT_AFTER');
        if (!insertBeforeMatch) missingFields.push('INSERT_BEFORE');
        logger.warn(
          `Skipping prompt block with missing required fields: ${missingFields.join(', ')}`
        );
        logger.debug('Block content preview:', blockContent.substring(0, 200));
        continue;
      }

      const text = textMatch[1].trim();
      const insertAfter = insertAfterMatch[1].trim();
      const insertBefore = insertBeforeMatch[1].trim();
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : undefined;

      // Check non-empty
      if (!text || !insertAfter || !insertBefore) {
        const emptyFields = [];
        if (!text) emptyFields.push('TEXT');
        if (!insertAfter) emptyFields.push('INSERT_AFTER');
        if (!insertBefore) emptyFields.push('INSERT_BEFORE');
        logger.warn(
          `Skipping prompt block with empty fields: ${emptyFields.join(', ')}`
        );
        logger.debug('Block content preview:', blockContent.substring(0, 200));
        continue;
      }

      validSuggestions.push({
        text,
        insertAfter,
        insertBefore,
        reasoning,
      });
    }

    logger.info(
      `Parsed ${validSuggestions.length} valid suggestions from LLM response`
    );
    return validSuggestions;
  } catch (error) {
    logger.error('Failed to parse LLM response:', error);
    logger.debug('Raw response:', llmResponse);
    return [];
  }
}

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
export async function generatePromptsForMessage(
  messageText: string,
  context: SillyTavernContext,
  settings: AutoIllustratorSettings,
  metadata?: AutoIllustratorChatMetadata
): Promise<PromptSuggestion[]> {
  logger.info('Generating image prompts using separate LLM call');
  logger.debug(`Message length: ${messageText.length} characters`);

  // Clean message text for LLM (remove HTML noise)
  const cleanedMessageText = cleanMessageTextForLlm(
    messageText,
    settings.contentFilterTags
  );
  logger.debug(
    `Cleaned message length: ${cleanedMessageText.length} characters (removed ${messageText.length - cleanedMessageText.length})`
  );

  // Check for LLM availability when using SillyTavern's shared API path
  if (!settings.useIndependentLlmApi && !context.generateRaw) {
    logger.error('generateRaw not available in context');
    throw new AutoIllustratorError(
      'llm-unavailable',
      'LLM generation not available'
    );
  }

  // Build system prompt with all instructions from template
  let systemPrompt = promptGenerationTemplate;

  // Replace FREQUENCY_GUIDELINES with user's custom or default
  const frequencyGuidelines = settings.llmFrequencyGuidelines || '';
  systemPrompt = systemPrompt.replace(
    '{{FREQUENCY_GUIDELINES}}',
    frequencyGuidelines
  );

  // Replace PROMPT_WRITING_GUIDELINES with user's custom or default
  const promptWritingGuidelines = settings.llmPromptWritingGuidelines || '';
  systemPrompt = systemPrompt.replace(
    '{{PROMPT_WRITING_GUIDELINES}}',
    promptWritingGuidelines
  );

  // Build user prompt with context and cleaned current message
  const contextMessageCount = settings.contextMessageCount || 10;

  // Build world info section (async — must be done before building user prompt)
  const worldInfoSection = await buildWorldInfoSection(settings, metadata);

  const userPrompt = buildUserPromptWithContext(
    context,
    cleanedMessageText,
    contextMessageCount,
    settings,
    worldInfoSection
  );

  logger.debug('Calling LLM for prompt generation');
  logger.debug('Context message count:', contextMessageCount);
  logger.debug('User prompt length:', userPrompt.length);
  logger.trace('User prompt:', userPrompt);

  // Call LLM (use independent API if configured, otherwise use SillyTavern API)
  let llmResponse: string;
  try {
    if (settings.useIndependentLlmApi) {
      logger.debug('Using independent LLM API for prompt generation');
      llmResponse = await callIndependentLlmApi(
        systemPrompt,
        userPrompt,
        settings
      );
    } else {
      logger.debug('Using SillyTavern API (generateRaw) for prompt generation');
      llmResponse = await context.generateRaw({
        systemPrompt,
        prompt: userPrompt,
      });
    }

    logger.debug('LLM response received');
    logger.trace('Raw LLM response:', llmResponse);
  } catch (error) {
    logger.error('LLM generation failed:', error);
    throw toAutoIllustratorError(
      error,
      'api-request-failed',
      'LLM generation failed'
    );
  }

  if (!normalizeDelimitedLlmResponse(llmResponse)) {
    throw new AutoIllustratorError(
      'llm-empty-response',
      'LLM returned empty response'
    );
  }

  // Parse response
  const suggestions = parsePromptSuggestions(llmResponse);

  if (suggestions.length === 0) {
    if (isExplicitNoPromptResponse(llmResponse)) {
      logger.info('LLM explicitly returned no prompt suggestions');
      return [];
    }

    logger.warn('LLM returned no valid suggestions');
    throw new AutoIllustratorError(
      'no-valid-prompts',
      'LLM returned no valid prompt suggestions'
    );
  }

  // Apply maxPromptsPerMessage limit
  const maxPrompts = settings.maxPromptsPerMessage || 5;
  if (suggestions.length > maxPrompts) {
    logger.info(
      `Limiting prompts from ${suggestions.length} to ${maxPrompts} (maxPromptsPerMessage)`
    );
    return suggestions.slice(0, maxPrompts);
  }

  logger.info(
    `Successfully generated ${suggestions.length} prompt suggestions`
  );

  // Log suggestions for debugging
  suggestions.forEach((s, i) => {
    logger.debug(`Suggestion ${i + 1}:`, {
      text: s.text.substring(0, 60) + (s.text.length > 60 ? '...' : ''),
      after: s.insertAfter.substring(0, 30),
      before: s.insertBefore.substring(0, 30),
      reasoning: s.reasoning,
    });
  });

  return suggestions;
}

/**
 * Parses LLM response for standalone prompt generation.
 * Only extracts TEXT and REASONING fields (no INSERT_AFTER/INSERT_BEFORE).
 *
 * @param response - Raw LLM response text
 * @returns Array of parsed standalone prompt results
 */
export function parseStandalonePromptSuggestions(
  response: string
): StandalonePromptResult[] {
  try {
    const cleanedResponse = normalizeDelimitedLlmResponse(response);

    const promptBlocks = cleanedResponse.split('---PROMPT---');
    const results: StandalonePromptResult[] = [];

    for (const block of promptBlocks) {
      if (!block.trim() || !block.includes('TEXT:')) {
        continue;
      }

      const blockContent = block.split('---END---')[0];
      const textMatch = blockContent.match(/^TEXT:[^\S\n]*(.+?)$/m);
      const reasoningMatch = blockContent.match(/^REASONING:[^\S\n]*(.+?)$/m);

      if (!textMatch) {
        logger.warn('Skipping standalone prompt block with missing TEXT field');
        continue;
      }

      const text = textMatch[1].trim();
      if (!text) {
        logger.warn('Skipping standalone prompt block with empty TEXT');
        continue;
      }

      results.push({
        text,
        reasoning: reasoningMatch ? reasoningMatch[1].trim() : undefined,
      });
    }

    logger.info(
      `Parsed ${results.length} standalone prompt results from LLM response`
    );
    return results;
  } catch (error) {
    logger.error('Failed to parse standalone LLM response:', error);
    return [];
  }
}

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
export async function generateStandalonePrompts(
  sceneDescription: string,
  promptCount: number,
  includeCharInfo: boolean,
  includeWorldInfo: boolean,
  context: SillyTavernContext,
  settings: AutoIllustratorSettings,
  metadata?: AutoIllustratorChatMetadata
): Promise<StandalonePromptResult[]> {
  logger.info('Generating standalone prompts');
  logger.debug(`Scene description length: ${sceneDescription.length}`);

  // Standalone generation is always an independent LLM call (not chat injection),
  // so always use the standalone template + independent LLM guidelines preset.
  // The shared API mode's meta prompt is designed for embedding <!--img-prompt-->
  // tags in chat responses — completely different output format, not usable here.
  let systemPrompt = standalonePromptTemplate;

  const countInstruction = `Generate exactly ${promptCount} image prompt(s) for the described scene. Each prompt should capture a different visual interpretation or angle of the scene.`;
  systemPrompt = systemPrompt.replace(
    '{{FREQUENCY_GUIDELINES}}',
    countInstruction
  );
  systemPrompt = systemPrompt.replace(
    '{{PROMPT_WRITING_GUIDELINES}}',
    settings.llmPromptWritingGuidelines || ''
  );

  // Build user prompt
  const sections: string[] = [];

  if (includeCharInfo) {
    // Standalone "include character info" controls whether character info is used at all.
    // The specific sub-sections (description / persona / scenario) still respect
    // the current context injection settings, so the standalone page can reuse
    // the same "上下文注入设置" panel as independent API mode.
    const charInfo = buildCharacterInfoSection(context, settings);
    if (charInfo) {
      sections.push(charInfo);
    }
  }

  if (includeWorldInfo) {
    // Override injectWorldInfo — standalone checkbox already controls this,
    // don't require the independent API mode's toggle to also be on
    const worldSettings = {...settings, injectWorldInfo: true};
    const worldInfo = await buildWorldInfoSection(worldSettings, metadata);
    if (worldInfo) {
      sections.push(worldInfo);
    }
  }

  sections.push(`=== SCENE DESCRIPTION ===\n${sceneDescription}`);
  const userPrompt = sections.join('');

  logger.debug('Standalone user prompt length:', userPrompt.length);
  logger.trace('Standalone user prompt:', userPrompt);

  // Call LLM — respect prompt generation mode setting:
  // Only use independent LLM when user is in independent API mode AND has it enabled.
  // Shared API mode → always use SillyTavern's generateRaw (main API).
  const useIndependentLlm =
    isIndependentApiMode(settings.promptGenerationMode) &&
    settings.useIndependentLlmApi;

  let llmResponse: string;
  try {
    if (useIndependentLlm) {
      logger.debug(
        'Using independent LLM API for standalone prompt generation'
      );
      llmResponse = await callIndependentLlmApi(
        systemPrompt,
        userPrompt,
        settings
      );
    } else {
      if (!context.generateRaw) {
        throw new AutoIllustratorError(
          'llm-unavailable',
          'LLM generation not available'
        );
      }
      logger.debug(
        'Using SillyTavern API (generateRaw) for standalone prompt generation'
      );
      llmResponse = await context.generateRaw({
        systemPrompt,
        prompt: userPrompt,
      });
    }

    logger.debug('Standalone LLM response received');
    logger.trace('Raw standalone LLM response:', llmResponse);
  } catch (error) {
    logger.error('Standalone LLM generation failed:', error);
    throw toAutoIllustratorError(
      error,
      'api-request-failed',
      'Standalone LLM generation failed'
    );
  }

  if (!normalizeDelimitedLlmResponse(llmResponse)) {
    throw new AutoIllustratorError(
      'llm-empty-response',
      'Standalone LLM returned empty response'
    );
  }

  // Parse — always use standalone parser (extracts TEXT + REASONING,
  // ignores INSERT_AFTER/INSERT_BEFORE that shared mode might produce)
  const results = parseStandalonePromptSuggestions(llmResponse);

  if (results.length === 0) {
    logger.warn('Standalone LLM returned no valid prompts');
    throw new AutoIllustratorError(
      'no-valid-prompts',
      'Standalone LLM returned no valid prompts'
    );
  }

  logger.info(`Generated ${results.length} standalone prompts`);
  return results;
}
