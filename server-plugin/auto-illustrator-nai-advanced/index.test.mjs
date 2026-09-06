import assert from 'node:assert/strict';
import {describe, it} from 'vitest';

import {validateRequestBody} from './request_validation.mjs';
import {
  buildNovelAiInpaintRequestBody,
  buildNovelAiRequestBody,
  calculateSkipCfgAboveSigma,
  resolveInpaintingModel,
} from './novelai_request.mjs';

function createValidBody(overrides = {}) {
  return {
    prompt: '1girl',
    reference_image_multiple: ['QUJDRA=='],
    reference_encoded_vibe_multiple: [null],
    reference_source_hash_multiple: [''],
    reference_information_extracted_multiple: [1],
    reference_strength_multiple: [0.6],
    ...overrides,
  };
}

describe('auto-illustrator advanced backend validation', () => {
  it('rejects V5 Vibe requests', () => {
    const error = validateRequestBody(
      createValidBody({model: 'nai-diffusion-5-full'})
    );

    assert.equal(error, 'NovelAI V5 does not support Vibe Transfer');
  });

  it('accepts migrated source-hash-only Vibe references', () => {
    const error = validateRequestBody(
      createValidBody({
        reference_image_multiple: [''],
        reference_encoded_vibe_multiple: [null],
        reference_source_hash_multiple: [
          'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        ],
      })
    );

    assert.equal(error, null);
  });

  it('accepts frontend-resolved quality and UC preset metadata', () => {
    const error = validateRequestBody(
      createValidBody({
        quality_preset_id: 'standard',
        uc_preset_id: 'heavy',
      })
    );
    assert.equal(error, null);
  });

  it('rejects unknown preset metadata instead of guessing a model preset', () => {
    assert.equal(
      validateRequestBody(createValidBody({quality_preset_id: 'unknown'})),
      'quality_preset_id is invalid'
    );
    assert.equal(
      validateRequestBody(createValidBody({uc_preset_id: 'unknown'})),
      'uc_preset_id is invalid'
    );
  });

  it('rejects reference source hash arrays with mismatched length', () => {
    const error = validateRequestBody(
      createValidBody({
        reference_source_hash_multiple: [],
      })
    );

    assert.equal(error, 'reference parameter arrays must have the same length');
  });

  it('still rejects requests with no image, source hash, or encoded vibe', () => {
    const error = validateRequestBody(
      createValidBody({
        reference_image_multiple: [''],
        reference_encoded_vibe_multiple: [null],
        reference_source_hash_multiple: [''],
      })
    );

    assert.equal(
      error,
      'at least one reference image, source hash, or encoded vibe is required'
    );
  });
});

describe('auto-illustrator NovelAI V5 request mapping', () => {
  it('preserves frontend-composed prompt and negative prompt text', () => {
    const body = buildNovelAiRequestBody(
      {
        prompt: '1girl, very aesthetic, masterpiece, no text',
        negative_prompt: 'bad hands, lowres',
        model: 'nai-diffusion-5-full',
        quality_preset_id: 'standard',
        uc_preset_id: 'heavy',
      },
      []
    );
    assert.equal(body.input, '1girl, very aesthetic, masterpiece, no text');
    assert.equal(body.parameters.negative_prompt, 'bad hands, lowres');
    assert.equal(body.parameters.ucPreset, 0);
    assert.equal(body.parameters.qualityToggle, false);
  });

  it('uses parameter schema 4 and the V5 CFG-delay baseline', () => {
    const body = buildNovelAiRequestBody(
      {
        prompt: '1girl',
        model: 'nai-diffusion-5-full',
        width: 832,
        height: 1216,
        variety_boost: true,
      },
      []
    );

    assert.equal(body.parameters.params_version, 4);
    assert.equal(
      body.parameters.skip_cfg_above_sigma,
      calculateSkipCfgAboveSigma(832, 1216, 'nai-diffusion-5-full')
    );
    assert.equal(body.parameters.skip_cfg_above_sigma, 58);
  });

  it('keeps V4.5 on parameter schema 3 with the same CFG-delay baseline', () => {
    const body = buildNovelAiRequestBody(
      {
        prompt: '1girl',
        model: 'nai-diffusion-4-5-full',
        width: 832,
        height: 1216,
        variety_boost: true,
      },
      []
    );

    assert.equal(body.parameters.params_version, 3);
    assert.equal(body.parameters.skip_cfg_above_sigma, 58);
  });

  it('maps V5 inpainting models to the launch-supported endpoints', () => {
    assert.equal(
      resolveInpaintingModel('nai-diffusion-5-curated'),
      'nai-diffusion-4-5-curated-inpainting'
    );
    assert.equal(
      resolveInpaintingModel('nai-diffusion-5-full'),
      'nai-diffusion-5-full-inpainting'
    );
    assert.equal(
      buildNovelAiInpaintRequestBody({
        prompt: '1girl',
        model: 'nai-diffusion-5-full',
      }).parameters.params_version,
      4
    );
  });

  it('preserves existing V4 and V4.5 inpainting mappings', () => {
    assert.equal(
      resolveInpaintingModel('nai-diffusion-4-5-curated'),
      'nai-diffusion-4-5-curated-inpainting'
    );
    assert.equal(
      resolveInpaintingModel('nai-diffusion-4-curated-preview'),
      'nai-diffusion-4-curated-inpainting'
    );
  });
});
