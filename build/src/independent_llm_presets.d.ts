/**
 * Independent LLM Guidelines Presets Module
 * Manages predefined and custom presets for independent LLM frequency + writing guidelines
 */
/**
 * Predefined preset IDs
 */
export declare const INDEPENDENT_LLM_PRESET_IDS: {
    readonly DEFAULT: "default";
};
/**
 * Gets all predefined presets
 */
export declare function getIndependentLlmPredefinedPresets(): IndependentLlmGuidelinesPreset[];
/**
 * Gets a predefined preset by ID
 */
export declare function getIndependentLlmPredefinedPresetById(id: string): IndependentLlmGuidelinesPreset | undefined;
/**
 * Gets a preset by ID, checking both custom and predefined presets
 * Falls back to default if not found
 */
export declare function getIndependentLlmPresetById(id: string, customPresets: IndependentLlmGuidelinesPreset[]): IndependentLlmGuidelinesPreset;
/**
 * Checks if a preset ID is predefined
 */
export declare function isIndependentLlmPresetPredefined(id: string): boolean;
/**
 * Checks if a preset name belongs to a predefined preset (case-insensitive)
 */
export declare function isIndependentLlmPredefinedPresetName(name: string): boolean;
