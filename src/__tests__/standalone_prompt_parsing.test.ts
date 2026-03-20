/**
 * Tests for parseStandalonePromptSuggestions
 */
import {describe, it, expect} from 'vitest';
import {parseStandalonePromptSuggestions} from '../services/prompt_generation_service';

describe('parseStandalonePromptSuggestions', () => {
  it('should parse a single prompt with TEXT and REASONING', () => {
    const response = `---PROMPT---
TEXT: 1girl, long silver hair, blue eyes, standing in garden
REASONING: Main character in garden scene
---END---`;

    const results = parseStandalonePromptSuggestions(response);
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe(
      '1girl, long silver hair, blue eyes, standing in garden'
    );
    expect(results[0].reasoning).toBe('Main character in garden scene');
  });

  it('should parse multiple prompts', () => {
    const response = `---PROMPT---
TEXT: 1girl, forest, moonlight
REASONING: First scene
---PROMPT---
TEXT: no humans, mountain lake, sunset
REASONING: Second scene
---END---`;

    const results = parseStandalonePromptSuggestions(response);
    expect(results).toHaveLength(2);
    expect(results[0].text).toBe('1girl, forest, moonlight');
    expect(results[1].text).toBe('no humans, mountain lake, sunset');
  });

  it('should handle missing REASONING gracefully', () => {
    const response = `---PROMPT---
TEXT: 1girl, standing, best quality
---END---`;

    const results = parseStandalonePromptSuggestions(response);
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('1girl, standing, best quality');
    expect(results[0].reasoning).toBeUndefined();
  });

  it('should skip blocks without TEXT field', () => {
    const response = `---PROMPT---
REASONING: No text here
---PROMPT---
TEXT: valid prompt here
REASONING: Has text
---END---`;

    const results = parseStandalonePromptSuggestions(response);
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('valid prompt here');
  });

  it('should skip blocks with empty TEXT', () => {
    const response = `---PROMPT---
TEXT:
REASONING: Empty text
---PROMPT---
TEXT: valid prompt
REASONING: Valid
---END---`;

    const results = parseStandalonePromptSuggestions(response);
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('valid prompt');
  });

  it('should handle response wrapped in code blocks', () => {
    const response =
      '```\n---PROMPT---\nTEXT: prompt inside code block\nREASONING: test\n---END---\n```';

    const results = parseStandalonePromptSuggestions(response);
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('prompt inside code block');
  });

  it('should return empty array for unparseable response', () => {
    const response = 'This is just random text with no prompts.';

    const results = parseStandalonePromptSuggestions(response);
    expect(results).toHaveLength(0);
  });

  it('should return empty array for empty response', () => {
    const results = parseStandalonePromptSuggestions('');
    expect(results).toHaveLength(0);
  });

  it('should ignore INSERT_AFTER and INSERT_BEFORE if present', () => {
    const response = `---PROMPT---
TEXT: 1girl, standing in garden
INSERT_AFTER: some text
INSERT_BEFORE: other text
REASONING: Should only extract TEXT and REASONING
---END---`;

    const results = parseStandalonePromptSuggestions(response);
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('1girl, standing in garden');
    expect(results[0].reasoning).toBe('Should only extract TEXT and REASONING');
    // Should not have insertAfter/insertBefore properties
    expect((results[0] as any).insertAfter).toBeUndefined();
    expect((results[0] as any).insertBefore).toBeUndefined();
  });
});
