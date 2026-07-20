import {VIBE_TRANSFER} from '../constants';
import type {
  VibeLibraryGenerationSettings,
  VibeTransferCombination,
  VibeTransferPreset,
} from '../types';
import {clamp01} from './novelai_common';

function normalizeGroupNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function createVibeGenerationSettingsSnapshot(
  item: {
    generation?: VibeLibraryGenerationSettings;
    importInfo?: {strength?: number; information_extracted?: number};
  },
  overrides: {strength?: number; informationExtracted?: number} = {}
): VibeLibraryGenerationSettings {
  return {
    inheritGlobalStrength: false,
    strength: clamp01(
      overrides.strength ??
        item.generation?.strength ??
        item.importInfo?.strength,
      VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH
    ),
    inheritGlobalInformationExtracted: false,
    information_extracted: clamp01(
      overrides.informationExtracted ??
        item.generation?.information_extracted ??
        item.importInfo?.information_extracted,
      VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED
    ),
  };
}

export function createUniqueVibeGroupNames(
  baseName: string,
  groupCount: number,
  existingNames: Iterable<string>,
  maxLength: number,
  fallbackName: string
): string[] {
  if (groupCount <= 0) return [];

  const reservedNames = new Set(
    Array.from(existingNames, normalizeGroupNameKey)
  );
  const normalizedBaseName =
    baseName.trim().slice(0, maxLength) ||
    fallbackName.trim().slice(0, maxLength);

  for (let attempt = 1; attempt <= reservedNames.size + 1; attempt += 1) {
    const attemptSuffix = attempt === 1 ? '' : ` (${attempt})`;
    const candidateBase = `${normalizedBaseName
      .slice(0, maxLength - attemptSuffix.length)
      .trim()}${attemptSuffix}`;
    const groupNames = Array.from({length: groupCount}, (_, index) => {
      const groupSuffix = groupCount === 1 ? '' : ` ${index + 1}/${groupCount}`;
      return `${candidateBase
        .slice(0, maxLength - groupSuffix.length)
        .trim()}${groupSuffix}`;
    });
    if (
      groupNames.every(name => !reservedNames.has(normalizeGroupNameKey(name)))
    ) {
      return groupNames;
    }
  }

  return [];
}

export type RenameVibeGroupResult =
  | {ok: false; reason: 'missing' | 'empty' | 'tooLong' | 'duplicate'}
  | {
      ok: true;
      name: string;
      presets: VibeTransferPreset[];
      combinations: VibeTransferCombination[];
    };

export function renameVibeGroup(
  presets: VibeTransferPreset[],
  combinations: VibeTransferCombination[],
  presetId: string,
  requestedName: string,
  maxLength: number,
  now = Date.now()
): RenameVibeGroupResult {
  const selectedPreset = presets.find(preset => preset.id === presetId);
  if (!selectedPreset) return {ok: false, reason: 'missing'};

  const name = requestedName.trim();
  if (!name) return {ok: false, reason: 'empty'};
  if (name.length > maxLength) return {ok: false, reason: 'tooLong'};
  if (
    presets.some(
      preset =>
        preset.id !== presetId &&
        normalizeGroupNameKey(preset.name) === normalizeGroupNameKey(name)
    )
  ) {
    return {ok: false, reason: 'duplicate'};
  }

  return {
    ok: true,
    name,
    presets: presets.map(preset =>
      preset.id === presetId ? {...preset, name, updatedAt: now} : preset
    ),
    combinations: combinations.map(combination =>
      combination.id === presetId
        ? {...combination, name, updatedAt: now}
        : combination
    ),
  };
}
