import type { VibeLibraryGenerationSettings, VibeTransferCombination, VibeTransferPreset } from '../types';
export declare function createVibeGenerationSettingsSnapshot(item: {
    generation?: VibeLibraryGenerationSettings;
    importInfo?: {
        strength?: number;
        information_extracted?: number;
    };
}, overrides?: {
    strength?: number;
    informationExtracted?: number;
}): VibeLibraryGenerationSettings;
export declare function createUniqueVibeGroupNames(baseName: string, groupCount: number, existingNames: Iterable<string>, maxLength: number, fallbackName: string): string[];
export type RenameVibeGroupResult = {
    ok: false;
    reason: 'missing' | 'empty' | 'tooLong' | 'duplicate';
} | {
    ok: true;
    name: string;
    presets: VibeTransferPreset[];
    combinations: VibeTransferCombination[];
};
export declare function renameVibeGroup(presets: VibeTransferPreset[], combinations: VibeTransferCombination[], presetId: string, requestedName: string, maxLength: number, now?: number): RenameVibeGroupResult;
