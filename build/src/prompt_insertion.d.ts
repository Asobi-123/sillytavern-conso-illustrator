/**
 * Prompt Insertion Module
 * Inserts image prompt tags into message text using context-based matching
 */
/**
 * Suggested prompt with context for insertion
 */
export interface PromptSuggestion {
    /** The image generation prompt text */
    text: string;
    /** Text snippet before insertion point (10-40 chars) */
    insertAfter: string;
    /** Text snippet after insertion point (10-40 chars) */
    insertBefore: string;
    /** Optional reasoning for why this prompt was suggested */
    reasoning?: string;
}
/**
 * Result of prompt insertion operation
 */
export interface InsertionResult {
    /** Updated message text with prompt tags inserted */
    updatedText: string;
    /** Number of prompts successfully inserted */
    insertedCount: number;
    /** Suggestions that failed to insert (context not found) */
    failedSuggestions: PromptSuggestion[];
}
/**
 * Inserts image prompt tags into message text using context-based matching
 *
 * For each suggestion, finds the unique match of insertAfter + insertBefore
 * and inserts the prompt tag between them. If multiple matches exist, uses
 * the first occurrence. If no match exists, skips that suggestion.
 *
 * @param messageText - Original message text
 * @param suggestions - Array of prompt suggestions with context
 * @param tagTemplate - Prompt tag template (e.g., "<!--img-prompt=\"{PROMPT}\"-->")
 * @returns Insertion result with updated text and statistics
 *
 * @example
 * const result = insertPromptTagsWithContext(
 *   "She walked through the forest under the moonlight.",
 *   [
 *     {
 *       text: "1girl, forest, moonlight",
 *       insertAfter: "through the forest",
 *       insertBefore: "under the moonlight"
 *     }
 *   ],
 *   "<!--img-prompt=\"{PROMPT}\"-->"
 * );
 * // result.updatedText: "She walked through the forest <!--img-prompt="1girl, forest, moonlight"--> under the moonlight."
 * // result.insertedCount: 1
 */
export declare function insertPromptTagsWithContext(messageText: string, suggestions: PromptSuggestion[], tagTemplate: string): InsertionResult;
/**
 * Validates a prompt suggestion has all required fields
 * @param suggestion - Suggestion to validate
 * @returns True if valid, false otherwise
 */
export declare function isValidSuggestion(suggestion: Partial<PromptSuggestion>): suggestion is PromptSuggestion;
