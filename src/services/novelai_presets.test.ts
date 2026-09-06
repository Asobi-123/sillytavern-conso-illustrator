import {describe, expect, it} from 'vitest';
import {
  composeNovelAiPrompts,
  getNovelAiModelFamily,
  getNovelAiPresetApiIds,
  listNovelAiUcPresets,
  resolveNovelAiPresets,
} from './novelai_presets';

describe('NovelAI preset registry', () => {
  it('classifies supported model families', () => {
    expect(getNovelAiModelFamily('nai-diffusion-5-full')).toBe('v5');
    expect(getNovelAiModelFamily('NAI Diffusion Anime V5 (Full)')).toBe('v5');
    expect(getNovelAiModelFamily('nai-diffusion-4-5-curated')).toBe('v4.5');
    expect(getNovelAiModelFamily('nai-diffusion-4-full')).toBe('v4');
    expect(getNovelAiModelFamily('other')).toBe('unknown');
  });

  it('appends quality and UC while preserving existing content', () => {
    const result = composeNovelAiPrompts(
      '1girl, red hair',
      'bad hands',
      'nai-diffusion-5-full',
      {qualityPresetId: 'standard', ucPresetId: 'heavy'}
    );

    expect(result.prompt).toBe(
      '1girl, red hair, very aesthetic, masterpiece, no text'
    );
    expect(result.negativePrompt).toContain('bad hands');
    expect(result.negativePrompt).toContain('film grain');
    expect(result.negativePrompt.startsWith('bad hands')).toBe(true);
  });

  it('leaves both values unchanged for None', () => {
    const result = composeNovelAiPrompts(
      '1girl',
      'bad anatomy',
      'nai-diffusion-4-5-full',
      {qualityPresetId: 'none', ucPresetId: 'none'}
    );
    expect(result.prompt).toBe('1girl');
    expect(result.negativePrompt).toBe('bad anatomy');
  });

  it('uses a visible safe fallback for unknown IDs', () => {
    const result = resolveNovelAiPresets('nai-diffusion-5-full', {
      qualityPresetId: 'invalid' as never,
      ucPresetId: 'invalid' as never,
    });
    expect(result.quality.id).toBe('none');
    expect(result.uc.id).toBe('none');
  });

  it('does not duplicate a preset when composition is applied twice', () => {
    const once = composeNovelAiPrompts('1girl', '', 'nai-diffusion-5-full', {
      qualityPresetId: 'standard',
      ucPresetId: 'light',
    });
    const twice = composeNovelAiPrompts(
      once.prompt,
      once.negativePrompt,
      'nai-diffusion-5-full',
      {qualityPresetId: 'standard', ucPresetId: 'light'}
    );
    expect(twice.prompt.match(/very aesthetic/g)).toHaveLength(1);
    expect(twice.negativePrompt.match(/lowres/g)).toHaveLength(1);
  });

  it('keeps the official UC API IDs available', () => {
    expect(
      getNovelAiPresetApiIds('nai-diffusion-5-full', {
        qualityPresetId: 'standard',
        ucPresetId: 'human-focus',
      })
    ).toEqual({qualityId: 1, ucId: 4});
    expect(listNovelAiUcPresets().map(preset => preset.id)).toEqual([
      'none',
      'light',
      'heavy',
      'furry-focus',
      'human-focus',
    ]);
  });
});
