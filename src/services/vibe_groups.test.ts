import {describe, expect, it} from 'vitest';
import type {VibeTransferCombination, VibeTransferPreset} from '../types';
import {
  createUniqueVibeGroupNames,
  createVibeGenerationSettingsSnapshot,
  renameVibeGroup,
} from './vibe_groups';

function createPreset(
  id: string,
  name: string,
  referenceIds = ['item-1']
): VibeTransferPreset {
  return {id, name, referenceIds, createdAt: 1, updatedAt: 1};
}

function createCombination(
  id: string,
  name: string,
  itemIds = ['item-1']
): VibeTransferCombination {
  return {id, name, itemIds, createdAt: 1, updatedAt: 1};
}

describe('vibe group helpers', () => {
  it('preserves imported group precision while clamping invalid ranges', () => {
    expect(
      createVibeGenerationSettingsSnapshot(
        {importInfo: {strength: 0.6, information_extracted: 1}},
        {strength: 0.46}
      )
    ).toEqual({
      inheritGlobalStrength: false,
      strength: 0.46,
      inheritGlobalInformationExtracted: false,
      information_extracted: 1,
    });
    expect(
      createVibeGenerationSettingsSnapshot(
        {importInfo: {strength: 2, information_extracted: -1}},
        {strength: -0.25, informationExtracted: 1.25}
      )
    ).toMatchObject({strength: 0, information_extracted: 1});
  });

  it('creates numbered unique names for split and repeated imports', () => {
    expect(createUniqueVibeGroupNames('Oil', 3, [], 80, 'Imported')).toEqual([
      'Oil 1/3',
      'Oil 2/3',
      'Oil 3/3',
    ]);
    expect(
      createUniqueVibeGroupNames(
        'Oil',
        3,
        ['oil 1/3', 'Oil 2/3', 'Oil 3/3'],
        80,
        'Imported'
      )
    ).toEqual(['Oil (2) 1/3', 'Oil (2) 2/3', 'Oil (2) 3/3']);
  });

  it('keeps generated group names within the configured length', () => {
    const names = createUniqueVibeGroupNames(
      'A'.repeat(100),
      16,
      [],
      80,
      'Imported'
    );

    expect(names).toHaveLength(16);
    expect(names.every(name => name.length <= 80)).toBe(true);
  });

  it('renames matching preset and combination without changing ids or items', () => {
    const result = renameVibeGroup(
      [createPreset('preset-1', 'Old')],
      [createCombination('preset-1', 'Old')],
      'preset-1',
      ' New Name ',
      80,
      5
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presets[0]).toEqual({
      ...createPreset('preset-1', 'Old'),
      name: 'New Name',
      updatedAt: 5,
    });
    expect(result.combinations[0]).toEqual({
      ...createCombination('preset-1', 'Old'),
      name: 'New Name',
      updatedAt: 5,
    });
  });

  it('rejects missing, empty, overlong, and duplicate names', () => {
    const presets = [createPreset('one', 'One'), createPreset('two', 'Two')];
    const combinations = [createCombination('one', 'One')];

    expect(
      renameVibeGroup(presets, combinations, 'missing', 'Name', 80)
    ).toEqual({ok: false, reason: 'missing'});
    expect(renameVibeGroup(presets, combinations, 'one', ' ', 80)).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(
      renameVibeGroup(presets, combinations, 'one', 'A'.repeat(81), 80)
    ).toEqual({ok: false, reason: 'tooLong'});
    expect(renameVibeGroup(presets, combinations, 'one', ' two ', 80)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });
});
