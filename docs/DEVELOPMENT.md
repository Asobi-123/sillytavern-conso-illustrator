## Development

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Asobi-123/sillytavern-conso-illustrator.git
   cd sillytavern-conso-illustrator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development Workflow

1. **Write Code**: Edit source files in `src/` directory

2. **Run Tests**: Test-driven development approach
   ```bash
   npm test              # Run all tests
   npm run test:watch    # Watch mode for TDD
   ```

3. **Lint Code**: Follow Google TypeScript Style Guide
   ```bash
   npm run lint          # Check for issues
   npm run fix           # Auto-fix formatting
   ```

4. **Build**: Compile TypeScript and bundle with Webpack
   ```bash
   npm run build         # Production build
   ```

5. **Catalog Maintenance**: Update bundled tag data only during development/release prep
   ```bash
   npm run catalog:update # Fetch public tag data and rebuild src/data/tag_catalog.json
   npm run catalog:bridge # Rebuild the offline Chinese trigger bridge/report
   ```

6. **Test in SillyTavern**: Clone repo into the active SillyTavern extension directory for live testing

### Release Version Checklist

The runtime version is part of the shipped behavior. Before merging or preparing a release, keep these surfaces aligned:

- `src/constants.ts` - `EXTENSION_VERSION`, used by the in-panel update checker
- `package.json` and `package-lock.json` - package version metadata
- `manifest.json` - SillyTavern extension version metadata
- `dist/index.js` and `build/` - regenerated outputs from `npm run build`
- `CHANGELOG.md` - the matching release entry and user-visible changes
- `README.md`, `README_EN.md`, and relevant files under `docs/` - user-facing setup, behavior, and release documentation for the same version

Run `npm test` after the version change. `src/release_metadata.test.ts` fails when the runtime, package, manifest, or built bundle version diverges. Do not edit `dist/` or `build/` by hand; regenerate them with `npm run build`.

### NovelAI Model Compatibility

- `src/services/novelai_models.ts` is the frontend registry for NovelAI model IDs, capabilities, inpainting mappings, and recommended parameters that SillyTavern does not expose yet.
- Compatibility options are inserted only for the NovelAI source. A native SillyTavern option with the same model ID always wins, so the layer retires itself without relabeling or duplicating native entries.
- Ordinary image generation must continue through SillyTavern's `/sd` slash command. The compatibility layer exists to satisfy the native model selector and must not fork upload, gallery, queue, style, or storage behavior.
- Before generation, `normalizeNovelAiGenerationSettings` keeps NovelAI upscale values within the accepted set: Off (`1`), `2`, or `4`. It synchronizes the native SD input and persisted setting, but does not rewrite dimensions, steps, CFG, sampler, scheduler, or the selected model.
- V5 does not support Vibe Transfer at launch. Reject it before encoding or generation requests. V5 Full inpainting maps to its native V5 inpainting model; V5 Curated maps to V4.5 Curated inpainting until NovelAI provides a V5 Curated endpoint.

### NovelAI Quality Tags and UC Presets

- `src/services/novelai_presets.ts` is the single registry for built-in Quality Tags and Undesired Content (UC) preset text, IDs, labels, model-family metadata, and append-only composition.
- `src/constants.ts` stores the persisted global selection IDs. Settings normalization must reject unknown IDs and fall back to the documented defaults.
- `src/index.ts` renders the main-panel selectors and refreshes their effective status after `sd_model` or `sd_source` changes. Keep the main entry mounted once below the managed Regex section.
- `src/standalone_generation_ui.ts` provides the shortcut selectors. They follow the global selections by default; disabling follow-global creates a one-off override and restores the global values after generation.
- Preset composition belongs in the existing NovelAI `/sd` path. Quality text appends to positive prompts and UC text appends to negative prompts; `None` appends nothing. The feature does not require the companion server plugin.
- When changing preset data or behavior, update related unit tests, README/quickstart guidance, PRD requirements, and `CHANGELOG.md` together.

### Companion Backend Version Contract

- `src/constants.ts` and `server-plugin/auto-illustrator-nai-advanced/index.mjs` must carry the same backend fingerprint whenever the companion plugin protocol or NovelAI request behavior changes.
- The information panel compares the backend `/status` response with `SERVER_PLUGIN.VERSION`. A mismatch must remain visible and actionable, including installed and required fingerprints and the need to restart SillyTavern after replacing the plugin folder.
- A backend mismatch affects Vibe Transfer, inpainting, and other companion routes. It must not imply that ordinary NovelAI `/sd` generation requires the companion backend.
- Backend changes require syntax checks and the server-plugin Vitest suite in addition to the frontend release gates.

