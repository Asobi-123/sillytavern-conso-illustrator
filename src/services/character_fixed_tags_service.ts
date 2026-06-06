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

import {parseCommonTags} from './prompt_tags';
import type {
  CharacterFixedTagEntry,
  CharacterFixedTagInjectionMode,
} from '../types';

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
  'multiple_girls',
  'multiple girls',
  '1boy',
  '2boys',
  '3boys',
  '4boys',
  '5boys',
  '6+boys',
  'multiple_boys',
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
const NO_PERSON_INDICATORS = [
  'no humans',
  'no_humans',
  'nobody',
  'no people',
  'no_people',
  'scenery',
];

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

function groupForEntry(entry: CharacterFixedTagEntry): string | null {
  const tags = parseCommonTags(entry.tags);
  return tags.length > 0 ? `{${tags.join(', ')}}` : null;
}

function groupAlreadyPresent(prompt: string, group: string): boolean {
  return prompt.toLowerCase().includes(group.toLowerCase());
}

function promptLooksMultiCharacter(promptTags: string[]): boolean {
  const lowerTags = promptTags.map(tag => tag.toLowerCase().trim());
  const hasGirl = lowerTags.some(tag => tag.includes('1girl'));
  const hasBoy = lowerTags.some(tag => tag.includes('1boy'));
  return (
    (hasGirl && hasBoy) ||
    lowerTags.some(tag =>
      [
        '2girls',
        '3girls',
        '4girls',
        '5girls',
        '6+girls',
        'multiple_girls',
        'multiple girls',
        '2boys',
        '3boys',
        '4boys',
        '5boys',
        '6+boys',
        'multiple_boys',
        'multiple boys',
        'couple',
      ].some(indicator => tag.includes(indicator))
    )
  );
}

function applyLegacyCharacterFixedTags(
  prompt: string,
  messageText: string,
  characterFixedTags: Record<string, CharacterFixedTagEntry>
): string {
  const promptTags = parseCommonTags(prompt);

  if (!promptHasPerson(promptTags)) {
    return prompt;
  }

  const characterGroups: string[] = [];

  for (const [primaryName, entry] of Object.entries(characterFixedTags)) {
    if (!entry.enabled) continue;
    if (!entry.tags || entry.tags.trim() === '') continue;

    const allNames = entry.names.length > 0 ? entry.names : [primaryName];

    if (!isCharacterInText(allNames, messageText)) continue;

    const group = groupForEntry(entry);
    if (!group || groupAlreadyPresent(prompt, group)) continue;

    characterGroups.push(group);
  }

  if (characterGroups.length === 0) {
    return prompt;
  }

  return `${characterGroups.join(', ')}, ${prompt}`;
}

function applyPipeAwareCharacterFixedTags(
  prompt: string,
  messageText: string,
  characterFixedTags: Record<string, CharacterFixedTagEntry>,
  mode: CharacterFixedTagInjectionMode
): string | null {
  if (!prompt.includes('|')) return null;

  const segments = prompt.split('|').map(segment => segment.trim());
  if (segments.length < 2) return null;

  let changed = false;
  const nextSegments = segments.map(segment => {
    let nextSegment = segment;
    for (const [primaryName, entry] of Object.entries(characterFixedTags)) {
      if (!entry.enabled || !entry.tags?.trim()) continue;
      const allNames = entry.names.length > 0 ? entry.names : [primaryName];
      if (!isCharacterInText(allNames, messageText)) continue;
      if (!isCharacterInText(allNames, segment)) continue;

      const group = groupForEntry(entry);
      if (!group || groupAlreadyPresent(nextSegment, group)) continue;
      nextSegment = `${group}, ${nextSegment}`;
      changed = true;
    }
    return nextSegment;
  });

  if (changed) {
    return nextSegments.join(' | ');
  }

  return mode === 'structure-aware'
    ? applyLegacyCharacterFixedTags(prompt, messageText, characterFixedTags)
    : prompt;
}

function applySectionAwareCharacterFixedTags(
  prompt: string,
  messageText: string,
  characterFixedTags: Record<string, CharacterFixedTagEntry>,
  mode: CharacterFixedTagInjectionMode
): string | null {
  if (!/Character\s+\d+\s+Prompt:/i.test(prompt)) return null;

  const lines = prompt.split('\n');
  let changed = false;

  const nextLines = lines.map(line => {
    if (!/Character\s+\d+\s+Prompt:/i.test(line)) return line;
    let nextLine = line;

    for (const [primaryName, entry] of Object.entries(characterFixedTags)) {
      if (!entry.enabled || !entry.tags?.trim()) continue;
      const allNames = entry.names.length > 0 ? entry.names : [primaryName];
      if (!isCharacterInText(allNames, messageText)) continue;
      if (!isCharacterInText(allNames, line)) continue;

      const group = groupForEntry(entry);
      if (!group || groupAlreadyPresent(nextLine, group)) continue;
      nextLine = nextLine.replace(/Prompt:\s*/i, match => `${match}${group}, `);
      changed = true;
    }

    return nextLine;
  });

  if (changed) {
    return nextLines.join('\n');
  }

  return mode === 'structure-aware'
    ? applyLegacyCharacterFixedTags(prompt, messageText, characterFixedTags)
    : prompt;
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
  characterFixedTags: Record<string, CharacterFixedTagEntry>,
  mode: CharacterFixedTagInjectionMode = 'legacy'
): string {
  if (!messageText || Object.keys(characterFixedTags).length === 0) {
    return prompt;
  }

  const promptTags = parseCommonTags(prompt);

  if (!promptHasPerson(promptTags)) {
    return prompt;
  }

  if (mode !== 'legacy') {
    const sectionAware = applySectionAwareCharacterFixedTags(
      prompt,
      messageText,
      characterFixedTags,
      mode
    );
    if (sectionAware !== null) return sectionAware;

    const pipeAware = applyPipeAwareCharacterFixedTags(
      prompt,
      messageText,
      characterFixedTags,
      mode
    );
    if (pipeAware !== null) return pipeAware;

    if (
      mode === 'skip-unmatched-multichar' &&
      promptLooksMultiCharacter(promptTags)
    ) {
      return prompt;
    }
  }

  return applyLegacyCharacterFixedTags(prompt, messageText, characterFixedTags);
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
