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
import type { CharacterFixedTagEntry } from '../types';
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
export declare function applyCharacterFixedTags(prompt: string, messageText: string, characterFixedTags: Record<string, CharacterFixedTagEntry>): string;
/**
 * Gets the current chat participants (main character + user persona).
 * Uses fresh context snapshot and characters array for reliable name lookup.
 * @returns Array of participant info with name and type
 */
export declare function getCurrentParticipants(): Array<{
    name: string;
    type: 'character' | 'persona';
}>;