### Project Structure

```
sillytavern-conso-illustrator/
├── src/
│   ├── index.ts                    # Entry point, initialization, event handlers
│   ├── constants.ts                # Centralized configuration constants & validation ranges
│   ├── types.ts                    # Shared TypeScript type definitions
│   ├── regex.ts                    # Centralized regex patterns for img_prompt tags
│   ├── logger.ts                   # Structured logging with loglevel (configurable verbosity)
│   ├── message_handler.ts          # MESSAGE_RECEIVED event handler
│   ├── image_extractor.ts          # Regex-based prompt extraction from text
│   ├── image_generator.ts          # SD command integration, image insertion
│   ├── chat_history_pruner.ts      # Removes generated images from LLM context
│   ├── settings.ts                 # Settings management & UI generation
│   ├── st_regex_sanitizer.ts       # Managed SillyTavern Regex prompt filters
│   ├── meta_prompt_presets.ts      # Meta-prompt preset management system
│   ├── independent_llm_presets.ts  # Independent API guideline preset management
│   ├── floating_panel_ui.ts        # Floating workbench, overlays, and section mounting
│   ├── tag_catalog_ui.ts           # Built-in/custom Tag Catalog browser
│   ├── preset_import_ui.ts         # JSON/text preset adapter UI
│   ├── character_tags_ui.ts        # Character Fixed Tags editor
│   ├── prompt_library_ui.ts        # NovelAI PNG metadata prompt library UI
│   ├── standalone_generation_ui.ts # Standalone prompt/image workbench
│   ├── inpainting_editor.ts        # NovelAI inpaint editor UI
│   ├── streaming_monitor.ts        # Monitors streaming text for new prompts
│   ├── streaming_image_queue.ts    # Queue management for detected prompts
│   ├── queue_processor.ts          # Async image generation processor
│   ├── services/
│   │   ├── tag_catalog_prompt.ts   # Candidate tag selection and prompt tag normalization
│   │   ├── prompt_tags.ts          # Tag parsing/deduplication helpers
│   │   ├── character_fixed_tags_service.ts
│   │   ├── independent_llm.ts
│   │   ├── inpainting.ts
│   │   ├── vibe_transfer.ts
│   │   ├── vibe_source_client.ts   # Frontend client for backend Vibe source-image storage
│   │   ├── vibe_source_migration.ts # Moves legacy inline Vibe sources to backend hashes
│   │   ├── vibe_cache_events.ts    # UI refresh event after encoded Vibe cache writes
│   │   └── ...
│   ├── data/
│   │   ├── tag_catalog.json        # Bundled offline catalog
│   │   ├── zh_tag_bridge.generated.json
│   │   ├── tag_bridge_report.json
│   │   └── zh_visual_concepts.source.json
│   ├── test_helpers.ts             # Test utility functions (createMockContext)
│   ├── style.css                   # Extension styles
│   └── *.test.ts                   # Unit tests with comprehensive coverage
├── i18n/
│   ├── en-us.json
│   └── zh-cn.json
├── scripts/
│   ├── update-tag-catalog.mjs      # Development-time catalog fetch/filter/classify
│   └── generate-zh-tag-bridge.mjs  # Development-time bridge/report generator
├── server-plugin/
│   └── auto-illustrator-nai-advanced/ # Companion backend for NovelAI Vibe/Inpaint
├── globals.d.ts                    # TypeScript type definitions (SillyTavern context)
├── manifest.json                   # Extension metadata
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration (with DOM types)
├── tsconfig.build.json             # Production build config (excludes tests)
├── webpack.config.js               # Webpack build configuration
├── .github-issue-error-handling.md # Issue template for error handling improvements
├── CHANGELOG.md                    # Version history
└── docs/
    ├── DEVELOPMENT.md              # This file
    ├── LOGGING.md                  # Logging system documentation
    ├── design_doc.md               # Architecture documentation
    └── silly_tavern_dev_tips.md    # SillyTavern extension development guide
```

### Tag Catalog Data Rules

- Runtime must never fetch tag catalog or bridge data from the network.
- `src/data/tag_catalog.json`, `src/data/zh_tag_bridge.generated.json`, and `src/data/tag_bridge_report.json` ship with the extension bundle.
- `npm run catalog:update` is a development/release-prep script. It fetches public tag data, filters/classifies general tags, writes the bundled catalog, then regenerates the Chinese bridge/report.
- `npm run catalog:bridge` rebuilds the Chinese trigger bridge/report from the current catalog and `src/data/zh_visual_concepts.source.json`.
- User-added tags and trigger supplements live in extension settings. They supplement bundled data and must not mutate the bundled JSON at runtime.
- Prompt generation sends only a compact matched candidate subset. It must not send the full catalog to the LLM.

