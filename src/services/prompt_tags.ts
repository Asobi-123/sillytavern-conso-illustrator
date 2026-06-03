/**
 * Parses a comma-separated string of tags into an array.
 */
export function parseCommonTags(tagsString: string): string[] {
  if (!tagsString || tagsString.trim() === '') {
    return [];
  }

  return tagsString
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
}

/**
 * Deduplicates tags in a case-insensitive manner.
 */
export function deduplicateTags(tags: string[]): string[] {
  const seen = new Map<string, string>();

  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();
    if (!seen.has(lowerTag)) {
      seen.set(lowerTag, tag);
    }
  }

  return Array.from(seen.values());
}

/**
 * Validates common tags input.
 */
export function validateCommonTags(tags: string): {
  valid: boolean;
  error?: string;
} {
  if (!tags || tags.trim() === '') {
    return {valid: true};
  }

  const invalidChars = /[<>{}[\]\\]/;
  if (invalidChars.test(tags)) {
    return {
      valid: false,
      error: 'Invalid characters detected. Avoid using < > { } [ ] \\',
    };
  }

  return {valid: true};
}

/**
 * Applies common style tags to a prompt based on position setting.
 */
export function applyCommonTags(
  prompt: string,
  commonTags: string,
  position: 'prefix' | 'suffix'
): string {
  if (!commonTags || commonTags.trim() === '') {
    return prompt;
  }

  const charGroupRegex = /\{[^}]+\}/g;
  const charGroups: string[] = [];
  let promptWithoutGroups = prompt.replace(charGroupRegex, match => {
    charGroups.push(match);
    return '';
  });
  promptWithoutGroups = promptWithoutGroups
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .replace(/,\s*,/g, ',');

  const promptTags = parseCommonTags(promptWithoutGroups);
  const styleTags = parseCommonTags(commonTags);
  const combined =
    position === 'prefix'
      ? [...styleTags, ...promptTags]
      : [...promptTags, ...styleTags];
  const flatPart = deduplicateTags(combined).join(', ');

  if (charGroups.length > 0) {
    return `${charGroups.join(', ')}, ${flatPart}`;
  }
  return flatPart;
}
