/**
 * Character Fixed Tags Service
 * Detects character names in message text and injects their fixed tags into prompts.
 *
 * Injection rules:
 * - Only inject when character name is found in messageText (story context)
 * - Only inject into prompts that contain person-indicator tags (1girl, 1boy, etc.)
 * - Each character's tags are wrapped in {} to prevent multi-character confusion
 *   e.g. {lu zhiwei, girl, orange long hair}, {shen geye, boy, yellow short hair}
 */

import {parseCommonTags} from '../image_generator';
import type {CharacterFixedTagEntry} from '../types';

/**
 * Person-indicator tags that signal a prompt depicts a character.
 * If a prompt contains none of these, character tags are not injected.
 */
const PERSON_INDICATORS = [
  '1girl',
  '2girls',
  '3girls',
  '4girls',
  '5girls',
  '6+girls',
  'multiple girls',
  '1boy',
  '2boys',
  '3boys',
  '4boys',
  '5boys',
  '6+boys',
  'multiple boys',
  'girl',
  'boy',
  'woman',
  'man',
  'female',
  'male',
  'person',
  'people',
  'character',
  'couple',
];

/**
 * Tags that explicitly indicate NO people in the scene.
 */
const NO_PERSON_INDICATORS = ['no humans', 'nobody', 'no people', 'scenery'];

/**
 * Checks if any of the character's names appear in the text (case-insensitive).
 */
function isCharacterInText(names: string[], text: string): boolean {
  const lowerText = text.toLowerCase();
  return names.some(name => lowerText.includes(name.toLowerCase()));
}

/**
 * Checks if a prompt contains person-indicator tags (meaning it depicts a character).
 * Returns false if the prompt explicitly excludes people or has no person indicators.
 */
function promptHasPerson(promptTags: string[]): boolean {
  const lowerTags = promptTags.map(t => t.toLowerCase().trim());

  // Check for explicit "no person" indicators first
  for (const noIndicator of NO_PERSON_INDICATORS) {
    if (lowerTags.some(tag => tag.includes(noIndicator))) {
      return false;
    }
  }

  // Check for person indicators
  return lowerTags.some(tag =>
    PERSON_INDICATORS.some(indicator => tag.includes(indicator))
  );
}

/**
 * Applies character fixed tags to a prompt based on which characters appear in the message.
 *
 * Each character's tags are wrapped in {} to prevent multi-character tag confusion.
 * Users should write tags like: romanized_name, gender, visual_tags...
 * Result: {lu zhiwei, girl, orange long hair}, {shen geye, boy, yellow short hair}, original prompt
 *
 * Only injects when:
 * 1. Character name is found in messageText (story mentions the character)
 * 2. The prompt itself contains person-indicator tags (it's a character scene, not scenery)
 *
 * @param prompt - Original image generation prompt
 * @param messageText - Message body text to detect character names in
 * @param characterFixedTags - Character fixed tag entries keyed by primary name
 * @returns Enhanced prompt with character tag groups prepended
 */
export function applyCharacterFixedTags(
  prompt: string,
  messageText: string,
  characterFixedTags: Record<string, CharacterFixedTagEntry>
): string {
  if (!messageText || Object.keys(characterFixedTags).length === 0) {
    return prompt;
  }

  const promptTags = parseCommonTags(prompt);

  // Skip injection entirely if prompt has no person indicators
  if (!promptHasPerson(promptTags)) {
    return prompt;
  }

  // Build per-character tag groups wrapped in {} to prevent multi-character confusion
  // Format: {name, gender, tag1, tag2}, {name2, gender2, tag3, tag4}, prompt tags...
  const characterGroups: string[] = [];

  for (const [primaryName, entry] of Object.entries(characterFixedTags)) {
    if (!entry.enabled) continue;
    if (!entry.tags || entry.tags.trim() === '') continue;

    const allNames = entry.names.length > 0 ? entry.names : [primaryName];

    if (!isCharacterInText(allNames, messageText)) continue;

    const tags = parseCommonTags(entry.tags);
    if (tags.length === 0) continue;

    // Wrap each character's tags in {} to isolate them
    characterGroups.push(`{${tags.join(', ')}}`);
  }

  if (characterGroups.length === 0) {
    return prompt;
  }

  // Character groups first, then original prompt (keep prompt tags as-is)
  return `${characterGroups.join(', ')}, ${prompt}`;
}

/**
 * Gets the current chat participants (main character + user persona).
 * Uses fresh context snapshot and characters array for reliable name lookup.
 * @returns Array of participant info with name and type
 */
export function getCurrentParticipants(): Array<{
  name: string;
  type: 'character' | 'persona';
}> {
  const participants: Array<{name: string; type: 'character' | 'persona'}> = [];

  try {
    // Always get fresh context (cached context may have stale scalar values)
    const context = SillyTavern.getContext();
    if (!context) return participants;

    // Main character: prefer characters array lookup (always current),
    // fall back to name2 (may be stale snapshot)
    const charName =
      context.characters?.[context.characterId]?.name || context.name2;
    if (charName) {
      participants.push({name: charName, type: 'character'});
    }

    // User persona
    if (context.name1) {
      participants.push({name: context.name1, type: 'persona'});
    }
  } catch {
    // No context available
  }

  return participants;
}