### Managed SillyTavern Regex Rules

- `src/st_regex_sanitizer.ts` owns the three Conso-managed native Regex scripts.
- The managed rules filter `img-prompt`, `auto-illustrator`, and `img` tags only from outgoing prompts. They must not delete metadata from chat text.
- Rules are written to `context.extensionSettings.regex` with stable IDs and should preserve the user's enabled/disabled state when template fields are refreshed.
- Default runtime fields are `promptOnly: true`, `placement: [1, 2]`, `runOnEdit: true`, and `minDepth: 0`.
- The native SillyTavern Regex list redraws after page refresh. Do not depend on private Regex UI loaders from the SillyTavern extension.

### Vibe Source Storage

- Source-image Vibes use the companion backend plugin for content-addressed source-image storage.
- Frontend settings keep the source hash plus encoded Vibe cache data. They should not keep inline source-image base64 after backend storage succeeds.
- Legacy inline sources are migrated through `src/services/vibe_source_migration.ts`; failed migration must preserve inline data so generation can still work.
- Backend files live under the SillyTavern user's files directory in `auto-illustrator-vibe-source/` and are keyed by source-image content hash.
- Generation payloads may carry `reference_source_hash_multiple`; the backend reads the source bytes before calling NovelAI encode-vibe.

### Coding Standards

- **Style Guide**: Google TypeScript Style Guide (enforced by `gts`)
- **Testing**: Vitest with comprehensive code coverage
- **Type Safety**: Strict TypeScript with minimal `any` usage
- **Architecture**: Modular design with single responsibility principle
- **Centralization**:
  - All constants in `src/constants.ts`
  - All regex patterns in `src/regex.ts`
  - All shared types in `src/types.ts`
  - All event types in `globals.d.ts` (no string fallbacks)
- **Logging**: Use structured logging via `logger.ts` (never `console.log`)
- **Test Helpers**: Use `createMockContext()` for type-safe partial mocks
- **Error Handling**: See `.github-issue-error-handling.md` for improvement roadmap

### Testing

#### Automated Testing

The extension uses Vitest for unit testing with jsdom environment:

```bash
# Run all tests
npm test

# Watch mode for TDD
npm run test:watch

# Coverage report
npm run test:coverage
```

**Test Utilities:**
- `createMockContext()` - Helper for creating type-safe partial SillyTavern context mocks
- All tests use proper TypeScript types with minimal `any` usage

**Test Coverage:**
- Comprehensive test suite covering all major modules
- Image extraction and generation
- Settings management
- Streaming monitor and queue
- Queue processor
- Chat history pruning
- Message handling
- Barrier coordination and session lifecycle

**Current Release Gate:**
- `npm test`
- `npm run lint`
- `npm run compile`
- `node --check server-plugin/auto-illustrator-nai-advanced/index.mjs`
- `npm run build`
- `git diff --check`

#### Manual Testing

**Critical**: Before merging feature branches to `main`, perform manual testing in a live SillyTavern environment.

See **[MANUAL_TESTING.md](MANUAL_TESTING.md)** for a comprehensive checklist covering:
- Streaming mode image generation
- Manual generation and regeneration
- Concurrency control
- Session management
- Error handling
- Settings persistence
- Progress widget behavior
- Performance tests
- Edge cases

**Time estimate**: 30-45 minutes for full manual test suite before each major merge.

### Making Changes

1. **Create a Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Write Tests First** (TDD approach):
   ```bash
   npm run test:watch
   ```

3. **Implement Feature**: Write code in `src/`

4. **Ensure Tests Pass**:
   ```bash
   npm test
   ```

5. **Lint and Format**:
   ```bash
   npm run fix
   ```

6. **Build**:
   ```bash
   npm run build
   ```

7. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

### Adding New Settings

When adding a new setting to the extension, follow these steps to ensure it works correctly:

#### 1. Add the Constant (if applicable)

If the setting has min/max/default values, add them to `src/constants.ts`:

```typescript
export const MY_NEW_SETTING = {
  DEFAULT: 100,
  MIN: 0,
  MAX: 1000,
  STEP: 10,
} as const;
```

#### 2. Update the Settings Type

Add the setting field to `AutoIllustratorSettings` in `globals.d.ts`:

```typescript
interface AutoIllustratorSettings {
  // ... existing fields
  myNewSetting: number;  // Add your new field
}
```

