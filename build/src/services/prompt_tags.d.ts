/**
 * Parses a comma-separated string of tags into an array.
 */
export declare function parseCommonTags(tagsString: string): string[];
/**
 * Deduplicates tags in a case-insensitive manner.
 */
export declare function deduplicateTags(tags: string[]): string[];
/**
 * Validates common tags input.
 */
export declare function validateCommonTags(tags: string): {
    valid: boolean;
    error?: string;
};
/**
 * Applies common style tags to a prompt based on position setting.
 */
export declare function applyCommonTags(prompt: string, commonTags: string, position: 'prefix' | 'suffix'): string;
