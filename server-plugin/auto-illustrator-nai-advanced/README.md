# Auto Illustrator NovelAI Advanced Server Plugin

This companion server plugin adds the advanced NovelAI routes used by Conso Illustrator's Vibe Transfer and Inpaint features.

## Routes

- `GET /api/plugins/auto-illustrator-nai-advanced/status`
- `POST /api/plugins/auto-illustrator-nai-advanced/generate-image`
- `POST /api/plugins/auto-illustrator-nai-advanced/generate-inpaint-image`

Auto Illustrator uses the image generation route only when NovelAI Vibe Transfer is enabled and reference images are configured.
The inpaint route is used only from the image editing flow and requires a base image plus a mask image.

## Install

1. Copy this folder: `server-plugin/auto-illustrator-nai-advanced`.
2. Paste it into `<SillyTavern root>/plugins/auto-illustrator-nai-advanced`.
3. If an older folder with the same name already exists, replace it with the new one.
4. Make sure SillyTavern already has a NovelAI API token configured.
5. Set `enableServerPlugins: true` in `<SillyTavern root>/config.yaml`.
6. Restart SillyTavern. Reloading the page alone will not load a new server plugin.

The route reuses the NovelAI API key already stored in SillyTavern secrets. Auto Illustrator does not need a separate NovelAI token field.
