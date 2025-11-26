/**
 * Image Extractor Module
 * Handles extraction of image generation prompts from LLM responses
 */
import type { ImagePromptMatch } from './types';
/**
 * Checks if the text contains any image prompts
 * @param text - Text to check
 * @param patterns - Optional array of regex pattern strings to use for detection
 * @returns True if text contains image prompts
 */
export declare function hasImagePrompts(text: string, patterns?: string[]): boolean;
/**
 * Extracts all image generation prompts from text
 * @param text - Text containing image prompts
 * @param patterns - Optional array of regex pattern strings to use for detection
 * @returns Array of image prompt matches with positions
 */
export declare function extractImagePrompts(text: string, patterns?: string[]): ImagePromptMatch[];
