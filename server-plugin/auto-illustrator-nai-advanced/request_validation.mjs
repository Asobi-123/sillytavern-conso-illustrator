export function validateRequestBody(body) {
  const references = body.reference_image_multiple;
  const encodedVibes = body.reference_encoded_vibe_multiple;
  const sourceHashes = body.reference_source_hash_multiple;
  const information = body.reference_information_extracted_multiple;
  const strengths = body.reference_strength_multiple;

  if (typeof body.prompt !== 'string' || body.prompt.trim() === '') {
    return 'prompt is required';
  }

  if (!Array.isArray(references) || references.length === 0) {
    return 'reference arrays must contain at least one reference';
  }

  if (encodedVibes !== undefined && !Array.isArray(encodedVibes)) {
    return 'reference_encoded_vibe_multiple must be an array when provided';
  }

  if (sourceHashes !== undefined && !Array.isArray(sourceHashes)) {
    return 'reference_source_hash_multiple must be an array when provided';
  }

  if (!Array.isArray(information) || !Array.isArray(strengths)) {
    return 'reference parameter arrays are required';
  }

  if (
    references.length !== information.length ||
    references.length !== strengths.length ||
    (Array.isArray(encodedVibes) && references.length !== encodedVibes.length) ||
    (Array.isArray(sourceHashes) && references.length !== sourceHashes.length)
  ) {
    return 'reference parameter arrays must have the same length';
  }

  const hasUsableReference = references.some((value, index) => {
    const hasImage = typeof value === 'string' && value.trim().length > 0;
    const sourceHash = Array.isArray(sourceHashes) ? sourceHashes[index] : null;
    const hasSourceHash =
      typeof sourceHash === 'string' && sourceHash.trim().length > 0;
    const encoded = Array.isArray(encodedVibes) ? encodedVibes[index] : null;
    const hasEncoded = typeof encoded === 'string' && encoded.trim().length > 0;
    return hasImage || hasSourceHash || hasEncoded;
  });

  if (!hasUsableReference) {
    return 'at least one reference image, source hash, or encoded vibe is required';
  }

  return null;
}
