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
| **Floating Workbench** | Main dashboard, prompt settings, gallery, and standalone generation in one high-frequency UI |
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
| **Character Fixed Tags** | Lock visual tags per character — auto-injected with `{}` isolation in multi-character scenes |
| **World Info Injection** | Plugin-independent world book selection per chat |
| **Common Style Tags** | Global prefix/suffix tags applied to all generated prompts |
| **Message Content Filter** | Strip HTML tags and CSS noise before sending to LLM |
| **Meta Prompt Presets** | Built-in presets (Default, NAI 4.5 Full) + custom preset management |

### Configuration & Management

| Feature | Description |
|---------|-------------|
| **Two Generation Modes** | Shared API (zero config) or Independent API (cleaner AI replies) |
| **Independent LLM API** | Use any OpenAI-compatible API with auto model discovery and connection test |
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

> Note: the original image action dialog ("What would you like to do with this image?") is still unchanged and has not been merged into the floating panel.

---

## Troubleshooting

| Problem | Quick Fix |
|---------|-----------|
| No images generated | Make sure `/sd` command works first — the plugin depends on SillyTavern's Image Generation extension |
| Images appear then disappear | Check browser console for errors; verify image storage path exists |
| Independent mode fails and you do not know where to look | The plugin now shows a failure toast with the likely reason. If it says the main reply was empty, first make sure your main API is switched back to Chat Completion. If it says API request failed or returned empty, check the independent LLM configuration |
| Wrong character appearance | Use **Character Fixed Tags** to lock visual tags per character |
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
| Standalone Workbench | - | - | Supported |
| Guidelines Presets | - | - | Supported |
| Collapsible Settings | - | - | Supported |
| Version Check | - | - | Supported |
| Bilingual UI (EN/CN) | - | - | Supported |

---

## Credits

This project stands on the shoulders of two excellent predecessors:

- **Original Author:** [gamer-mitsuha](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator) — SillyTavern Auto Illustrator
- **Fork Author:** [Hao19911125](https://github.com/Hao19911125/sillytavern-simplified-illustrator) — SillyTavern Simplified Illustrator

Thank you for your pioneering work that made this project possible!

## License

AGPL-3.0 — following the original project's license.