#### 3. Add to Default Settings

Update `DEFAULT_SETTINGS` in `src/constants.ts`:

```typescript
export const DEFAULT_SETTINGS = {
  // ... existing fields
  myNewSetting: MY_NEW_SETTING.DEFAULT,
};
```

#### 4. Add UI Element ID

Add the element ID to `UI_ELEMENT_IDS` in `src/constants.ts`:

```typescript
export const UI_ELEMENT_IDS = {
  // ... existing IDs
  MY_NEW_SETTING: 'auto_illustrator_my_new_setting',
} as const;
```

#### 5. Create the UI Element

Add the HTML input/select to the settings UI in `src/settings.ts`:

```typescript
<label for="${UI_ELEMENT_IDS.MY_NEW_SETTING}">
  <span>${t('settings.myNewSetting')}</span>
  <small>${t('settings.myNewSettingDesc')}</small>
  <input id="${UI_ELEMENT_IDS.MY_NEW_SETTING}" class="text_pole" type="number"
         min="${MY_NEW_SETTING.MIN}" max="${MY_NEW_SETTING.MAX}"
         step="${MY_NEW_SETTING.STEP}" />
</label>
```

#### 6. Add i18n Translations

Add translation keys to both `i18n/en-us.json` and `i18n/zh-cn.json`:

```json
{
  "settings.myNewSetting": "My New Setting",
  "settings.myNewSettingDesc": "Description of what this setting does"
}
```

#### 7. Add to handleSettingsChange()

In `src/index.ts`, retrieve the DOM element in the `handleSettingsChange()` function:

```typescript
function handleSettingsChange(): void {
  // ... existing element retrievals
  const myNewSettingInput = document.getElementById(
    UI_ELEMENT_IDS.MY_NEW_SETTING
  ) as HTMLInputElement;

  // ... read and save the value
  settings.myNewSetting = myNewSettingInput
    ? parseInt(myNewSettingInput.value)
    : settings.myNewSetting;
```

#### 8. Add to updateUI()

In `src/index.ts`, retrieve the element and set its value in `updateUI()`:

```typescript
function updateUI(): void {
  // ... existing element retrievals
  const myNewSettingInput = document.getElementById(
    UI_ELEMENT_IDS.MY_NEW_SETTING
  ) as HTMLInputElement;

  // ... set the value
  if (myNewSettingInput)
    myNewSettingInput.value = settings.myNewSetting.toString();
```

#### 9. **CRITICAL**: Add Event Listener

In the `getApi()` function where event listeners are attached, add:

```typescript
// Get the element
const myNewSettingInput = document.getElementById(
  UI_ELEMENT_IDS.MY_NEW_SETTING
);

// Attach the event listener
myNewSettingInput?.addEventListener('change', handleSettingsChange);
```

**⚠️ Common Pitfall**: Forgetting this step will cause the setting to not persist!
The setting will appear to work but will revert to default on page reload.

#### 10. Use the Setting

Access the setting value through the `settings` object:

```typescript
// Example usage
if (settings.myNewSetting > 0) {
  // Do something with the setting
}
```

#### 11. Add Tests

Create or update tests to verify the setting works correctly:

```typescript
it('should save and load myNewSetting', () => {
  const context = createMockContext();
  context.extensionSettings.auto_illustrator = {
    myNewSetting: 500,
  };

  const loaded = loadSettings(context);
  expect(loaded.myNewSetting).toBe(500);
});
```

#### Checklist

Use this checklist when adding a new setting:

- [ ] Constant added to `src/constants.ts` (if applicable)
- [ ] Field added to `AutoIllustratorSettings` in `globals.d.ts`
- [ ] Default value added to `DEFAULT_SETTINGS` in `src/constants.ts`
- [ ] UI element ID added to `UI_ELEMENT_IDS` in `src/constants.ts`
- [ ] HTML element created in `src/settings.ts`
- [ ] i18n translations added to both `en-us.json` and `zh-cn.json`
- [ ] Element retrieved in `handleSettingsChange()` in `src/index.ts`
- [ ] Value read and saved in `handleSettingsChange()`
- [ ] Element retrieved in `updateUI()` in `src/index.ts`
- [ ] Value set in `updateUI()`
- [ ] **Element retrieved in event listener setup (getApi function)**
- [ ] **Event listener attached to trigger `handleSettingsChange()`**
- [ ] Tests added/updated
- [ ] Code formatted with `npm run fix`
- [ ] All tests pass with `npm test`

### Commit Message Format

Follow Conventional Commits specification:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tooling changes
