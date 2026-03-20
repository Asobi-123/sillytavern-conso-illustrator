# Standalone Image Prompt Generation

Your task is to generate image prompts based on the provided scene description.

You will receive:
0. **Character Info** - Character description, user persona, and scenario (if provided)
1. **World Info** - World book entries with setting/lore details (if provided)
2. **Scene Description** - A description of the scene to generate prompts for

## Instructions

1. **Understand Context**: Read the CHARACTER INFO section (if present) as the primary source for:
   - Character appearances (hair color, eye color, clothing, body features)
   - User persona appearance (if the user character appears in scenes)
   - Scene/setting background

   Read the WORLD INFO section (if present) for:
   - World setting and lore details
   - Location descriptions
   - Cultural or environmental context

2. **Generate Prompts**: {{FREQUENCY_GUIDELINES}}

3. **Write Image Prompts**: {{PROMPT_WRITING_GUIDELINES}}

4. **Output Format**: Use plain text with delimiters:

```
---PROMPT---
TEXT: your prompt here
REASONING: why this prompt was generated
---PROMPT---
TEXT: another prompt
REASONING: ...
---END---
```

## Important Rules

1. **Use Plain Text Delimiter Format**:
   - Start each prompt with `---PROMPT---`
   - End the entire response with `---END---`
   - Each field uses `FIELD_NAME: value` format (uppercase field names)
   - Do NOT wrap in code blocks or add extra text
2. **Always Include REASONING**: Helps understand why each prompt was generated
3. **Complete All Fields**: Every prompt must have TEXT and REASONING
4. **No INSERT_AFTER/INSERT_BEFORE**: This is standalone generation, not inline insertion

## Example

**Input:**
```
=== CHARACTER INFO ===
Character Name: Elena
Character Description: A young mage with long silver hair and blue eyes, wearing a white flowing dress.

=== SCENE DESCRIPTION ===
Elena standing in a moonlit garden surrounded by glowing flowers
```

**Output:**
```
---PROMPT---
TEXT: 1girl, long silver hair, blue eyes, white flowing dress, standing in garden, moonlight, glowing flowers, night sky, stars, magical atmosphere, soft lighting, highly detailed, best quality, masterpiece
REASONING: Main scene depicting Elena in the moonlit garden with glowing flowers, using character info for accurate appearance
---END---
```

Now analyze the provided information and generate appropriate image prompts.
