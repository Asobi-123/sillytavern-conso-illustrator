/**
 * Tests for Character Fixed Tags Service
 */

import {describe, it, expect, vi} from 'vitest';
import {applyCharacterFixedTags} from './character_fixed_tags_service';
import type {CharacterFixedTagEntry} from '../types';

// Mock logger
vi.mock('../logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('applyCharacterFixedTags', () => {
  const makeEntry = (
    names: string[],
    tags: string,
    enabled = true
  ): CharacterFixedTagEntry => ({
    names,
    tags,
    enabled,
  });

  it('should inject tags wrapped in {} when character is in message', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia'], 'elysia, girl, silver hair, red eyes'),
    };
    const result = applyCharacterFixedTags(
      '1girl, garden, sunset',
      'Elysia walked into the garden.',
      tags
    );
    expect(result).toBe(
      '{elysia, girl, silver hair, red eyes}, 1girl, garden, sunset'
    );
  });

  it('should wrap each character separately in {} for multi-character scenes', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia'], 'elysia, girl, silver hair, red eyes'),
      Traveler: makeEntry(
        ['Traveler', '旅行者'],
        'traveler, boy, black hair, golden eyes'
      ),
    };
    const result = applyCharacterFixedTags(
      '1girl, 1boy, garden, sunset',
      'Elysia and 旅行者 met in the garden.',
      tags
    );
    expect(result).toBe(
      '{elysia, girl, silver hair, red eyes}, {traveler, boy, black hair, golden eyes}, 1girl, 1boy, garden, sunset'
    );
  });

  it('should match aliases case-insensitively', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia', 'エリシア'], 'elysia, girl, silver hair'),
    };
    const result = applyCharacterFixedTags(
      '1girl, garden',
      'elysia was there.',
      tags
    );
    expect(result).toBe('{elysia, girl, silver hair}, 1girl, garden');
  });

  it('should match Chinese alias', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Traveler: makeEntry(['Traveler', '旅行者'], 'traveler, boy, black hair'),
    };
    const result = applyCharacterFixedTags(
      '1boy, forest',
      '旅行者走进了森林。',
      tags
    );
    expect(result).toBe('{traveler, boy, black hair}, 1boy, forest');
  });

  it('should skip characters not present in message', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia'], 'elysia, girl, silver hair'),
      Bob: makeEntry(['Bob'], 'bob, boy, brown hair'),
    };
    const result = applyCharacterFixedTags(
      '1girl, garden',
      'Elysia walked alone.',
      tags
    );
    expect(result).toBe('{elysia, girl, silver hair}, 1girl, garden');
  });

  it('should skip disabled characters', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia'], 'elysia, girl, silver hair', false),
    };
    const result = applyCharacterFixedTags(
      '1girl, garden',
      'Elysia walked into the garden.',
      tags
    );
    expect(result).toBe('1girl, garden');
  });

  it('should skip characters with empty tags', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia'], ''),
    };
    const result = applyCharacterFixedTags(
      '1girl, garden',
      'Elysia walked into the garden.',
      tags
    );
    expect(result).toBe('1girl, garden');
  });

  it('should NOT inject when prompt has no person indicators', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia'], 'elysia, girl, silver hair, red eyes'),
    };
    const result = applyCharacterFixedTags(
      'garden, sunset, flowers, masterpiece',
      'Elysia walked into the garden.',
      tags
    );
    expect(result).toBe('garden, sunset, flowers, masterpiece');
  });

  it('should NOT inject when prompt contains "no humans"', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      陆知微: makeEntry(['陆知微'], 'lu zhiwei, girl, orange long hair'),
    };
    const result = applyCharacterFixedTags(
      'no humans, underground clinic, cyberpunk style, masterpiece',
      '陆知微离开了房间。',
      tags
    );
    expect(result).toBe(
      'no humans, underground clinic, cyberpunk style, masterpiece'
    );
  });

  it('should NOT inject when prompt contains "scenery"', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia'], 'elysia, girl, silver hair'),
    };
    const result = applyCharacterFixedTags(
      'scenery, mountain, lake, sunset',
      'Elysia gazed at the mountain.',
      tags
    );
    expect(result).toBe('scenery, mountain, lake, sunset');
  });

  it('should preserve original prompt as-is (no dedup between groups and prompt)', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia'], 'elysia, girl, silver hair, red eyes'),
    };
    const result = applyCharacterFixedTags(
      '1girl, silver hair, garden',
      'Elysia in the garden.',
      tags
    );
    // Original prompt kept intact, character tags in {} prepended
    expect(result).toBe(
      '{elysia, girl, silver hair, red eyes}, 1girl, silver hair, garden'
    );
  });

  it('should return original prompt when no characters match', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia'], 'elysia, girl, silver hair'),
    };
    const result = applyCharacterFixedTags(
      '1girl, garden, sunset',
      'A beautiful day.',
      tags
    );
    expect(result).toBe('1girl, garden, sunset');
  });

  it('should return original prompt when config is empty', () => {
    const result = applyCharacterFixedTags(
      '1girl, garden, sunset',
      'Some text.',
      {}
    );
    expect(result).toBe('1girl, garden, sunset');
  });

  it('should return original prompt when message is empty', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia'], 'elysia, girl, silver hair'),
    };
    const result = applyCharacterFixedTags('1girl, garden, sunset', '', tags);
    expect(result).toBe('1girl, garden, sunset');
  });

  it('should use primary name as fallback when names array is empty', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry([], 'elysia, girl, silver hair'),
    };
    const result = applyCharacterFixedTags(
      '1girl, garden',
      'Elysia appeared.',
      tags
    );
    expect(result).toBe('{elysia, girl, silver hair}, 1girl, garden');
  });

  it('should detect various person indicators', () => {
    const tags: Record<string, CharacterFixedTagEntry> = {
      Elysia: makeEntry(['Elysia'], 'elysia, girl, silver hair'),
    };

    // "woman" indicator
    expect(
      applyCharacterFixedTags('woman, garden', 'Elysia was there.', tags)
    ).toBe('{elysia, girl, silver hair}, woman, garden');

    // "boy" indicator
    expect(
      applyCharacterFixedTags('boy, school', 'Elysia was there.', tags)
    ).toBe('{elysia, girl, silver hair}, boy, school');

    // "multiple girls" indicator
    expect(
      applyCharacterFixedTags('multiple girls, park', 'Elysia was there.', tags)
    ).toBe('{elysia, girl, silver hair}, multiple girls, park');
  });
});
