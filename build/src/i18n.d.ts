/**
 * Internationalization Module
 * Provides translation helpers for the Auto Illustrator extension
 */
/**
 * Initialize the i18n module with SillyTavern context
 * @param context - SillyTavern context
 */
export declare function initializeI18n(context: SillyTavernContext): void;
/**
 * Translates a key to the current locale
 * @param key - Translation key
 * @param replacements - Optional object with replacement values for placeholders
 * @returns Translated string
 */
export declare function t(key: string, replacements?: Record<string, string | number>): string;
/**
 * Helper to format plural forms
 * For Chinese, plural forms are the same as singular, but we keep count in the string
 * @param count - Number to check
 * @param key - Translation key
 * @param replacements - Optional object with replacement values
 * @returns Translated string with count
 */
export declare function tCount(count: number, key: string, replacements?: Record<string, string | number>): string;
