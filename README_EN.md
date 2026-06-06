# SillyTavern Auto Illustrator - Conso Edition

[中文](README.md)

A SillyTavern extension that **automatically generates images while you chat**. The LLM reads your conversation, extracts visual descriptions, converts them into image generation prompts, and produces illustrations — all in real-time as the story unfolds.

**Fork from:** [Hao19911125/sillytavern-simplified-illustrator](https://github.com/Hao19911125/sillytavern-simplified-illustrator), originally based on [gamer-mitsuha/sillytavern-auto-illustrator](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator)

---

## How It Works

```
You send a message
       ↓
LLM generates a reply (streamed)
       ↓
Plugin detects visual scenes in the reply
       ↓
LLM converts scenes into image prompts (e.g. NovelAI tags)
       ↓
Image generation API creates the picture
       ↓
Image appears inline in the chat
```

---

## Quick Start

### Prerequisites

- SillyTavern installed and running
- Image generation configured and working (e.g. NovelAI — test with `/sd` command first)

### Install

**Option A** — From SillyTavern UI (recommended):

1. Go to **Extensions** → **Install Extension**
2. Enter: `https://github.com/Asobi-123/sillytavern-conso-illustrator`
3. Reload the page

**Option B** — Manual:

```bash
cd SillyTavern/data/default-user/extensions/
git clone https://github.com/Asobi-123/sillytavern-conso-illustrator.git
```

### Start Generating

1. Open **Extensions** → expand **Auto Illustrator** → check **Enable**
2. Pick a Meta Prompt Preset (recommended: **NAI 4.5 Full** for NovelAI users)
3. If you keep the floating panel enabled, a small launcher icon will appear on the right side; click it to open the workbench
4. Send a chat message — images will appear automatically!

---

## Features

### Core

| Feature | Description |
|---------|-------------|
| **Auto Illustration** | Detects visual scenes during streaming and generates images in real-time |
| **Floating Workbench** | Main dashboard, prompt settings, gallery, standalone generation, and prompt library in one high-frequency UI |
| **Dual Prompt Editing** | AI-assisted optimization or manual direct editing — switch freely |
| **Standalone Workbench** | Generate images without chat context — describe a scene or paste prompts directly |
| **Streaming Preview** | Live preview widget showing streamed text and generated images |
| **Image Viewer** | Full modal viewer with zoom, pan, rotate, navigate, and download |
| **Gallery Widget** | Floating gallery of all generated images, grouped by message |
| **Prompt Library** | Upload NovelAI PNGs to extract prompts and parameters — search, edit, copy, and organize |

### Prompt Enhancement

| Feature | Description |
|---------|-------------|
| **Character Card Injection** | Auto-sends character appearance, personality, and persona to the LLM |
| **Character Fixed Tags** | Lock visual tags per character, with legacy prepend mode and optional structure-aware character-section insertion |
| **World Info Injection** | Plugin-independent world book selection per chat |
| **Common Style Tags** | Global prefix/suffix tags applied to all generated prompts |
| **Tag Catalog** | Bundled offline catalog for searching, paging, copying, adding common tags, custom tags, and Chinese triggers |
| **AI Candidate Tags** | Independent prompt generation sends only a small text-matched candidate subset; limits are editable and the latest candidate snapshot is inspectable |
| **Preset Adapter** | Upload JSON/text or write requirements to draft Conso-native Shared API meta prompts or Independent API guidelines |
| **Random SD Style** | Randomly pick one Style from the stable-diffusion extension before each generation, apply its prefix/negative, then restore. Optional whitelist limits the eligible pool |
| **NovelAI Vibe Transfer** | Optional reference-image conditioning for chat and standalone generation. V4/V4.5 encoded vibes are cached to reduce repeated Anlas usage |
| **NovelAI Inpaint** | Paint a mask on an existing image, preview the edit, then append or replace the original; supports canvas zoom, edge feather, mask padding, and edge guard |
| **Message Content Filter** | Strip HTML tags and CSS noise before sending to LLM |
| **Meta Prompt Presets** | Built-in presets (Default, NAI 4.5 Full) + custom preset management |

### Configuration & Management

| Feature | Description |
|---------|-------------|
| **Two Generation Modes** | Shared API (zero config) or Independent API (cleaner AI replies) |
| **Independent LLM API** | Use any OpenAI-compatible API with auto model discovery and connection test |
| **Manual Chat Retry** | If independent prompt generation fails in chat, the affected message can manually retry once |
| **API Profile Management** | Save/switch/delete named API configurations |
| **Guidelines Presets** | Manage frequency and prompt writing guidelines for independent API mode |
| **Per-Chat Image Folders** | Organize images by chat with subfolder labels |
| **Panel Themes** | Switch the floating panel between 17 dark and light themes |
| **Fullscreen Text Editing** | Fullscreen editing/preview for meta prompts, guideline text, and standalone prompts |
| **Image Cleanup** | Auto-delete old images after configurable retention days |
| **Collapsible Settings** | Three-level accordion panel, organized by function group |
| **Launcher Toggle** | Hide the floating launcher icon and reopen the panel from the settings page |
| **Version Check** | Auto-check for updates from GitHub Releases |
| **Bilingual UI** | Full English and Chinese interface |

---

## Two Modes: Which One Should I Use?

| | Shared API (Default) | Independent API |
|---|---|---|
| **How it works** | Plugin embeds instructions in the main chat → LLM includes prompts in its reply | Plugin makes a separate API call after the reply |
| **Setup** | Zero config — just enable the plugin | Need to configure a separate LLM API endpoint |
| **Impact on main API** | Image generation instructions consume attention and tokens | No impact on main API at all |
| **AI replies** | May occasionally contain prompt artifacts | Clean, unaffected by image generation |
| **API cost** | No extra calls | +1 API call per message |
| **Best for** | Getting started quickly | Users who don't want image gen interfering with main API |
| **Which preset** | Meta Prompt Preset | Guidelines Preset |

> **Recommendation:** Start with Shared API mode. Switch to Independent API if you don't want image generation consuming your main API's attention and tokens.

---

## Tag Catalog and AI Candidate Tags

Tag Catalog is an offline catalog bundled with the extension package. Runtime use does not fetch network resources, and users do not need to collect a base tag set manually. The current bundled catalog version is `2026-06` with 7928 tags across subject, hair, eyes, expression, pose/action, clothing, scene, camera, lighting/style, UC, and general categories.

It has two roles:

- **Manual browsing**: search, filter, page through tags, copy selected tags, or add selected tags to common style tags. Selected tags are only a temporary basket and are not automatically sent to the AI.
- **AI candidates**: Independent API prompt generation and standalone prompt generation build a matched candidate pool from the current text, randomly sample a small per-category subset, and send that subset to the LLM as vocabulary reference. The full catalog is never sent to the AI, and candidates are not forced into the final image prompt.

Chinese story text is matched through a bundled Chinese trigger bridge. The current bridge covers 3078 candidate tags; tags without Chinese triggers are visible through the “No zh triggers” filter. Users can add supplemental triggers per tag. Those local triggers do not overwrite the built-in bridge.

Users can also add custom tags under the same category taxonomy. Duplicate tags are skipped automatically, and custom tags can be filtered and deleted later.

Candidate counts are visible and editable in the Tag Catalog panel. The latest candidate snapshot shows the source text and the exact candidate tags sent to the AI.

---

## Preset Adapter

Preset Adapter converts external JSON/text presets or free-form requirements into Conso-native preset drafts. It does not directly use external runtime formats and does not ship any external preset as built-in behavior.

Usage:

1. Open **Preset Adapter** from the floating panel's **Prompt Settings** page.
2. Choose a JSON/text file, paste preset text, or write requirements.
3. Select the target: Shared API meta prompt, Independent API guidelines, or both.
4. Generate a draft, review it, then save it as a custom preset.

Shared API and Independent API targets are generated separately. Shared API drafts keep Conso's HTML comment output format and generation frequency rules; Independent API drafts focus on prompt-writing guidelines only.

---

## NovelAI Advanced Backend Features (Optional)

Some NovelAI advanced features require the companion server plugin: Vibe Transfer and Inpaint. Normal `/sd` generation works with only the frontend extension, but these advanced features need the backend folder.

### Install the companion server plugin

1. Copy this repository's `server-plugin/auto-illustrator-nai-advanced` folder.
2. Paste it into `<SillyTavern root>/plugins/auto-illustrator-nai-advanced`. If an older folder with the same name already exists, replace it with the new one.
3. Make sure SillyTavern already has a NovelAI API token configured.
4. Set `enableServerPlugins: true` in `<SillyTavern root>/config.yaml`.
5. Restart SillyTavern. Reloading the page alone will not load a new server plugin.
6. Reload the page, then use Vibe Transfer or Inpaint.

The panel also includes an **Install help** button with the same instructions.

### NovelAI Vibe Transfer

Vibe Transfer adds reference-image conditioning on top of the existing prompt flow. Positive prompts, negative prompts, common style tags, character fixed tags, SD Styles, and randomized SD Styles still apply; Vibe only adds reference conditioning to the same NovelAI generation request.

### Usage and cache behavior

- Works in both chat image generation and standalone generation.
- For V4/V4.5, the cache is matched by current SD/NAI model, Information Extracted value, and reference-image fingerprint. If a matching encoded vibe exists, it is reused; otherwise the plugin calls `encode-vibe`.
- Changing the model, Information Extracted value, or reference image creates a new cache entry.
- V3 does not use the encode-vibe cache and still sends the original reference image payload.
- Uploaded reference images are stored as compressed Vibe source images: longest side 768px, converted to JPEG. Large original PNG files are not stored in extension settings.
- Each reference can be named, tagged with chips, and searched by name or tag. Enabled references are sorted to the top.
- Presets save which references are enabled, not a specific encoded cache. After applying a preset, generation still resolves the matching cache from the current model and Information Extracted value.

### NovelAI Inpaint

Inpaint edits a selected region of an existing image. It starts from an existing generated image action, not from the normal automatic text-to-image queue.

Workflow:

1. Choose **NovelAI Inpaint** from an existing generated image action.
2. Paint or erase the mask, using canvas zoom when needed.
3. Edit the prompt, negative prompt, strength, mask padding, edge feather, edge guard, and source-tone preservation.
4. Generate an edit and preview it in the editor.
5. Insert the result only when satisfied, either appended after the source image or explicitly replacing it.

---

## How Does the Floating Panel Work?

Starting from `1.6.0`, the plugin includes a floating workbench that pulls high-frequency actions out of the old drawer.

### Five Pages

| Page | Purpose |
|------|---------|
| **Main** | Enable/disable auto illustration, switch prompt generation mode, edit the current chat's image folder label, and switch themes |
| **Prompt Settings** | Configure shared API mode or independent API mode prompt generation behavior |
| **Gallery** | View generated images from the current chat inside the panel |
| **Standalone** | Test prompt generation and image output without sending chat messages |
| **Prompt Library** | Upload NovelAI PNGs → extract positive/negative/character prompts → search, edit, copy, organize |

### When does it appear?

- By default, the floating panel starts **closed**
- A small launcher icon appears on the right side
- You can drag the launcher to a different position

### Can I hide the launcher?

Yes. Use the old settings page and turn off **Show Floating Panel Launcher**.

After that:
- the launcher icon disappears
- you can still reopen the panel from the settings page using **Open Floating Panel**

### Which long text fields support fullscreen editing?

The following areas support fullscreen editing/preview:

- Meta prompt preview/editing
- Independent API guideline text
- Standalone prompt text
- Preset Adapter source text, requirements, and generated drafts

> Note: the original image action dialog ("What would you like to do with this image?") is still unchanged and has not been merged into the floating panel.

---

## Troubleshooting

| Problem | Quick Fix |
|---------|-----------|
| No images generated | Make sure `/sd` command works first — the plugin depends on SillyTavern's Image Generation extension |
| Vibe Transfer does not affect output | Make sure `auto-illustrator-nai-advanced` is installed into SillyTavern's `plugins/` directory, `enableServerPlugins: true` is set in `config.yaml`, and SillyTavern has been restarted |
| Inpaint is unavailable | Install or update the companion server plugin, enable `enableServerPlugins: true`, and restart SillyTavern |
| Images appear then disappear | Check browser console for errors; verify image storage path exists |
| Independent mode fails and you do not know where to look | The plugin now shows a failure toast with the likely reason. If the affected chat message still has no prompt tags, it also shows a **Retry Prompt Generation** button on that message. If it says the main reply was empty, first make sure your main API is switched back to Chat Completion. If it says API request failed or returned empty, check the independent LLM configuration |
| Wrong character appearance | Use **Character Fixed Tags** to lock visual tags per character |
| Chinese text does not match the wanted catalog tag | Open **Tag Catalog**, inspect gaps with the “No zh triggers” filter, and add local triggers for the tag when needed |
| You want to know which candidate tags were sent | Open **Tag Catalog → Last AI candidates** to inspect the source text and exact candidate tags |
| External preset format is hard to convert | Use **Preset Adapter** to upload JSON/text or write requirements, then review the generated draft before saving |
| Prompts are inaccurate | Try **Independent API mode** with **NAI 4.5 Full** preset |
| Too many console logs | Adjust **Log Level** in settings (default: INFO) |

For detailed troubleshooting, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

## Links

- **Beginner Tutorial (Chinese)** — [docs/QUICKSTART_CN.md](docs/QUICKSTART_CN.md)
- **Troubleshooting** — [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **Changelog** — [CHANGELOG.md](CHANGELOG.md)

---

## Version Comparison

| Feature | Original (auto-illustrator) | Simplified | Conso Edition |
|---------|---------------------------|------------|---------------|
| Prompt Update | AI-assisted only | Manual direct editing only | **Dual mode: AI + Manual** |
| Progress Indicator | Bottom-right floating widget | Top toast notification | Top toast notification |
| Toggle Switch | Requires page reload | Instant effect | Instant effect |
| Config Isolation | - | Independent config ID | Independent config ID |
| Independent LLM API | - | - | Supported |
| Character Card Injection | - | - | Supported |
| Message Content Filtering | - | - | Supported |
| World Info Injection | - | - | Supported |
| API Profile Management | - | - | Supported |
| Character Fixed Tags | - | - | Supported |
| Tag Catalog / AI Candidate Tags | - | - | Supported |
| Preset Adapter | - | - | Supported |
| Random SD Style | - | - | Supported |
| NovelAI Vibe Transfer | - | - | Supported (requires companion server plugin) |
| NovelAI Inpaint | - | - | Supported (requires companion server plugin) |
| Standalone Workbench | - | - | Supported |
| Guidelines Presets | - | - | Supported |
| Collapsible Settings | - | - | Supported |
| Version Check | - | - | Supported |
| Bilingual UI (EN/CN) | - | - | Supported |

---

## Credits

This project stands on the shoulders of three excellent predecessors and public fix references:

- **Original Author:** [gamer-mitsuha](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator) — SillyTavern Auto Illustrator
- **Fork Author:** [Hao19911125](https://github.com/Hao19911125/sillytavern-simplified-illustrator) — SillyTavern Simplified Illustrator
- **Fix reference:** [Lluviose/sillytavern-auto-illustrator-beta](https://github.com/Lluviose/sillytavern-auto-illustrator-beta) — some of the `1.7.3` stability and compatibility fixes were adapted from the public fix ideas in that repository and then adjusted for the Conso edition architecture

Thank you to all three for the pioneering work and public sharing that made this project possible!

## License

AGPL-3.0 — following the original project's license.
