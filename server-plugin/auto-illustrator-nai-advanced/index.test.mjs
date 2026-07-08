import assert from 'node:assert/strict';
import {describe, it} from 'vitest';

import {validateRequestBody} from './request_validation.mjs';

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
