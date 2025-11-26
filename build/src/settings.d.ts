/**
 * Settings Module
 * Handles loading, saving, and managing extension settings
 */
import { EXTENSION_NAME } from './constants';
export { EXTENSION_NAME };
/**
 * Gets the default settings for the extension
 * @returns Default settings
 */
export declare function getDefaultSettings(): AutoIllustratorSettings;
/**
 * Loads settings from SillyTavern context
 * @param context - SillyTavern context
 * @returns Loaded settings merged with defaults
 */
export declare function loadSettings(context: SillyTavernContext): AutoIllustratorSettings;
/**
 * Saves settings to SillyTavern context
 * @param settings - Settings to save
 * @param context - SillyTavern context
 */
export declare function saveSettings(settings: AutoIllustratorSettings, context: SillyTavernContext): void;
/**
 * Creates the settings UI HTML
 * @returns HTML string for settings panel
 */
export declare function createSettingsUI(): string;
