# NovelAI Diffusion V5 Image Prompt Generation Guide

Generate image prompts for NovelAI Diffusion V5 Curated or Full. Insert prompts at natural narrative points, approximately every 250 words or at a major scene change.

## Output Format

Put each prompt on its own line in this exact wrapper:

```text
<!--img-prompt="prompt content"-->
```

Keep the complete wrapper on one line. Do not add commentary inside it.

## Prompt Strategy

NovelAI V5 understands both Danbooru-style tags and natural language. Use a hybrid structure:

1. Start with subject count and the central scene.
2. Use concise natural language when relationships, atmosphere, or action are hard to express as tags.
3. Add precise tags for identity, appearance, clothing, pose, framing, lighting, environment, and style.
4. End with the official standard quality suffix: `very aesthetic, masterpiece, no text`.

Prefer concrete visible details. Do not describe thoughts, backstory, sound, smell, or facts that cannot appear in one image.

## Prompt Order

Use this order unless the scene needs a different emphasis:

1. Subject count: `1girl`, `1boy`, `2girls`, `1boy, 1girl`, `no humans`
2. Main action or relationship
3. Character identity and stable appearance
4. Clothing and accessories
5. Expression and pose
6. Framing and camera angle
7. Location and background
8. Lighting, color, atmosphere, and medium
9. Quality suffix: `very aesthetic, masterpiece, no text`

Earlier concepts receive priority. Remove contradictions and repeated synonyms before adding more detail.

## Character Consistency

For a known character, use the canonical tag in `character_name (series_name)` form when known. Do not overwrite canonical hair, eye, or costume features unless the story explicitly changes them.

For an original character, repeat the same small set of identifying features in every scene:

- hair color, length, and style
- eye color
- distinctive body or facial feature
- current clothing
- one or two unique accessories

Do not invent features that conflict with the supplied character description or fixed character tags.

## Multiple Characters

For two or more important characters, use NovelAI's separated character-prompt structure:

```text
base scene | first character | second character
```

The base segment contains subject counts, shared action, environment, composition, lighting, and the quality suffix. Each character segment contains only details belonging to that character. Do not mix one character's appearance or clothing into another character's segment.

Keep spatial language relative and visually clear, such as `facing each other`, `standing beside her`, or `in the foreground`. Do not invent coordinate or positioning controls.

## Composition

Choose a framing that shows the important action:

- portrait or emotion: `portrait`, `close-up`, `upper body`
- conversation or interaction: `cowboy shot`, `medium shot`, `two-shot`
- clothing or body action: `full body`, `wide shot`
- dramatic scale: `low angle`, `high angle`, `from behind`

State hand placement, body direction, and gaze when they matter. Avoid impossible combinations such as `close-up` with a detailed full-body pose.

## Style And Quality

Use concrete style tags only when the story or user asks for them, for example:

- `anime screencap`, `game cg`, `watercolor (medium)`, `oil painting (medium)`
- `soft lighting`, `rim lighting`, `dramatic shadows`, `golden hour`
- `limited palette`, `pastel colors`, `high contrast`, `monochrome`

Every prompt must end with:

```text
very aesthetic, masterpiece, no text
```

Do not automatically append older V4.5 suffixes such as `best quality, highres, no watermark`.

## Examples

Single character:

```text
<!--img-prompt="1girl, reading beside an open window while rain streaks the glass, long black hair, green eyes, cream cardigan, thoughtful expression, upper body, quiet apartment, cool evening light, detailed anime illustration, very aesthetic, masterpiece, no text"-->
```

Two characters:

```text
<!--img-prompt="1boy, 1girl, meeting beneath a station clock after a long separation, facing each other, medium shot, evening train station, warm backlight, restrained emotional atmosphere, very aesthetic, masterpiece, no text | girl, long auburn hair, blue eyes, dark wool coat, holding a small suitcase, relieved smile | boy, short black hair, brown eyes, gray jacket, one hand raised in greeting, surprised expression"-->
```

Landscape:

```text
<!--img-prompt="no humans, ancient observatory above a sea of clouds, enormous brass telescope, open dome, distant mountain peaks, predawn blue light, stars fading at the horizon, cinematic wide shot, detailed fantasy illustration, very aesthetic, masterpiece, no text"-->
```

## Final Check

Before emitting each prompt, confirm that it:

- depicts the current story moment rather than a generic portrait
- contains the correct subject count
- keeps character features separated and consistent
- has one coherent framing, location, and lighting setup
- contains no contradictory tags
- ends with `very aesthetic, masterpiece, no text`

Provide the complete story content with image prompts inserted at natural narrative moments. Each `<!--img-prompt="..."-->` tag must be on its own line, with the entire tag on a single line.
