import {describe, expect, it} from 'vitest';
import {
  applyCommonTags,
  deduplicateTags,
  parseCommonTags,
  validateCommonTags,
} from './prompt_tags';

describe('prompt_tags service', () => {
  it('parses comma-separated tags and ignores empty segments', () => {
    expect(parseCommonTags('  best quality, , 1girl, garden  ,')).toEqual([
      'best quality',
      '1girl',
      'garden',
    ]);
  });

  it('deduplicates tags case-insensitively while preserving first spelling', () => {
    expect(
      deduplicateTags(['Best Quality', '1girl', 'best quality', '1GIRL'])
    ).toEqual(['Best Quality', '1girl']);
  });

  it('preserves character fixed tag groups when applying common tags', () => {
    const prompt =
      '{alice, long hair, blue eyes}, {bob, short hair}, garden, sunset';

    const result = applyCommonTags(prompt, 'best quality, garden', 'prefix');

    expect(result).toBe(
      '{alice, long hair, blue eyes}, {bob, short hair}, best quality, garden, sunset'
    );
  });

  it('can append common tags without duplicating existing prompt tags', () => {
    const result = applyCommonTags(
      'garden, sunset',
      'best quality, garden',
      'suffix'
    );

    expect(result).toBe('garden, sunset, best quality');
  });

  it('allows empty common tags and rejects characters that would break grouping', () => {
    expect(validateCommonTags('').valid).toBe(true);
    expect(validateCommonTags('best quality, garden').valid).toBe(true);
    expect(validateCommonTags('{alice}, garden')).toEqual({
      valid: false,
      error: 'Invalid characters detected. Avoid using < > { } [ ] \\',
    });
  });
});
