import {describe, expect, it} from 'vitest';
import {
  buildTagCatalogPromptGuidance,
  getLastTagCatalogCandidateSnapshot,
  normalizePromptTagsWithCatalog,
} from './tag_catalog_prompt';

describe('tag_catalog_prompt service', () => {
  it('builds a compact candidate vocabulary from target text', () => {
    const guidance = buildTagCatalogPromptGuidance('黑发少女在森林中哭泣。');

    expect(guidance).toContain('vocabulary candidates, not scene facts');
    expect(guidance).toContain('1girl');
    expect(guidance).toContain('black_hair');
    expect(guidance).toContain('crying');
    expect(guidance).toContain('forest');
  });

  it('uses the Chinese bridge for scene attributes without English tags', () => {
    const guidance = buildTagCatalogPromptGuidance('雨夜竹林里少女哭泣。');

    expect(guidance).toContain('Chinese text is matched');
    expect(guidance).toContain('1girl');
    expect(guidance).toContain('crying');
    expect(guidance).toContain('rain');
    expect(guidance).toContain('night');
    expect(guidance).toContain('bamboo_forest');

    const snapshot = getLastTagCatalogCandidateSnapshot();
    expect(snapshot?.total).toBeGreaterThan(0);
    expect(snapshot?.sourceText).toBe('雨夜竹林里少女哭泣。');
    expect(snapshot?.buckets.some(bucket => bucket.tags.includes('rain'))).toBe(
      true
    );
  });

  it('normalizes only tags already present in the prompt', () => {
    expect(
      normalizePromptTagsWithCatalog(
        '1girl, long hair, blue eyes, white dress, garden'
      )
    ).toBe('1girl, long_hair, blue_eyes, white_dress, garden');
  });

  it('preserves character groups and NAI pipe segments', () => {
    expect(
      normalizePromptTagsWithCatalog(
        '{alice, long hair}, 1girl, long hair | girl, blue eyes, source#hug'
      )
    ).toBe(
      '{alice, long hair}, 1girl, long_hair | girl, blue_eyes, source#hug'
    );
  });

  it('normalizes structured positive lines while preserving UC lines', () => {
    const result = normalizePromptTagsWithCatalog(
      [
        'Scene Composition: garden, long hair,;',
        'Character 1 Prompt: 1girl, long hair, blue eyes,;',
        'Character 1 UC: bad anatomy, lowres, long hair,;',
      ].join('\n')
    );

    expect(result).toBe(
      [
        'Scene Composition: garden, long_hair,;',
        'Character 1 Prompt: 1girl, long_hair, blue_eyes,;',
        'Character 1 UC: bad anatomy, lowres, long hair,;',
      ].join('\n')
    );
  });

  it('uses user catalog entries for candidate guidance and normalization', () => {
    const settings = {
      customTagCatalogEntries: [
        {
          tag: 'black_hanfu',
          label: 'black hanfu',
          category: 'clothing',
          postCount: 0,
          source: 'user' as const,
        },
      ],
      tagCatalogCandidateLimits: {
        subject: 0,
        hair: 0,
        eyes: 0,
        expression: 0,
        pose_action: 0,
        clothing: 2,
        scene: 0,
        camera: 0,
        lighting_style: 0,
        general: 0,
      },
    } as unknown as AutoIllustratorSettings;

    const guidance = buildTagCatalogPromptGuidance(
      'The character wears black hanfu.',
      settings
    );
    expect(guidance).toContain('clothing:');
    expect(guidance).toContain('black_hanfu');
    expect(guidance.indexOf('black_hanfu')).toBeGreaterThan(
      guidance.indexOf('clothing:')
    );
    expect(normalizePromptTagsWithCatalog('1girl, black hanfu', settings)).toBe(
      '1girl, black_hanfu'
    );
  });

  it('uses custom Chinese triggers for user catalog entries', () => {
    const settings = {
      customTagCatalogEntries: [
        {
          tag: 'black_hanfu',
          label: 'black hanfu',
          category: 'clothing',
          postCount: 0,
          source: 'user' as const,
          triggers: ['黑色汉服'],
        },
      ],
      tagCatalogCandidateLimits: {
        subject: 0,
        hair: 0,
        eyes: 0,
        expression: 0,
        pose_action: 0,
        clothing: 2,
        scene: 0,
        camera: 0,
        lighting_style: 0,
        general: 0,
      },
    } as unknown as AutoIllustratorSettings;

    const guidance = buildTagCatalogPromptGuidance(
      '角色穿着黑色汉服。',
      settings
    );
    expect(guidance).toContain('clothing:');
    expect(guidance).toContain('black_hanfu');
  });

  it('uses user trigger overrides for built-in catalog entries', () => {
    const settings = {
      customTagBridgeTriggers: {
        hair_ornament: ['发饰'],
      },
      tagCatalogCandidateLimits: {
        subject: 0,
        hair: 2,
        eyes: 0,
        expression: 0,
        pose_action: 0,
        clothing: 0,
        scene: 0,
        camera: 0,
        lighting_style: 0,
        general: 0,
      },
    } as unknown as AutoIllustratorSettings;

    const guidance = buildTagCatalogPromptGuidance('她戴着发饰。', settings);
    expect(guidance).toContain('hair:');
    expect(guidance).toContain('hair_ornament');
  });

  it('respects editable per-category candidate limits', () => {
    const settings = {
      tagCatalogCandidateLimits: {
        subject: 0,
        hair: 0,
        eyes: 0,
        expression: 0,
        pose_action: 0,
        clothing: 0,
        scene: 1,
        camera: 0,
        lighting_style: 0,
        general: 0,
      },
    } as unknown as AutoIllustratorSettings;

    const guidance = buildTagCatalogPromptGuidance(
      '黑发少女在森林中哭泣。',
      settings
    );

    expect(guidance).toContain('scene: forest');
    expect(guidance).not.toContain('black_hair');
    expect(guidance).not.toContain('crying');
    expect(guidance).not.toContain('1girl');
  });
});
