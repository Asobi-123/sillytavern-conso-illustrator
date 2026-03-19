/**
 * Independent LLM Guidelines Presets Module
 * Manages predefined and custom presets for independent LLM frequency + writing guidelines
 */

import {
  DEFAULT_LLM_FREQUENCY_GUIDELINES,
  DEFAULT_LLM_PROMPT_WRITING_GUIDELINES,
} from './constants';

/**
 * Predefined preset IDs
 */
export const INDEPENDENT_LLM_PRESET_IDS = {
  DEFAULT: 'default',
} as const;

/**
 * Predefined presets array
 */
const PREDEFINED_PRESETS: IndependentLlmGuidelinesPreset[] = [
  {
    id: INDEPENDENT_LLM_PRESET_IDS.DEFAULT,
    name: 'Default',
    frequencyGuidelines: DEFAULT_LLM_FREQUENCY_GUIDELINES,
    promptWritingGuidelines: DEFAULT_LLM_PROMPT_WRITING_GUIDELINES,
    predefined: true,
  },
];

/**
 * Gets all predefined presets
 */
export function getIndependentLlmPredefinedPresets(): IndependentLlmGuidelinesPreset[] {
  return PREDEFINED_PRESETS;
}

/**
 * Gets a predefined preset by ID
 */
export function getIndependentLlmPredefinedPresetById(
  id: string
): IndependentLlmGuidelinesPreset | undefined {
  return PREDEFINED_PRESETS.find(preset => preset.id === id);
}

/**
 * Gets a preset by ID, checking both custom and predefined presets
 * Falls back to default if not found
 */
export function getIndependentLlmPresetById(
  id: string,
  customPresets: IndependentLlmGuidelinesPreset[]
): IndependentLlmGuidelinesPreset {
  const customPreset = customPresets.find(preset => preset.id === id);
  if (customPreset) {
    return customPreset;
  }

  const predefinedPreset = getIndependentLlmPredefinedPresetById(id);
  if (predefinedPreset) {
    return predefinedPreset;
  }

  return PREDEFINED_PRESETS[0];
}

/**
 * Checks if a preset ID is predefined
 */
export function isIndependentLlmPresetPredefined(id: string): boolean {
  return PREDEFINED_PRESETS.some(preset => preset.id === id);
}

/**
 * Checks if a preset name belongs to a predefined preset (case-insensitive)
 */
export function isIndependentLlmPredefinedPresetName(name: string): boolean {
  const lowerName = name.toLowerCase();
  return PREDEFINED_PRESETS.some(
    preset => preset.name.toLowerCase() === lowerName
  );
}
