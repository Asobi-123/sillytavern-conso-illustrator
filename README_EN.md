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

Prerequisite: SillyTavern is running and the native `/sd` image generation command works.

Install from SillyTavern's extension installer:

```
https://github.com/Asobi-123/sillytavern-conso-illustrator
```

Or install manually:

```bash
cd SillyTavern/data/default-user/extensions/
git clone https://github.com/Asobi-123/sillytavern-conso-illustrator.git
```

Full setup walkthrough: [Beginner Tutorial (Chinese)](docs/QUICKSTART_CN.md).

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

The extension ships with an offline tag catalog. Runtime use does not fetch network resources. The current bundled catalog version is `2026-06` with 7928 tags.

Key points:

- Search, page, copy, add to common tags, and add custom tags under the same category taxonomy.
- Independent prompt generation sends only a small random sample from the current text's matched candidate pool, never the full catalog.
- Chinese bridge coverage is visible; user trigger supplements are stored locally and do not overwrite the built-in bridge.
- The latest candidate snapshot shows exactly which tags were sent to the AI.

Detailed usage: [Tag Catalog tutorial](docs/QUICKSTART_CN.md#tag-超市可选).

---

## Preset Adapter

Preset Adapter converts external JSON/text presets or free-form requirements into Conso-native drafts. It does not directly use external runtime formats and does not ship any external preset as built-in behavior.

Shared API and Independent API targets are generated separately, and drafts require manual review before saving. Detailed usage: [Preset Adapter tutorial](docs/QUICKSTART_CN.md#预设适配可选进阶).

---

## NovelAI Advanced Backend Features (Optional)

Some NovelAI advanced features require the companion server plugin: Vibe Transfer and Inpaint. Normal `/sd` generation works with only the frontend extension, but these advanced features need the backend folder.

Backend folder: `server-plugin/auto-illustrator-nai-advanced`. Install it, enable `enableServerPlugins`, and restart SillyTavern before using advanced features.

- **Vibe Transfer**: adds NovelAI reference-image conditioning for chat and standalone generation.
- **Inpaint**: paint a mask on an existing image, preview the edit, then append or replace.

Full installation and usage: [NovelAI advanced backend tutorial](docs/QUICKSTART_CN.md#novelai-高级后端功能可选进阶).

---

## How Does the Floating Panel Work?

The floating panel gathers high-frequency actions in one workbench. Low-frequency settings remain available in the old settings page as fallback.

| Page | Purpose |
|------|---------|
| **Main** | Enable/disable auto illustration, switch prompt generation mode, edit the current chat's image folder label, and switch themes |
| **Prompt Settings** | Configure shared API mode or independent API mode prompt generation behavior |
| **Gallery** | View generated images from the current chat inside the panel |
| **Standalone** | Test prompt generation and image output without sending chat messages |
| **Prompt Library** | Upload NovelAI PNGs → extract positive/negative/character prompts → search, edit, copy, organize |

Long text editors support fullscreen viewing/editing. The original image action dialog is unchanged and has not been merged into the floating panel.

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
