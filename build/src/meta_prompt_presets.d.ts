/**
 * Meta Prompt Presets Module
 * Manages predefined and custom meta prompt presets
 */
/**
 * Meta prompt preset interface
 */
export interface MetaPromptPreset {
    id: string;
    name: string;
    template: string;
    predefined: boolean;
}
/**
 * Predefined preset IDs
 */
export declare const PRESET_IDS: {
    readonly DEFAULT: "default";
    readonly NAI_45_FULL: "nai-4.5-full";
};
/**
 * Gets all predefined presets
 * @returns Array of predefined presets
 */
export declare function getPredefinedPresets(): MetaPromptPreset[];
/**
 * Gets a predefined preset by ID
 * @param id - Preset ID
 * @returns Predefined preset or undefined if not found
 */
export declare function getPredefinedPresetById(id: string): MetaPromptPreset | undefined;
/**
 * Gets a preset by ID, checking both custom and predefined presets
 * @param id - Preset ID
 * @param customPresets - Array of custom presets
 * @returns Preset object, or default preset if not found
 */
export declare function getPresetById(id: string, customPresets: MetaPromptPreset[]): MetaPromptPreset;
/**
 * Checks if a preset ID is predefined
 * @param id - Preset ID to check
 * @returns True if preset is predefined
 */
export declare function isPresetPredefined(id: string): boolean;
/**
 * Checks if a preset name belongs to a predefined preset (case-insensitive)
 * @param name - Preset name to check
 * @returns True if name is a predefined preset name
 */
export declare function isPredefinedPresetName(name: string): boolean;
/**
 * Gets the default meta prompt template (for backwards compatibility)
 * @returns The default meta prompt string
 */
export declare function getDefaultMetaPrompt(): string;
