/**
 * Auto Illustrator Extension for SillyTavern
 * Automatically generates inline images based on story context
 */

import './style.css';
import {
  pruneGeneratedImages,
  pruneGeneratedImagesAndPrompts,
} from './chat_history_pruner';
import {sessionManager} from './session_manager';
// metadata functions imported where needed
import {
  handleStreamTokenStarted,
  handleMessageReceived,
  handleGenerationEnded,
  handleManualIndependentPromptRetry,
} from './message_handler';
import {addImageClickHandlers} from './manual_generation';
import {syncIndependentPromptRetryButtons} from './independent_prompt_retry';
import {
  loadSettings,
  saveSettings,
  getDefaultSettings,
  createSettingsUI,
} from './settings';
import {createLogger, setLogLevel} from './logger';
import {
  UI_ELEMENT_IDS,
  DEFAULT_PROMPT_DETECTION_PATTERNS,
  STREAMING_POLL_INTERVAL,
  MAX_CONCURRENT_GENERATIONS,
  MIN_GENERATION_INTERVAL,
  MAX_PROMPTS_PER_MESSAGE,
  CONTEXT_MESSAGE_COUNT,
  META_PROMPT_DEPTH,
  IMAGE_DISPLAY_WIDTH,
  IMAGE_RETENTION_DAYS,
  INDEPENDENT_LLM_MAX_TOKENS,
  STANDALONE_PROMPT_COUNT,
  DEFAULT_LLM_FREQUENCY_GUIDELINES,
  DEFAULT_LLM_PROMPT_WRITING_GUIDELINES,
  DEFAULT_CONTENT_FILTER_TAGS,
  PROMPT_GENERATION_MODE,
  EXTENSION_VERSION,
  GITHUB_REPO,
  VIBE_TRANSFER,
  SERVER_PLUGIN,
} from './constants';
import type {
  GenerationStylePreset,
  VibeLibraryItem,
  VibeLibraryGenerationSettings,
  VibeTransferCombination,
  VibeTransferPreset,
  VibeTransferReferenceImage,
} from './types';
import {
  exportVibeBundle,
  findVibeEncodingForModel,
  findVibeEncodingForModelAndInformation,
  getVibeBundleDisplayName,
  legacyReferenceToVibeLibraryItem,
  nameImportedVibeBundleItems,
  parseVibeBundleJson,
} from './services/vibe_bundle';
import {extractErrorMessage} from './utils/error_utils';
import {
  getPresetById,
  isPresetPredefined,
  isPredefinedPresetName,
} from './meta_prompt_presets';
import {
  getIndependentLlmPresetById,
  isIndependentLlmPresetPredefined,
  isIndependentLlmPredefinedPresetName,
} from './independent_llm_presets';
import {
  initializeConcurrencyLimiter,
  updateMaxConcurrent,
  updateMinInterval,
  setImageSubfolderLabel,
} from './image_generator';
import {initializeI18n, t} from './i18n';
import {extractImagePromptsMultiPattern} from './regex';
import {progressManager} from './progress_manager';
import {
  initializeProgressWidget,
  clearProgressWidgetState,
} from './progress_widget';
import {initializeGalleryWidget, getGalleryWidget} from './gallery_widget';

const VIBE_MANAGER_PENDING_VIEW_ID = '__pending_encoding__';
import {StreamingPreviewWidget} from './streaming_preview_widget';
import {isIndependentApiMode} from './mode_utils';
import {initializeChatChangedHandler} from './chat_changed_handler';
import {initializeChatChangeOperations} from './chat_change_operations';
import {runStartupCleanup} from './image_cleaner';
import {getMetadata, saveMetadata} from './metadata';
import {
  initializeWorldInfoPanel,
  toggleWorldInfoPanelVisibility,
  registerWorldInfoEventListeners,
} from './worldinfo_ui';
import {initializeCharacterTagsPanel} from './character_tags_ui';
import {initializeStandaloneGeneration} from './standalone_generation_ui';
import {initializePromptLibrary} from './prompt_library_ui';
import {initializeTagCatalog} from './tag_catalog_ui';
import {initializePresetImport} from './preset_import_ui';
import {initializeRegexSanitizerPanel} from './st_regex_sanitizer';
import {listAvailableStyleNames} from './services/sd_style_randomizer';
import {createVibeSourceDataUrl} from './services/vibe_source_image';
import {htmlEncode} from './utils/dom_utils';
import {readSdSettings, readString} from './services/novelai_common';
import {
  initializeFloatingPanel,
  openFloatingPanel,
  setFloatingPanelLauncherVisible,
} from './floating_panel_ui';

const logger = createLogger('Main');

// Module state
let context: SillyTavernContext;
let settings: AutoIllustratorSettings;
let isEditingPreset = false; // Track if user is currently editing a preset
let isEditingIndependentLlmPreset = false; // Track if user is editing independent LLM preset
let streamingPreviewWidget: StreamingPreviewWidget | null = null; // Streaming preview widget instance
let imageWidthUpdateTimer: ReturnType<typeof setTimeout> | null = null; // Debounce timer for image width updates
let previousImageDisplayWidth: number | null = null; // Track previous width to detect actual changes
let extensionInitialized = false;

type RegisteredEventHandlers = {
  streamTokenReceived: () => void;
  messageReceived: (messageId: number) => void;
  messageUpdated: () => void;
  generationStarted: (type: string, options: unknown, dryRun: boolean) => void;
  generationEnded: (messageId: number) => void;
  chatCompletionPromptReady: (eventData: any) => void;
};
let registeredEventHandlers: RegisteredEventHandlers | null = null;

// Generation state
export let currentGenerationType: string | null = null; // Track generation type for filtering

/**
 * Get the streaming preview widget instance
 * @returns Streaming preview widget or null if not initialized
 */
export function getStreamingPreviewWidget(): StreamingPreviewWidget | null {
  return streamingPreviewWidget;
}

/**
 * Checks if streaming generation is currently active
 * @param messageId - Optional message ID to check. If provided, checks if THIS message is streaming.
 *                    If omitted, checks if ANY message is streaming.
 * @returns True if streaming is in progress
 */
export function isStreamingActive(messageId?: number): boolean {
  return sessionManager?.isActive(messageId) ?? false;
}

/**
 * Checks if a specific message is currently being streamed
 * @param messageId - Message ID to check
 * @returns True if this message is being streamed
 */
export function isMessageBeingStreamed(messageId: number): boolean {
  return sessionManager?.isActive(messageId) ?? false;
}

/**
 * Updates the UI elements with current settings
 */
/**
 * Renders the SD style pool checkbox list inside SD_STYLE_POOL_LIST container.
 * Reads available styles from `extension_settings.sd.styles[]` via the
 * randomizer service and reflects current `settings.sdStylePoolWhitelist`.
 *
 * Layout: ticked styles bubble to the top (alphabetical within group),
 * un-ticked styles below (alphabetical). Optional search filter narrows
 * the visible set without affecting persisted whitelist.
 */
function renderSdStylePoolList(): void {
  const container = document.getElementById(UI_ELEMENT_IDS.SD_STYLE_POOL_LIST);
  const summary = document.getElementById(UI_ELEMENT_IDS.SD_STYLE_POOL_SUMMARY);
  if (!container) return;

  const st = (
    globalThis as {SillyTavern?: {getContext?: () => SillyTavernContext}}
  ).SillyTavern;
  const context =
    st && typeof st.getContext === 'function' ? st.getContext() : null;

  const names = context ? listAvailableStyleNames(context) : [];
  const whitelist = Array.isArray(settings.sdStylePoolWhitelist)
    ? settings.sdStylePoolWhitelist
    : [];
  const selectedCount = names.filter(name => whitelist.includes(name)).length;
  if (summary) {
    summary.textContent = t('settings.sdStylePoolSummary', {
      selected: String(selectedCount),
      total: String(names.length),
    });
  }

  if (names.length === 0) {
    container.innerHTML = `<small class="auto-illustrator-sd-style-pool-empty" style="opacity:0.7;">${t(
      'settings.sdStylePoolEmpty'
    )}</small>`;
    return;
  }

  // Read current search filter (if any).
  const searchInput = document.getElementById(
    UI_ELEMENT_IDS.SD_STYLE_POOL_SEARCH
  ) as HTMLInputElement | null;
  const filter = (searchInput?.value ?? '').trim().toLowerCase();

  // Partition + alphabetical sort within each group.
  const ticked = names
    .filter(n => whitelist.includes(n))
    .sort((a, b) => a.localeCompare(b));
  const unticked = names
    .filter(n => !whitelist.includes(n))
    .sort((a, b) => a.localeCompare(b));
  const ordered = [...ticked, ...unticked];

  // Apply search filter.
  const visible = filter
    ? ordered.filter(n => n.toLowerCase().includes(filter))
    : ordered;

  if (visible.length === 0) {
    container.innerHTML = `<small class="auto-illustrator-sd-style-pool-empty" style="opacity:0.7;">${t(
      'settings.sdStylePoolNoMatch'
    )}</small>`;
    return;
  }

  const tickedSet = new Set(ticked);
  container.innerHTML = visible
    .map(name => {
      const checked = tickedSet.has(name) ? ' checked' : '';
      const safe = htmlEncode(name);
      return `<label class="checkbox_label auto-illustrator-sd-style-pool-item" style="display:flex; align-items:center; gap:0.4rem; padding:2px 0;">
        <input type="checkbox" class="auto-illustrator-sd-style-pool-checkbox" data-style-name="${safe}"${checked} />
        <span>${safe}</span>
      </label>`;
    })
    .join('');
}

function getAvailableSdStyleNames(): string[] {
  const st = (
    globalThis as {SillyTavern?: {getContext?: () => SillyTavernContext}}
  ).SillyTavern;
  const context =
    st && typeof st.getContext === 'function' ? st.getContext() : null;
  return context ? listAvailableStyleNames(context) : [];
}

function createGenerationStylePresetId(name: string): string {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  return `generation_style_${Date.now()}_${safeName}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createUniqueGenerationStylePresetName(
  name: string,
  presets: GenerationStylePreset[]
): string {
  const existingNames = new Set(presets.map(preset => preset.name));
  if (!existingNames.has(name)) {
    return name;
  }

  let index = 2;
  let uniqueName = `${name} (${index})`;
  while (existingNames.has(uniqueName)) {
    index += 1;
    uniqueName = `${name} (${index})`;
  }
  return uniqueName;
}

function getGenerationStylePresets(): GenerationStylePreset[] {
  return Array.isArray(settings.generationStylePresets)
    ? settings.generationStylePresets
    : [];
}

function syncFixedGenerationStyleFieldsFromDom(): void {
  const fixedSdStyleSelect = document.getElementById(
    UI_ELEMENT_IDS.FIXED_SD_STYLE_SELECT
  ) as HTMLSelectElement | null;
  const fixedVibeCombinationSelect = document.getElementById(
    UI_ELEMENT_IDS.FIXED_VIBE_COMBINATION_SELECT
  ) as HTMLSelectElement | null;
  if (fixedSdStyleSelect) {
    settings.fixedSdStyleName = fixedSdStyleSelect.value;
  }
  if (fixedVibeCombinationSelect) {
    settings.fixedVibeCombinationId = fixedVibeCombinationSelect.value;
  }
}

function renderGenerationStylePresetSelect(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.GENERATION_STYLE_PRESET_SELECT
  ) as HTMLSelectElement | null;
  const nameInput = document.getElementById(
    UI_ELEMENT_IDS.GENERATION_STYLE_PRESET_NAME
  ) as HTMLInputElement | null;
  if (!select) return;

  const presets = getGenerationStylePresets();
  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = t('settings.generationStylePresetNone');
  select.appendChild(empty);

  presets.forEach(preset => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    select.appendChild(option);
  });

  select.value = settings.currentGenerationStylePresetId || '';
  const selected = presets.find(
    preset => preset.id === settings.currentGenerationStylePresetId
  );
  if (nameInput) {
    nameInput.value = selected?.name ?? '';
  }
}

function renderFixedSdStyleSelect(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.FIXED_SD_STYLE_SELECT
  ) as HTMLSelectElement | null;
  if (!select) return;

  const names = getAvailableSdStyleNames();
  const current =
    typeof settings.fixedSdStyleName === 'string'
      ? settings.fixedSdStyleName
      : '';

  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = t('settings.fixedSdStyleNone');
  select.appendChild(empty);

  if (current && !names.includes(current)) {
    const missing = document.createElement('option');
    missing.value = current;
    missing.textContent = t('settings.missingOption', {name: current});
    select.appendChild(missing);
  }

  names
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  select.value = current;
}

function applyGenerationStylePresetById(presetId: string): void {
  const preset = getGenerationStylePresets().find(
    entry => entry.id === presetId
  );
  if (!preset) {
    settings.currentGenerationStylePresetId = '';
    saveSettings(settings, context);
    updateUI();
    return;
  }

  settings.currentGenerationStylePresetId = preset.id;
  settings.fixedSdStyleName = preset.sdStyleName;
  settings.fixedVibeCombinationId = preset.vibeCombinationId;
  saveSettings(settings, context);
  updateUI();
}

function saveCurrentGenerationStylePreset(): void {
  syncFixedGenerationStyleFieldsFromDom();
  const nameInput = document.getElementById(
    UI_ELEMENT_IDS.GENERATION_STYLE_PRESET_NAME
  ) as HTMLInputElement | null;
  const name = nameInput?.value.trim() || '';
  if (!name) {
    toastr.warning(
      t('toast.generationStylePresetNameRequired'),
      t('extensionName')
    );
    return;
  }
  if (!settings.fixedSdStyleName && !settings.fixedVibeCombinationId) {
    toastr.warning(t('toast.generationStylePresetEmpty'), t('extensionName'));
    return;
  }

  const now = Date.now();
  const presets = getGenerationStylePresets();
  const uniqueName = createUniqueGenerationStylePresetName(name, presets);
  const preset: GenerationStylePreset = {
    id: createGenerationStylePresetId(uniqueName),
    name: uniqueName,
    sdStyleName: settings.fixedSdStyleName,
    vibeCombinationId: settings.fixedVibeCombinationId,
    createdAt: now,
    updatedAt: now,
  };
  settings.generationStylePresets = [preset, ...presets].slice(
    0,
    VIBE_TRANSFER.MAX_PRESETS
  );
  settings.currentGenerationStylePresetId = preset.id;
  saveSettings(settings, context);
  updateUI();
  toastr.success(
    t('toast.presetSavedNamed', {name: uniqueName}),
    t('extensionName')
  );
}

function overwriteSelectedGenerationStylePreset(): void {
  syncFixedGenerationStyleFieldsFromDom();
  const presets = getGenerationStylePresets();
  const existing = presets.find(
    preset => preset.id === settings.currentGenerationStylePresetId
  );
  if (!existing) {
    toastr.warning(
      t('toast.generationStylePresetSelectToOverwrite'),
      t('extensionName')
    );
    return;
  }
  if (!settings.fixedSdStyleName && !settings.fixedVibeCombinationId) {
    toastr.warning(t('toast.generationStylePresetEmpty'), t('extensionName'));
    return;
  }
  const nameInput = document.getElementById(
    UI_ELEMENT_IDS.GENERATION_STYLE_PRESET_NAME
  ) as HTMLInputElement | null;
  const name = nameInput?.value.trim() || existing.name;
  if (!confirm(t('prompt.overwritePreset', {name: existing.name}))) {
    return;
  }

  const now = Date.now();
  settings.generationStylePresets = presets.map(preset =>
    preset.id === existing.id
      ? {
          ...preset,
          name,
          sdStyleName: settings.fixedSdStyleName,
          vibeCombinationId: settings.fixedVibeCombinationId,
          updatedAt: now,
        }
      : preset
  );
  saveSettings(settings, context);
  updateUI();
  toastr.success(t('toast.presetSavedNamed', {name}), t('extensionName'));
}

function deleteSelectedGenerationStylePreset(): void {
  const presets = getGenerationStylePresets();
  const existing = presets.find(
    preset => preset.id === settings.currentGenerationStylePresetId
  );
  if (!existing) {
    toastr.error(t('toast.presetNotFound'), t('extensionName'));
    return;
  }
  if (!confirm(t('prompt.deletePresetConfirm', {name: existing.name}))) {
    return;
  }

  settings.generationStylePresets = presets.filter(
    preset => preset.id !== existing.id
  );
  settings.currentGenerationStylePresetId = '';
  saveSettings(settings, context);
  updateUI();
}

function getSavedVibeCombinations(): VibeTransferCombination[] {
  const validItemIds = new Set(
    (Array.isArray(settings.vibeTransferLibraryItems)
      ? settings.vibeTransferLibraryItems
      : []
    ).map(item => item.id)
  );
  return (
    Array.isArray(settings.vibeTransferCombinations)
      ? settings.vibeTransferCombinations
      : []
  ).filter(
    combo =>
      combo &&
      typeof combo.id === 'string' &&
      typeof combo.name === 'string' &&
      Array.isArray(combo.itemIds) &&
      combo.itemIds.some(id => validItemIds.has(id))
  );
}

function renderFixedVibeCombinationSelect(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.FIXED_VIBE_COMBINATION_SELECT
  ) as HTMLSelectElement | null;
  if (!select) return;

  const combos = getSavedVibeCombinations();
  const current =
    typeof settings.fixedVibeCombinationId === 'string'
      ? settings.fixedVibeCombinationId
      : '';

  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = t('settings.fixedVibeCombinationNone');
  select.appendChild(empty);

  const currentCombo = combos.find(combo => combo.id === current);
  if (current && !currentCombo) {
    const missing = document.createElement('option');
    missing.value = current;
    missing.textContent = t('settings.missingOption', {name: current});
    select.appendChild(missing);
  }

  combos
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(combo => {
      const option = document.createElement('option');
      option.value = combo.id;
      option.textContent = combo.name;
      select.appendChild(option);
    });
  select.value = current;
}

function updateGenerationStyleModeVisibility(): void {
  const mode =
    settings.generationStyleMode === 'fixed' ||
    settings.generationStyleMode === 'random'
      ? settings.generationStyleMode
      : 'off';
  const fixedPanel = document.getElementById(UI_ELEMENT_IDS.FIXED_STYLE_PANEL);
  const randomPanel = document.getElementById(
    UI_ELEMENT_IDS.RANDOM_STYLE_PANEL
  );
  if (fixedPanel) fixedPanel.style.display = mode === 'fixed' ? '' : 'none';
  if (randomPanel) randomPanel.style.display = mode === 'random' ? '' : 'none';
}

function renderVibeCombinationPoolList(): void {
  const container = document.getElementById(
    UI_ELEMENT_IDS.VIBE_COMBINATION_POOL_LIST
  );
  const summary = document.getElementById(
    UI_ELEMENT_IDS.VIBE_COMBINATION_POOL_SUMMARY
  );
  if (!container) return;

  const combos = getSavedVibeCombinations();
  const whitelist = Array.isArray(settings.vibeCombinationPoolWhitelist)
    ? settings.vibeCombinationPoolWhitelist
    : [];
  const selectedCount = combos.filter(combo =>
    whitelist.includes(combo.id)
  ).length;
  if (summary) {
    summary.textContent = t('settings.vibeCombinationPoolSummary', {
      selected: String(selectedCount),
      total: String(combos.length),
    });
  }

  if (combos.length === 0) {
    container.innerHTML = `<small class="auto-illustrator-random-pool-empty">${t(
      'settings.vibeCombinationPoolEmpty'
    )}</small>`;
    return;
  }

  const searchInput = document.getElementById(
    UI_ELEMENT_IDS.VIBE_COMBINATION_POOL_SEARCH
  ) as HTMLInputElement | null;
  const filter = (searchInput?.value ?? '').trim().toLowerCase();
  const checkedIds = new Set(whitelist);
  const checked = combos
    .filter(combo => checkedIds.has(combo.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const unchecked = combos
    .filter(combo => !checkedIds.has(combo.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const ordered = [...checked, ...unchecked];
  const visible = filter
    ? ordered.filter(combo => combo.name.toLowerCase().includes(filter))
    : ordered;

  if (visible.length === 0) {
    container.innerHTML = `<small class="auto-illustrator-random-pool-empty">${t(
      'settings.vibeCombinationPoolNoMatch'
    )}</small>`;
    return;
  }

  container.innerHTML = visible
    .map(combo => {
      const id = htmlEncode(combo.id);
      const name = htmlEncode(combo.name);
      const checkedAttr = checkedIds.has(combo.id) ? ' checked' : '';
      const count = combo.itemIds.length;
      return `<label class="checkbox_label auto-illustrator-random-pool-item auto-illustrator-vibe-combination-pool-item">
        <input type="checkbox" class="auto-illustrator-vibe-combination-pool-checkbox" data-combination-id="${id}"${checkedAttr} />
        <span>${name}</span>
        <small>${t('settings.vibeCombinationPoolItemCount', {
          count: String(count),
        })}</small>
      </label>`;
    })
    .join('');
}

function formatVibeValue(value: number): string {
  return value.toFixed(2);
}

function clampFloatValue(
  value: number,
  min: number,
  max: number,
  step: number,
  fallback = min
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value / step) * step;
  return Number(Math.max(min, Math.min(max, rounded)).toFixed(4));
}

function getVibeReferenceSearchQuery(): string {
  const input = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_REFERENCE_SEARCH
  ) as HTMLInputElement | null;
  return input?.value.trim().toLowerCase() ?? '';
}

function parseVibeReferenceTagInput(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
    ),
  ];
}

function doesVibeReferenceMatchSearch(
  ref: VibeTransferReferenceImage,
  query: string
): boolean {
  if (!query) return true;
  const haystack = [
    ref.name,
    ...(Array.isArray(ref.tags) ? ref.tags : []),
  ].join('\n');
  return haystack.toLowerCase().includes(query);
}

function renderVibeTransferReferenceList(): void {
  const container = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_REFERENCE_LIST
  );
  if (!container) return;

  const refs = Array.isArray(settings.vibeTransferReferenceImages)
    ? settings.vibeTransferReferenceImages
    : [];

  if (refs.length === 0) {
    container.innerHTML = `<small class="auto-illustrator-vibe-transfer-empty">${t(
      'settings.vibeTransferNoReferences'
    )}</small>`;
    return;
  }

  const searchQuery = getVibeReferenceSearchQuery();
  const sortedRefs = [...refs]
    .filter(ref => doesVibeReferenceMatchSearch(ref, searchQuery))
    .sort((a, b) => {
      const aEnabled = a.enabled !== false;
      const bEnabled = b.enabled !== false;
      if (aEnabled === bEnabled) return 0;
      return aEnabled ? -1 : 1;
    });

  if (sortedRefs.length === 0) {
    container.innerHTML = `<small class="auto-illustrator-vibe-transfer-empty">${t(
      'settings.vibeTransferNoSearchResults'
    )}</small>`;
    return;
  }

  container.innerHTML = sortedRefs
    .map(ref => {
      const id = htmlEncode(ref.id);
      const name = htmlEncode(ref.name);
      const dataUrl = htmlEncode(ref.dataUrl);
      const tags = Array.isArray(ref.tags) ? ref.tags : [];
      const checked = ref.enabled !== false ? ' checked' : '';
      const cacheCount = Array.isArray(ref.encodedVibes)
        ? ref.encodedVibes.length
        : 0;
      const cacheLabel = cacheCount
        ? t('settings.vibeTransferReferenceCached', {
            count: String(cacheCount),
          })
        : t('settings.vibeTransferReferenceNotCached');
      const tagChips = tags
        .map(tag => {
          const safeTag = htmlEncode(tag);
          return `<button class="auto-illustrator-vibe-transfer-tag-chip" type="button"
                         data-vibe-reference-tag-remove-id="${id}"
                         data-vibe-reference-tag="${safeTag}"
                         title="${t('settings.vibeTransferReferenceTagRemove')}">
            <span>${safeTag}</span>
            <i class="fa-solid fa-xmark"></i>
          </button>`;
        })
        .join('');
      return `<div class="auto-illustrator-vibe-transfer-reference-item">
        <input type="checkbox" class="auto-illustrator-vibe-transfer-reference-enabled"
               data-vibe-reference-toggle-id="${id}"${checked}
               title="${t('settings.vibeTransferReferenceEnabled')}" />
        <img src="${dataUrl}" alt="${t('settings.vibeTransferReferenceAlt')}" />
        <div class="auto-illustrator-vibe-transfer-reference-meta">
          <input class="text_pole auto-illustrator-vibe-transfer-reference-name"
                 type="text" value="${name}" data-vibe-reference-name-id="${id}"
                 title="${t('settings.vibeTransferReferenceName')}" />
          <div class="auto-illustrator-vibe-transfer-tags">
            ${tagChips || `<small>${t('settings.vibeTransferReferenceNoTags')}</small>`}
          </div>
          <input class="text_pole auto-illustrator-vibe-transfer-tag-input"
                 type="text" value="" data-vibe-reference-tag-input-id="${id}"
                 placeholder="${t('settings.vibeTransferReferenceTagPlaceholder')}"
                 title="${t('settings.vibeTransferReferenceTags')}" />
          <small>${cacheLabel}</small>
        </div>
      </div>`;
    })
    .join('');
}

function updateVibeTransferStatusText(status?: string): void {
  const statusElement = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_STATUS
  );
  if (!statusElement) return;

  if (status) {
    statusElement.textContent = status;
    return;
  }

  const enabled = !!settings.vibeTransferEnabled;
  const libraryItems = Array.isArray(settings.vibeTransferLibraryItems)
    ? settings.vibeTransferLibraryItems
    : [];
  const count =
    libraryItems.length > 0
      ? libraryItems.filter(item => item.enabled !== false).length
      : Array.isArray(settings.vibeTransferReferenceImages)
        ? settings.vibeTransferReferenceImages.filter(
            ref => ref.enabled !== false
          ).length
        : 0;

  if (!enabled) {
    statusElement.textContent = t('settings.vibeTransferStatusDisabled');
  } else if (count === 0) {
    statusElement.textContent = t('settings.vibeTransferStatusNoReference');
  } else {
    statusElement.textContent = t('settings.vibeTransferStatusReady', {
      count: String(count),
    });
  }
}

function getVibeManagerSearchQuery(): string {
  const input = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_MANAGER_SEARCH
  ) as HTMLInputElement | null;
  return input?.value.trim().toLowerCase() ?? '';
}

function getVibeManagerView(): 'all' | 'pending' {
  return settings.vibeTransferManagerView === 'pending' ? 'pending' : 'all';
}

function getSelectedVibeCombinationItemIds(): string[] {
  const presetId = settings.currentVibeTransferCombinationId || '';
  if (!presetId) return [];
  const combination = (
    Array.isArray(settings.vibeTransferCombinations)
      ? settings.vibeTransferCombinations
      : []
  ).find(entry => entry.id === presetId);
  return combination?.itemIds ?? [];
}

function cloneVibeGenerationSettings(
  generation?: VibeLibraryGenerationSettings
): VibeLibraryGenerationSettings | undefined {
  if (!generation || typeof generation !== 'object') return undefined;
  const cloned: VibeLibraryGenerationSettings = {};
  if (typeof generation.inheritGlobalStrength === 'boolean') {
    cloned.inheritGlobalStrength = generation.inheritGlobalStrength;
  }
  if (typeof generation.strength === 'number') {
    cloned.strength = generation.strength;
  }
  if (typeof generation.inheritGlobalInformationExtracted === 'boolean') {
    cloned.inheritGlobalInformationExtracted =
      generation.inheritGlobalInformationExtracted;
  }
  if (typeof generation.information_extracted === 'number') {
    cloned.information_extracted = generation.information_extracted;
  }
  return Object.keys(cloned).length > 0 ? cloned : undefined;
}

function createVibeGenerationSettingsSnapshot(
  item: {
    generation?: VibeLibraryGenerationSettings;
    importInfo?: {strength?: number; information_extracted?: number};
  },
  overrides: {strength?: number; informationExtracted?: number} = {}
): VibeLibraryGenerationSettings {
  return {
    inheritGlobalStrength: false,
    strength: clampFloatValue(
      item.generation?.strength ??
        item.importInfo?.strength ??
        overrides.strength ??
        VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH,
      VIBE_TRANSFER.MIN,
      VIBE_TRANSFER.MAX,
      VIBE_TRANSFER.STEP,
      VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH
    ),
    inheritGlobalInformationExtracted: false,
    information_extracted: clampFloatValue(
      item.generation?.information_extracted ??
        item.importInfo?.information_extracted ??
        overrides.informationExtracted ??
        VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED,
      VIBE_TRANSFER.MIN,
      VIBE_TRANSFER.MAX,
      VIBE_TRANSFER.STEP,
      VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED
    ),
  };
}

function createVibeCombinationSnapshot(
  id: string,
  name: string,
  itemIds: string[],
  now: number,
  createdAt: number = now,
  legacyPresetId?: string
): VibeTransferCombination {
  const enabledIds = new Set(itemIds);
  const itemGenerations = Object.fromEntries(
    (Array.isArray(settings.vibeTransferLibraryItems)
      ? settings.vibeTransferLibraryItems
      : []
    )
      .filter(item => enabledIds.has(item.id))
      .map(item => [item.id, createVibeGenerationSettingsSnapshot(item)])
      .filter((entry): entry is [string, VibeLibraryGenerationSettings] =>
        Boolean(entry[1])
      )
  );
  return {
    id,
    name,
    itemIds,
    ...(Object.keys(itemGenerations).length > 0 ? {itemGenerations} : {}),
    createdAt,
    updatedAt: now,
    ...(legacyPresetId ? {legacyPresetId} : {}),
  };
}

function getSelectedVisibleVibeItemIds(): string[] {
  const list = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_MANAGER_LIST
  );
  if (!list) return [];
  return Array.from(
    list.querySelectorAll<HTMLInputElement>(
      'input[data-vibe-reference-toggle-id]:checked'
    )
  )
    .map(input => input.dataset.vibeReferenceToggleId || '')
    .filter(Boolean);
}

function getVibeItemEncodingCount(item: {
  encodings?: Record<string, Record<string, unknown>>;
}): number {
  return Object.values(item.encodings ?? {}).reduce(
    (count, slots) => count + Object.keys(slots).length,
    0
  );
}

function getCurrentVibeModel(): string {
  if (!context) return '';
  return readString(readSdSettings(context), 'model');
}

function getVibeItemCacheDetails(item: {
  encodings?: Record<
    string,
    Record<
      string,
      {params?: {information_extracted?: number}; createdAt?: number}
    >
  >;
}): {model: string; slot: string; information?: number; createdAt?: number}[] {
  return Object.entries(item.encodings ?? {}).flatMap(([model, slots]) =>
    Object.entries(slots ?? {}).map(([slot, variant]) => ({
      model,
      slot,
      information: variant.params?.information_extracted,
      createdAt: variant.createdAt,
    }))
  );
}

function getVibeItemStatusLabel(item: {
  source?: {dataUrl?: string};
  previewImage?: string;
  encodings?: Record<string, Record<string, unknown>>;
}): string {
  const hasSource = Boolean(item.source?.dataUrl || item.previewImage);
  const encodingCount = getVibeItemEncodingCount(item);
  if (hasSource && encodingCount > 0) {
    return t('settings.vibeTransferItemSourceAndEncoded');
  }
  if (encodingCount > 0) {
    return t('settings.vibeTransferItemEncodedOnly');
  }
  if (hasSource) {
    return t('settings.vibeTransferItemSourceOnly');
  }
  return t('settings.vibeTransferItemUnavailable');
}

function getVibeItemStrength(item: {
  generation?: {inheritGlobalStrength?: boolean; strength?: number};
  importInfo?: {strength?: number};
}): number {
  if (item.generation?.strength !== undefined) {
    return clampFloatValue(
      Number(item.generation.strength),
      VIBE_TRANSFER.MIN,
      VIBE_TRANSFER.MAX,
      VIBE_TRANSFER.STEP,
      VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH
    );
  }
  if (typeof item.importInfo?.strength === 'number') {
    return clampFloatValue(
      item.importInfo.strength,
      VIBE_TRANSFER.MIN,
      VIBE_TRANSFER.MAX,
      VIBE_TRANSFER.STEP,
      VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH
    );
  }
  return VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH;
}

function getVibeItemInformation(item: {
  generation?: {
    inheritGlobalInformationExtracted?: boolean;
    information_extracted?: number;
  };
  importInfo?: {information_extracted?: number};
}): number {
  if (item.generation?.information_extracted !== undefined) {
    return clampFloatValue(
      Number(item.generation.information_extracted),
      VIBE_TRANSFER.MIN,
      VIBE_TRANSFER.MAX,
      VIBE_TRANSFER.STEP,
      VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED
    );
  }
  if (typeof item.importInfo?.information_extracted === 'number') {
    return clampFloatValue(
      item.importInfo.information_extracted,
      VIBE_TRANSFER.MIN,
      VIBE_TRANSFER.MAX,
      VIBE_TRANSFER.STEP,
      VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED
    );
  }
  return VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED;
}

function doesVibeItemHaveCurrentEncoding(item: {
  source?: {dataUrl?: string};
  previewImage?: string;
  encodings?: Record<string, Record<string, unknown>>;
  importInfo?: {model?: string; information_extracted?: number};
  generation?: VibeLibraryGenerationSettings;
}): boolean {
  const model = getCurrentVibeModel();
  if (!model) return getVibeItemEncodingCount(item) > 0;
  const hasSource = Boolean(item.source?.dataUrl || item.previewImage);
  if (!hasSource) {
    return Boolean(findVibeEncodingForModel(item as VibeLibraryItem, model));
  }
  return Boolean(
    findVibeEncodingForModelAndInformation(
      item as VibeLibraryItem,
      model,
      getVibeItemInformation(item)
    )
  );
}

function isVibeItemPendingEncoding(item: {
  source?: {dataUrl?: string};
  previewImage?: string;
  encodings?: Record<string, Record<string, unknown>>;
  importInfo?: {model?: string};
  generation?: VibeLibraryGenerationSettings;
}): boolean {
  const hasSource = Boolean(item.source?.dataUrl || item.previewImage);
  return hasSource && !doesVibeItemHaveCurrentEncoding(item);
}

function formatVibeCacheCreatedAt(value?: number): string {
  if (!value || !Number.isFinite(value)) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function renderVibeTransferManagerList(): void {
  const container = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_MANAGER_LIST
  );
  const statusElement = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_MANAGER_STATUS
  );
  if (!container && !statusElement) return;

  const items = Array.isArray(settings.vibeTransferLibraryItems)
    ? settings.vibeTransferLibraryItems
    : [];
  const enabledCount = items.filter(item => item.enabled !== false).length;
  if (statusElement) {
    statusElement.textContent = t('settings.vibeTransferManagerStatus', {
      count: String(items.length),
      enabled: String(enabledCount),
    });
  }
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<small class="auto-illustrator-vibe-transfer-empty">${t(
      'settings.vibeTransferManagerEmpty'
    )}</small>`;
    return;
  }

  const query = getVibeManagerSearchQuery();
  const view = getVibeManagerView();
  const selectedItemIds = getSelectedVibeCombinationItemIds();
  const selectedSet = new Set(selectedItemIds);
  const visibleItems =
    view === 'pending'
      ? items.filter(item => isVibeItemPendingEncoding(item))
      : settings.currentVibeTransferCombinationId
        ? items.filter(item => selectedSet.has(item.id))
        : items;
  const matched = query
    ? visibleItems.filter(item =>
        [item.name, ...(Array.isArray(item.tags) ? item.tags : [])]
          .join('\n')
          .toLowerCase()
          .includes(query)
      )
    : visibleItems;

  if (matched.length === 0) {
    container.innerHTML = `<small class="auto-illustrator-vibe-transfer-empty">${t(
      'settings.vibeTransferNoSearchResults'
    )}</small>`;
    return;
  }

  container.innerHTML = matched
    .map(item => {
      const id = htmlEncode(item.id);
      const name = htmlEncode(item.name);
      const preview = item.previewImage || item.source?.dataUrl || '';
      const checked = item.enabled !== false ? ' checked' : '';
      const strength = getVibeItemStrength(item);
      const information = getVibeItemInformation(item);
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const tagChips = tags
        .map(tag => {
          const safeTag = htmlEncode(tag);
          return `<button class="auto-illustrator-vibe-transfer-tag-chip" type="button"
                         data-vibe-reference-tag-remove-id="${id}"
                         data-vibe-reference-tag="${safeTag}"
                         title="${t('settings.vibeTransferReferenceTagRemove')}">
            <span>${safeTag}</span>
            <i class="fa-solid fa-xmark"></i>
          </button>`;
        })
        .join('');
      const statusLabel = htmlEncode(getVibeItemStatusLabel(item));
      const hasSource = Boolean(item.source?.dataUrl || item.previewImage);
      const cacheCount = getVibeItemEncodingCount(item);
      const pending = isVibeItemPendingEncoding(item);
      const currentCacheLabel = pending
        ? t('settings.vibeTransferCurrentCachePending')
        : doesVibeItemHaveCurrentEncoding(item)
          ? t('settings.vibeTransferCurrentCacheReady')
          : t('settings.vibeTransferCurrentCacheUnavailable');
      const cacheDetails = getVibeItemCacheDetails(item);
      const cacheRows = cacheDetails
        .map(detail => {
          const informationLabel =
            typeof detail.information === 'number'
              ? formatVibeValue(detail.information)
              : t('settings.vibeTransferCacheUnknownInformation');
          const createdAt = formatVibeCacheCreatedAt(detail.createdAt);
          return `<li>
            <span>${htmlEncode(detail.model)}</span>
            <span>${informationLabel}</span>
            <small>${createdAt || htmlEncode(detail.slot)}</small>
          </li>`;
        })
        .join('');
      const cacheDetailsHtml =
        cacheDetails.length > 0
          ? `<details class="auto-illustrator-vibe-manager-cache-details">
              <summary>${t('settings.vibeTransferCacheDetails', {count: String(cacheCount)})}</summary>
              <ul>${cacheRows}</ul>
            </details>`
          : `<small class="auto-illustrator-vibe-manager-cache-empty">${t('settings.vibeTransferCacheEmpty')}</small>`;
      const readonlyParams = `<div class="auto-illustrator-vibe-manager-param-summary">
        <span>${t('settings.vibeTransferCurrentParams', {
          strength: formatVibeValue(strength),
          information: formatVibeValue(information),
        })}</span>
        <span>${currentCacheLabel}</span>
      </div>`;
      const editableParams = `<div class="auto-illustrator-vibe-manager-params">
        <label>
          <span>${t('settings.vibeTransferItemStrength')}</span>
          <div class="auto-illustrator-vibe-transfer-range-row">
            <input type="range" min="${VIBE_TRANSFER.MIN}" max="${VIBE_TRANSFER.MAX}" step="${VIBE_TRANSFER.STEP}"
                   value="${strength}" data-vibe-strength-id="${id}" />
            <span>${formatVibeValue(strength)}</span>
          </div>
        </label>
        <label>
          <span>${
            hasSource
              ? t('settings.vibeTransferItemInformation')
              : t('settings.vibeTransferItemInformationImported')
          }</span>
          ${
            hasSource
              ? `<div class="auto-illustrator-vibe-transfer-range-row">
                  <input type="range" min="${VIBE_TRANSFER.MIN}" max="${VIBE_TRANSFER.MAX}" step="${VIBE_TRANSFER.STEP}"
                         value="${information}" data-vibe-information-id="${id}" />
                  <span>${formatVibeValue(information)}</span>
                </div>`
              : `<div class="auto-illustrator-vibe-manager-readonly-value">
                  <span>${formatVibeValue(information)}</span>
                  <small>${t('settings.vibeTransferItemInformationReadOnly')}</small>
                </div>`
          }
        </label>
      </div>`;
      const parameterControls = settings.vibeTransferManagerEditMode
        ? editableParams
        : readonlyParams;
      const previewHtml = preview
        ? `<img src="${htmlEncode(preview)}" alt="${t('settings.vibeTransferItemPreviewAlt')}" />`
        : '<div class="auto-illustrator-vibe-manager-item-placeholder"><i class="fa-solid fa-wave-square"></i></div>';
      return `<div class="auto-illustrator-vibe-manager-item">
        <input type="checkbox" class="auto-illustrator-vibe-transfer-reference-enabled"
               data-vibe-reference-toggle-id="${id}"${checked}
               title="${t('settings.vibeTransferItemEnabled')}" />
        ${previewHtml}
        <div class="auto-illustrator-vibe-manager-item-main">
          <input class="text_pole auto-illustrator-vibe-transfer-reference-name"
                 type="text" value="${name}" data-vibe-reference-name-id="${id}"
                 title="${t('settings.vibeTransferReferenceName')}" />
          <div class="auto-illustrator-vibe-manager-item-status">
            <span>${statusLabel}</span>
            <span>${currentCacheLabel}</span>
          </div>
          <div class="auto-illustrator-vibe-transfer-tags">
            ${tagChips || `<small>${t('settings.vibeTransferReferenceNoTags')}</small>`}
          </div>
          <input class="text_pole auto-illustrator-vibe-transfer-tag-input"
                 type="text" value="" data-vibe-reference-tag-input-id="${id}"
                 placeholder="${t('settings.vibeTransferReferenceTagPlaceholder')}"
                 title="${t('settings.vibeTransferReferenceTags')}" />
          ${parameterControls}
          ${cacheDetailsHtml}
        </div>
      </div>`;
    })
    .join('');
}

function createVibePresetId(name: string): string {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  return `vibe_preset_${Date.now()}_${safeName}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createVibeReferenceId(fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  return `vibe_${Date.now()}_${safeName}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function isSupportedVibeImage(file: File): boolean {
  const supportedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
  return (
    supportedTypes.has(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)
  );
}

function isSupportedVibeBundleFile(file: File): boolean {
  return (
    /(?:\.naiv4vibebundle\.json|\.json)$/i.test(file.name) ||
    file.type === 'application/json'
  );
}

function bindVibeFileDropZone(
  element: HTMLElement | null,
  onDrop: (files: File[]) => void
): void {
  if (!element) return;
  const setDragState = (active: boolean): void => {
    element.classList.toggle('drag-over', active);
  };
  element.addEventListener('dragover', event => {
    event.preventDefault();
    event.stopPropagation();
    setDragState(true);
  });
  element.addEventListener('dragleave', event => {
    event.preventDefault();
    event.stopPropagation();
    if (!element.contains(event.relatedTarget as Node | null)) {
      setDragState(false);
    }
  });
  element.addEventListener('drop', event => {
    event.preventDefault();
    event.stopPropagation();
    setDragState(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) {
      onDrop(files);
    }
  });
}

async function handleVibeTransferFileSelection(
  files: FileList | File[]
): Promise<void> {
  const imageFiles = Array.from(files).filter(isSupportedVibeImage);
  if (imageFiles.length === 0) {
    toastr.warning(t('toast.vibeTransferNoImageFiles'), t('extensionName'));
    return;
  }

  const existing = Array.isArray(settings.vibeTransferReferenceImages)
    ? settings.vibeTransferReferenceImages
    : [];
  const remainingSlots = Math.max(
    0,
    VIBE_TRANSFER.MAX_REFERENCES - existing.length
  );

  if (remainingSlots === 0) {
    toastr.warning(
      t('toast.vibeTransferMaxReferences', {
        max: String(VIBE_TRANSFER.MAX_REFERENCES),
      }),
      t('extensionName')
    );
    return;
  }

  const selected = imageFiles.slice(0, remainingSlots);
  const entries: VibeTransferReferenceImage[] = [];

  for (const file of selected) {
    try {
      entries.push({
        id: createVibeReferenceId(file.name),
        name: file.name || t('settings.vibeTransferUnnamedReference'),
        dataUrl: await createVibeSourceDataUrl(file),
        tags: [],
        enabled: false,
        encodedVibes: [],
        addedAt: Date.now(),
      });
    } catch (error) {
      logger.warn('Failed to read Vibe Transfer reference image:', error);
      toastr.warning(
        t('toast.vibeTransferReadFailed', {name: file.name}),
        t('extensionName')
      );
    }
  }

  if (entries.length === 0) {
    return;
  }

  settings.vibeTransferReferenceImages = [...existing, ...entries];
  const existingLibraryItems = Array.isArray(settings.vibeTransferLibraryItems)
    ? settings.vibeTransferLibraryItems
    : [];
  settings.vibeTransferLibraryItems = [
    ...existingLibraryItems,
    ...entries.map(reference =>
      legacyReferenceToVibeLibraryItem(reference, {
        now: Date.now(),
        defaultStrength: VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH,
        defaultInformationExtracted:
          VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED,
      })
    ),
  ].slice(0, VIBE_TRANSFER.MAX_REFERENCES);
  settings.currentVibeTransferPresetId = '';
  settings.currentVibeTransferCombinationId = '';
  settings.vibeTransferManagerView = 'pending';
  setEnabledVibeItemIds([]);
  saveSettings(settings, context);
  updateUI();

  if (imageFiles.length > selected.length) {
    toastr.warning(
      t('toast.vibeTransferMaxReferences', {
        max: String(VIBE_TRANSFER.MAX_REFERENCES),
      }),
      t('extensionName')
    );
  } else {
    toastr.success(
      t('toast.vibeTransferReferencesAdded', {
        count: String(entries.length),
      }),
      t('extensionName')
    );
  }
}

function readTextFile(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Read failed'));
    reader.readAsText(file);
  });
}

function createVibeTransferPresetFromItems(
  name: string,
  itemIds: string[]
): void {
  if (itemIds.length === 0) return;
  const now = Date.now();
  const presetId = createVibePresetId(name);
  const preset: VibeTransferPreset = {
    id: presetId,
    name,
    referenceIds: itemIds,
    createdAt: now,
    updatedAt: now,
  };
  settings.vibeTransferPresets = [
    preset,
    ...(Array.isArray(settings.vibeTransferPresets)
      ? settings.vibeTransferPresets
      : []),
  ].slice(0, VIBE_TRANSFER.MAX_PRESETS);
  settings.vibeTransferCombinations = [
    createVibeCombinationSnapshot(presetId, name, itemIds, now, now, presetId),
    ...(Array.isArray(settings.vibeTransferCombinations)
      ? settings.vibeTransferCombinations
      : []),
  ].slice(0, VIBE_TRANSFER.MAX_PRESETS);
  settings.currentVibeTransferPresetId = presetId;
  settings.currentVibeTransferCombinationId = presetId;
}

async function handleVibeBundleImport(file: File): Promise<void> {
  const text = await readTextFile(file);
  const bundleName = getVibeBundleDisplayName(file.name);
  const existingIds = new Set(
    (Array.isArray(settings.vibeTransferLibraryItems)
      ? settings.vibeTransferLibraryItems
      : []
    ).map(item => item.id)
  );
  const result = parseVibeBundleJson(text, {
    existingIds,
    sourceName: file.name,
  });

  if (result.items.length === 0) {
    const detail = result.errors.slice(0, 3).join(', ');
    throw new Error(detail || 'No importable vibes');
  }

  const existingItems = Array.isArray(settings.vibeTransferLibraryItems)
    ? settings.vibeTransferLibraryItems
    : [];
  const remainingSlots = Math.max(
    0,
    VIBE_TRANSFER.MAX_REFERENCES - existingItems.length
  );
  const importedItems = result.items.slice(0, remainingSlots);
  if (importedItems.length === 0) {
    throw new Error('No import slots available');
  }
  const namedImportedItems = nameImportedVibeBundleItems(
    importedItems,
    bundleName
  );
  settings.vibeTransferLibraryItems = [...existingItems, ...namedImportedItems];
  setEnabledVibeItemIds(namedImportedItems.map(item => item.id));
  createVibeTransferPresetFromItems(
    bundleName,
    namedImportedItems.map(item => item.id)
  );
  saveSettings(settings, context);
  updateUI();

  const skippedCount =
    result.errors.length +
    Math.max(0, result.items.length - importedItems.length);
  const message =
    skippedCount > 0
      ? t('settings.vibeTransferImportResultWithSkipped', {
          count: String(namedImportedItems.length),
          skipped: String(skippedCount),
        })
      : t('settings.vibeTransferImportResult', {
          count: String(namedImportedItems.length),
        });
  updateVibeTransferStatusText(message);
  toastr.success(t('toast.vibeTransferBundleImported'), t('extensionName'));
}

function handleVibeBundleExport(): void {
  const selectedItems = (
    Array.isArray(settings.vibeTransferLibraryItems)
      ? settings.vibeTransferLibraryItems
      : []
  ).filter(item => item.enabled !== false);
  const {bundle, skipped} = exportVibeBundle(selectedItems);

  if (bundle.vibes.length === 0) {
    toastr.warning(
      t('toast.vibeTransferBundleExportEmpty'),
      t('extensionName')
    );
    return;
  }

  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'conso-vibe-bundle.naiv4vibebundle.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  if (skipped.length > 0) {
    toastr.info(
      t('settings.vibeTransferExportSkipped', {
        count: String(bundle.vibes.length),
        skipped: String(skipped.length),
      }),
      t('extensionName')
    );
  }
}

function toggleVibeTransferReference(id: string, enabled: boolean): void {
  const refs = Array.isArray(settings.vibeTransferReferenceImages)
    ? settings.vibeTransferReferenceImages
    : [];
  settings.vibeTransferReferenceImages = refs.map(ref =>
    ref.id === id ? {...ref, enabled} : ref
  );
  settings.vibeTransferLibraryItems = (
    Array.isArray(settings.vibeTransferLibraryItems)
      ? settings.vibeTransferLibraryItems
      : []
  ).map(item =>
    item.id === id || item.legacyReferenceId === id ? {...item, enabled} : item
  );
  saveSettings(settings, context);
  renderVibeTransferReferenceList();
  renderVibeTransferManagerList();
  renderVibeTransferPresetSelect();
  updateVibeTransferStatusText();
}

function renameVibeTransferReference(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const refs = Array.isArray(settings.vibeTransferReferenceImages)
    ? settings.vibeTransferReferenceImages
    : [];
  settings.vibeTransferReferenceImages = refs.map(ref =>
    ref.id === id ? {...ref, name: trimmed} : ref
  );
  settings.vibeTransferLibraryItems = (
    Array.isArray(settings.vibeTransferLibraryItems)
      ? settings.vibeTransferLibraryItems
      : []
  ).map(item =>
    item.id === id || item.legacyReferenceId === id
      ? {...item, name: trimmed, updatedAt: Date.now()}
      : item
  );
  saveSettings(settings, context);
  renderVibeTransferManagerList();
  renderVibeTransferPresetSelect();
}

function addVibeTransferReferenceTags(id: string, inputValue: string): void {
  const newTags = parseVibeReferenceTagInput(inputValue);
  if (newTags.length === 0) return;

  const refs = Array.isArray(settings.vibeTransferReferenceImages)
    ? settings.vibeTransferReferenceImages
    : [];
  settings.vibeTransferReferenceImages = refs.map(ref => {
    if (ref.id !== id) return ref;
    const existingTags = Array.isArray(ref.tags) ? ref.tags : [];
    return {
      ...ref,
      tags: [...new Set([...existingTags, ...newTags])],
    };
  });
  settings.vibeTransferLibraryItems = (
    Array.isArray(settings.vibeTransferLibraryItems)
      ? settings.vibeTransferLibraryItems
      : []
  ).map(item => {
    if (item.id !== id && item.legacyReferenceId !== id) return item;
    const existingTags = Array.isArray(item.tags) ? item.tags : [];
    return {
      ...item,
      tags: [...new Set([...existingTags, ...newTags])],
      updatedAt: Date.now(),
    };
  });
  saveSettings(settings, context);
  renderVibeTransferReferenceList();
  renderVibeTransferManagerList();
}

function removeVibeTransferReferenceTag(id: string, tag: string): void {
  const refs = Array.isArray(settings.vibeTransferReferenceImages)
    ? settings.vibeTransferReferenceImages
    : [];
  settings.vibeTransferReferenceImages = refs.map(ref =>
    ref.id === id
      ? {
          ...ref,
          tags: (Array.isArray(ref.tags) ? ref.tags : []).filter(
            entry => entry !== tag
          ),
        }
      : ref
  );
  settings.vibeTransferLibraryItems = (
    Array.isArray(settings.vibeTransferLibraryItems)
      ? settings.vibeTransferLibraryItems
      : []
  ).map(item =>
    item.id === id || item.legacyReferenceId === id
      ? {
          ...item,
          tags: (Array.isArray(item.tags) ? item.tags : []).filter(
            entry => entry !== tag
          ),
          updatedAt: Date.now(),
        }
      : item
  );
  saveSettings(settings, context);
  renderVibeTransferReferenceList();
  renderVibeTransferManagerList();
}

function updateVibeItemGenerationParameter(
  id: string,
  field: 'strength' | 'information_extracted',
  value: number,
  options: {render?: boolean} = {}
): number {
  const clamped = clampFloatValue(
    value,
    VIBE_TRANSFER.MIN,
    VIBE_TRANSFER.MAX,
    VIBE_TRANSFER.STEP,
    field === 'strength'
      ? VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH
      : VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED
  );
  settings.vibeTransferLibraryItems = (
    Array.isArray(settings.vibeTransferLibraryItems)
      ? settings.vibeTransferLibraryItems
      : []
  ).map(item => {
    if (item.id !== id) return item;
    return {
      ...item,
      generation: {
        ...(item.generation ?? {}),
        ...(field === 'strength'
          ? {inheritGlobalStrength: false, strength: clamped}
          : {
              inheritGlobalInformationExtracted: false,
              information_extracted: clamped,
            }),
      },
      updatedAt: Date.now(),
    };
  });
  saveSettings(settings, context);
  if (options.render !== false) {
    renderVibeTransferManagerList();
  }
  return clamped;
}

function showServerPluginInstallHelpDialog(): void {
  $('#auto_illustrator_server_plugin_install_help_dialog').remove();
  $('.auto-illustrator-server-plugin-install-help-backdrop').remove();

  const backdrop = $('<div>')
    .addClass('auto-illustrator-dialog-backdrop')
    .addClass('auto-illustrator-server-plugin-install-help-backdrop');
  const dialog = $('<div>')
    .attr('id', 'auto_illustrator_server_plugin_install_help_dialog')
    .addClass('auto-illustrator-dialog')
    .addClass('auto-illustrator-server-plugin-install-help-dialog');

  dialog.append($('<h3>').text(t('settings.serverPluginInstallHelpTitle')));
  dialog.append($('<p>').text(t('settings.serverPluginInstallHelpIntro')));

  const steps = $('<ol>').addClass(
    'auto-illustrator-server-plugin-install-steps'
  );
  [
    t('settings.serverPluginInstallHelpStepCopy'),
    t('settings.serverPluginInstallHelpStepConfig'),
    t('settings.serverPluginInstallHelpStepToken'),
    t('settings.serverPluginInstallHelpStepRestart'),
    t('settings.serverPluginInstallHelpStepRefresh'),
  ].forEach(step => {
    steps.append($('<li>').text(step));
  });
  dialog.append(steps);

  const pre = $('<pre>')
    .addClass('auto-illustrator-server-plugin-install-snippet')
    .text(
      [
        t('settings.serverPluginInstallHelpCopyFrom'),
        'server-plugin/auto-illustrator-nai-advanced',
        '',
        t('settings.serverPluginInstallHelpCopyTo'),
        'SillyTavern/plugins/auto-illustrator-nai-advanced',
        '',
        t('settings.serverPluginInstallHelpConfigExample'),
        'enableServerPlugins: true',
      ].join('\n')
    );
  dialog.append(pre);
  dialog.append(
    $('<p>').text(t('settings.serverPluginInstallHelpRestartNote'))
  );

  const buttons = $('<div>').addClass('auto-illustrator-dialog-buttons');
  const closeBtn = $('<button>')
    .text(t('modal.close'))
    .addClass('menu_button')
    .on('click', () => {
      backdrop.remove();
      dialog.remove();
    });
  buttons.append(closeBtn);
  dialog.append(buttons);

  backdrop.on('click', () => {
    backdrop.remove();
    dialog.remove();
  });

  $('body').append(backdrop).append(dialog);
}

function deleteSelectedVibeTransferItems(): void {
  const libraryItems = Array.isArray(settings.vibeTransferLibraryItems)
    ? settings.vibeTransferLibraryItems
    : [];
  const selectedIds = new Set(getSelectedVisibleVibeItemIds());
  const selectedItems = libraryItems.filter(item => selectedIds.has(item.id));
  if (selectedItems.length === 0) {
    toastr.warning(
      t('toast.vibeTransferDeleteSelectedEmpty'),
      t('extensionName')
    );
    return;
  }
  if (
    !confirm(
      t('settings.vibeTransferDeleteSelectedConfirm', {
        count: String(selectedItems.length),
      })
    )
  ) {
    return;
  }

  const legacyReferenceIds = new Set(
    selectedItems
      .map(item => item.legacyReferenceId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  );
  settings.vibeTransferReferenceImages = (
    Array.isArray(settings.vibeTransferReferenceImages)
      ? settings.vibeTransferReferenceImages
      : []
  ).filter(ref => !selectedIds.has(ref.id) && !legacyReferenceIds.has(ref.id));
  settings.vibeTransferLibraryItems = libraryItems.filter(
    item => !selectedIds.has(item.id)
  );
  settings.vibeTransferPresets = (
    Array.isArray(settings.vibeTransferPresets)
      ? settings.vibeTransferPresets
      : []
  )
    .map(preset => ({
      ...preset,
      referenceIds: preset.referenceIds.filter(id => !selectedIds.has(id)),
      updatedAt: Date.now(),
    }))
    .filter(preset => preset.referenceIds.length > 0);
  settings.vibeTransferCombinations = (
    Array.isArray(settings.vibeTransferCombinations)
      ? settings.vibeTransferCombinations
      : []
  )
    .map(combo => ({
      ...combo,
      itemIds: combo.itemIds.filter(id => !selectedIds.has(id)),
      updatedAt: Date.now(),
    }))
    .filter(combo => combo.itemIds.length > 0);
  if (
    !settings.vibeTransferPresets.some(
      preset => preset.id === settings.currentVibeTransferPresetId
    )
  ) {
    settings.currentVibeTransferPresetId = '';
  }
  if (
    !settings.vibeTransferCombinations.some(
      combo => combo.id === settings.currentVibeTransferCombinationId
    )
  ) {
    settings.currentVibeTransferCombinationId = '';
  }
  saveSettings(settings, context);
  updateUI();
}

function getEnabledVibeReferenceIds(): string[] {
  const libraryItems = Array.isArray(settings.vibeTransferLibraryItems)
    ? settings.vibeTransferLibraryItems
    : [];
  if (libraryItems.length > 0) {
    return libraryItems
      .filter(item => item.enabled !== false)
      .map(item => item.id);
  }

  return (
    Array.isArray(settings.vibeTransferReferenceImages)
      ? settings.vibeTransferReferenceImages
      : []
  )
    .filter(ref => ref.enabled !== false)
    .map(ref => ref.id);
}

function getVibePresetCount(preset: VibeTransferPreset): number {
  return Array.isArray(settings.vibeTransferCombinations)
    ? settings.vibeTransferCombinations.find(combo => combo.id === preset.id)
        ?.itemIds.length ?? preset.referenceIds.length
    : preset.referenceIds.length;
}

function setEnabledVibeItemIds(itemIds: string[]): void {
  const enabledIds = new Set(itemIds);
  settings.vibeTransferLibraryItems = (
    Array.isArray(settings.vibeTransferLibraryItems)
      ? settings.vibeTransferLibraryItems
      : []
  ).map(item => ({
    ...item,
    enabled: enabledIds.has(item.id),
  }));
  settings.vibeTransferReferenceImages = (
    Array.isArray(settings.vibeTransferReferenceImages)
      ? settings.vibeTransferReferenceImages
      : []
  ).map(ref => ({
    ...ref,
    enabled: enabledIds.has(ref.id),
  }));
}

function applyVibeCombinationParameters(
  combination?: VibeTransferCombination
): void {
  if (!combination) return;
  const generationById = combination.itemGenerations ?? {};
  const combinationIds = new Set(combination.itemIds);
  settings.vibeTransferLibraryItems = (
    Array.isArray(settings.vibeTransferLibraryItems)
      ? settings.vibeTransferLibraryItems
      : []
  ).map(item => {
    const generation = generationById[item.id];
    if (!generation && !combinationIds.has(item.id)) return item;
    return {
      ...item,
      generation:
        cloneVibeGenerationSettings(generation) ??
        createVibeGenerationSettingsSnapshot(item, {
          strength: combination.referenceStrength,
          informationExtracted: combination.informationExtracted,
        }),
      updatedAt: Date.now(),
    };
  });
}

function renderVibeTransferPresetSelect(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_PRESET_SELECT
  ) as HTMLSelectElement | null;
  if (!select) return;

  const presets = Array.isArray(settings.vibeTransferPresets)
    ? settings.vibeTransferPresets
    : [];
  select.innerHTML = [
    `<option value="">${t('settings.vibeTransferPresetNone')}</option>`,
    `<option value="${VIBE_MANAGER_PENDING_VIEW_ID}">${t(
      'settings.vibeTransferPendingGroup'
    )}</option>`,
    ...presets.map(preset => {
      const id = htmlEncode(preset.id);
      const name = htmlEncode(preset.name);
      const count = getVibePresetCount(preset);
      return `<option value="${id}">${name} (${count})</option>`;
    }),
  ].join('');
  select.value =
    getVibeManagerView() === 'pending'
      ? VIBE_MANAGER_PENDING_VIEW_ID
      : settings.currentVibeTransferPresetId || '';
}

function saveCurrentVibeTransferPreset(): void {
  const input = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_PRESET_NAME
  ) as HTMLInputElement | null;
  const name = input?.value.trim() || '';
  const referenceIds = getEnabledVibeReferenceIds();
  if (!name) {
    toastr.warning(
      t('toast.vibeTransferPresetNameRequired'),
      t('extensionName')
    );
    return;
  }
  if (referenceIds.length === 0) {
    toastr.warning(t('toast.vibeTransferPresetEmpty'), t('extensionName'));
    return;
  }

  const now = Date.now();
  const presets = Array.isArray(settings.vibeTransferPresets)
    ? settings.vibeTransferPresets
    : [];
  const preset: VibeTransferPreset = {
    id: createVibePresetId(name),
    name,
    referenceIds,
    createdAt: now,
    updatedAt: now,
  };
  settings.vibeTransferPresets = [preset, ...presets].slice(
    0,
    VIBE_TRANSFER.MAX_PRESETS
  );
  settings.vibeTransferCombinations = [
    createVibeCombinationSnapshot(
      preset.id,
      preset.name,
      referenceIds,
      now,
      now,
      preset.id
    ),
    ...(Array.isArray(settings.vibeTransferCombinations)
      ? settings.vibeTransferCombinations
      : []),
  ].slice(0, VIBE_TRANSFER.MAX_PRESETS);
  settings.currentVibeTransferPresetId = preset.id;
  settings.currentVibeTransferCombinationId = preset.id;
  settings.vibeTransferManagerView = 'all';
  if (input) input.value = '';
  saveSettings(settings, context);
  updateUI();
}

function overwriteSelectedVibeTransferPreset(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_PRESET_SELECT
  ) as HTMLSelectElement | null;
  const presetId = select?.value || '';
  const referenceIds = getEnabledVibeReferenceIds();
  const presets = Array.isArray(settings.vibeTransferPresets)
    ? settings.vibeTransferPresets
    : [];
  const existing = presets.find(preset => preset.id === presetId);
  if (!existing) {
    toastr.warning(
      t('toast.vibeTransferPresetOverwriteSelect'),
      t('extensionName')
    );
    return;
  }
  if (referenceIds.length === 0) {
    toastr.warning(t('toast.vibeTransferPresetEmpty'), t('extensionName'));
    return;
  }
  if (!confirm(t('prompt.overwritePreset', {name: existing.name}))) {
    return;
  }

  const now = Date.now();
  settings.vibeTransferPresets = presets.map(preset =>
    preset.id === existing.id
      ? {...preset, referenceIds, updatedAt: now}
      : preset
  );
  settings.vibeTransferCombinations = (
    Array.isArray(settings.vibeTransferCombinations)
      ? settings.vibeTransferCombinations
      : []
  ).map(combo =>
    combo.id === existing.id
      ? createVibeCombinationSnapshot(
          combo.id,
          combo.name,
          referenceIds,
          now,
          combo.createdAt,
          combo.legacyPresetId
        )
      : combo
  );
  settings.currentVibeTransferPresetId = existing.id;
  settings.currentVibeTransferCombinationId = existing.id;
  settings.vibeTransferManagerView = 'all';
  saveSettings(settings, context);
  updateUI();
}

function applyVibeTransferPresetById(presetId: string): boolean {
  if (presetId === VIBE_MANAGER_PENDING_VIEW_ID) {
    settings.currentVibeTransferPresetId = '';
    settings.currentVibeTransferCombinationId = '';
    settings.vibeTransferManagerView = 'pending';
    setEnabledVibeItemIds([]);
    saveSettings(settings, context);
    updateUI();
    return true;
  }

  const preset = (
    Array.isArray(settings.vibeTransferPresets)
      ? settings.vibeTransferPresets
      : []
  ).find(entry => entry.id === presetId);
  if (!preset) return false;

  const combination = (
    Array.isArray(settings.vibeTransferCombinations)
      ? settings.vibeTransferCombinations
      : []
  ).find(entry => entry.id === presetId);
  setEnabledVibeItemIds(combination?.itemIds ?? preset.referenceIds);
  applyVibeCombinationParameters(combination);
  settings.currentVibeTransferPresetId = preset.id;
  settings.currentVibeTransferCombinationId = preset.id;
  settings.vibeTransferManagerView = 'all';
  saveSettings(settings, context);
  updateUI();
  return true;
}

function clearAppliedVibeTransferPreset(): void {
  settings.currentVibeTransferPresetId = '';
  settings.currentVibeTransferCombinationId = '';
  settings.vibeTransferManagerView = 'all';
  setEnabledVibeItemIds([]);
  saveSettings(settings, context);
  updateUI();
}

function applySelectedVibeTransferPreset(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_PRESET_SELECT
  ) as HTMLSelectElement | null;
  if (!select) return;
  const presetId = select.value || '';
  if (presetId === VIBE_MANAGER_PENDING_VIEW_ID) {
    applyVibeTransferPresetById(presetId);
    return;
  }
  if (!presetId) {
    clearAppliedVibeTransferPreset();
    return;
  }
  applyVibeTransferPresetById(presetId);
}

function deleteSelectedVibeTransferPreset(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_PRESET_SELECT
  ) as HTMLSelectElement | null;
  const presetId = select?.value || '';
  if (!presetId) return;
  settings.vibeTransferPresets = (
    Array.isArray(settings.vibeTransferPresets)
      ? settings.vibeTransferPresets
      : []
  ).filter(preset => preset.id !== presetId);
  settings.vibeTransferCombinations = (
    Array.isArray(settings.vibeTransferCombinations)
      ? settings.vibeTransferCombinations
      : []
  ).filter(combo => combo.id !== presetId);
  if (settings.currentVibeTransferPresetId === presetId) {
    settings.currentVibeTransferPresetId = '';
  }
  if (settings.currentVibeTransferCombinationId === presetId) {
    settings.currentVibeTransferCombinationId = '';
  }
  saveSettings(settings, context);
  updateUI();
}

function updateUI(): void {
  const enabledCheckbox = document.getElementById(
    UI_ELEMENT_IDS.ENABLED
  ) as HTMLInputElement;
  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;
  const presetSelect = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_PRESET_SELECT
  ) as HTMLSelectElement;
  const presetDeleteButton = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_PRESET_DELETE
  ) as HTMLButtonElement;
  const presetEditor = document.getElementById(
    UI_ELEMENT_IDS.PRESET_EDITOR
  ) as HTMLDivElement;
  const presetViewer = document.getElementById(
    UI_ELEMENT_IDS.PRESET_VIEWER
  ) as HTMLDivElement;
  const presetPreview = document.getElementById(
    UI_ELEMENT_IDS.PRESET_PREVIEW
  ) as HTMLPreElement;
  const streamingPollIntervalInput = document.getElementById(
    UI_ELEMENT_IDS.STREAMING_POLL_INTERVAL
  ) as HTMLInputElement;
  const maxConcurrentInput = document.getElementById(
    UI_ELEMENT_IDS.MAX_CONCURRENT
  ) as HTMLInputElement;
  const minGenerationIntervalInput = document.getElementById(
    UI_ELEMENT_IDS.MIN_GENERATION_INTERVAL
  ) as HTMLInputElement;
  const logLevelSelect = document.getElementById(
    UI_ELEMENT_IDS.LOG_LEVEL
  ) as HTMLSelectElement;
  const promptPatternsTextarea = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_PATTERNS
  ) as HTMLTextAreaElement;
  const commonStyleTagsTextarea = document.getElementById(
    UI_ELEMENT_IDS.COMMON_STYLE_TAGS
  ) as HTMLTextAreaElement;
  const commonStyleTagsPositionSelect = document.getElementById(
    UI_ELEMENT_IDS.COMMON_STYLE_TAGS_POSITION
  ) as HTMLSelectElement;
  const characterTagInjectionModeSelect = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_TAG_INJECTION_MODE
  ) as HTMLSelectElement;
  const manualGenModeSelect = document.getElementById(
    UI_ELEMENT_IDS.MANUAL_GEN_MODE
  ) as HTMLSelectElement;
  const showGalleryWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_GALLERY_WIDGET
  ) as HTMLInputElement;
  const showProgressWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_PROGRESS_WIDGET
  ) as HTMLInputElement;
  const showStreamingPreviewWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_STREAMING_PREVIEW_WIDGET
  ) as HTMLInputElement;
  const showFloatingPanelLauncherCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_FLOATING_PANEL_LAUNCHER
  ) as HTMLInputElement;
  const promptGenModeRegexRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_SHARED
  ) as HTMLInputElement;
  const promptGenModeLLMRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_INDEPENDENT
  ) as HTMLInputElement;
  const maxPromptsPerMessageInput = document.getElementById(
    UI_ELEMENT_IDS.MAX_PROMPTS_PER_MESSAGE
  ) as HTMLInputElement;
  const contextMessageCountInput = document.getElementById(
    UI_ELEMENT_IDS.CONTEXT_MESSAGE_COUNT
  ) as HTMLInputElement;
  const metaPromptDepthInput = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_DEPTH
  ) as HTMLInputElement;
  const standalonePromptCountInput = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_PROMPT_COUNT
  ) as HTMLInputElement;
  // Update image retention days
  const imageRetentionDaysInput = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_RETENTION_DAYS
  ) as HTMLInputElement;
  if (imageRetentionDaysInput) {
    imageRetentionDaysInput.value = (
      settings.imageRetentionDays ?? 1
    ).toString();
  }

  // Update basic settings
  if (enabledCheckbox) enabledCheckbox.checked = settings.enabled;
  if (streamingPollIntervalInput)
    streamingPollIntervalInput.value =
      settings.streamingPollInterval.toString();
  if (maxConcurrentInput)
    maxConcurrentInput.value = settings.maxConcurrentGenerations.toString();
  if (minGenerationIntervalInput)
    minGenerationIntervalInput.value =
      settings.minGenerationInterval.toString();
  if (logLevelSelect) logLevelSelect.value = settings.logLevel;
  if (promptPatternsTextarea)
    promptPatternsTextarea.value = settings.promptDetectionPatterns.join('\n');
  if (commonStyleTagsTextarea)
    commonStyleTagsTextarea.value = settings.commonStyleTags;
  if (commonStyleTagsPositionSelect)
    commonStyleTagsPositionSelect.value = settings.commonStyleTagsPosition;
  if (characterTagInjectionModeSelect) {
    characterTagInjectionModeSelect.value =
      settings.characterFixedTagInjectionMode || 'legacy';
  }
  if (manualGenModeSelect)
    manualGenModeSelect.value = settings.manualGenerationMode;
  if (showGalleryWidgetCheckbox)
    showGalleryWidgetCheckbox.checked = settings.showGalleryWidget;
  if (showProgressWidgetCheckbox)
    showProgressWidgetCheckbox.checked = settings.showProgressWidget;
  if (showStreamingPreviewWidgetCheckbox)
    showStreamingPreviewWidgetCheckbox.checked =
      settings.showStreamingPreviewWidget;
  if (showFloatingPanelLauncherCheckbox)
    showFloatingPanelLauncherCheckbox.checked =
      settings.showFloatingPanelLauncher;

  // Update image display width
  const imageDisplayWidthInput = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_DISPLAY_WIDTH
  ) as HTMLInputElement;
  const imageDisplayWidthValue = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_DISPLAY_WIDTH_VALUE
  ) as HTMLSpanElement;
  if (imageDisplayWidthInput) {
    imageDisplayWidthInput.value = settings.imageDisplayWidth.toString();
  }
  if (imageDisplayWidthValue) {
    imageDisplayWidthValue.textContent = `${settings.imageDisplayWidth}%`;
  }

  // Update prompt generation mode radio buttons
  if (promptGenModeRegexRadio && promptGenModeLLMRadio) {
    // Support both new names and legacy aliases
    const isIndependent =
      settings.promptGenerationMode === 'independent-api' ||
      settings.promptGenerationMode === 'llm-post';
    if (isIndependent) {
      promptGenModeLLMRadio.checked = true;
      promptGenModeRegexRadio.checked = false;
    } else {
      // Default to shared-api mode for any other value (including 'shared-api', 'regex', and invalid values)
      promptGenModeRegexRadio.checked = true;
      promptGenModeLLMRadio.checked = false;
    }
  }

  // Toggle independent API settings visibility based on current mode
  toggleIndependentApiSettingsVisibility();

  // Update max prompts per message
  if (maxPromptsPerMessageInput) {
    maxPromptsPerMessageInput.value = settings.maxPromptsPerMessage.toString();
  }

  // Update context message count
  if (contextMessageCountInput) {
    contextMessageCountInput.value = settings.contextMessageCount.toString();
  }

  // Update meta prompt depth
  if (metaPromptDepthInput) {
    metaPromptDepthInput.value = settings.metaPromptDepth.toString();
  }
  if (standalonePromptCountInput) {
    standalonePromptCountInput.value = (
      settings.standalonePromptCount ?? STANDALONE_PROMPT_COUNT.DEFAULT
    ).toString();
  }

  // Update LLM guidelines textareas
  const llmFrequencyGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const llmPromptWritingGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;

  if (llmFrequencyGuidelinesTextarea) {
    llmFrequencyGuidelinesTextarea.value = settings.llmFrequencyGuidelines;
  }

  if (llmPromptWritingGuidelinesTextarea) {
    llmPromptWritingGuidelinesTextarea.value =
      settings.llmPromptWritingGuidelines;
  }

  // Update independent LLM API settings
  const useIndependentLlmApiCheckbox = document.getElementById(
    UI_ELEMENT_IDS.USE_INDEPENDENT_LLM_API
  ) as HTMLInputElement;
  const independentLlmApiUrlInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
  ) as HTMLInputElement;
  const independentLlmApiKeyInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
  ) as HTMLInputElement;
  const independentLlmModelInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
  ) as HTMLInputElement;
  const independentLlmModelSelect = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL_SELECT
  ) as HTMLSelectElement;

  if (useIndependentLlmApiCheckbox) {
    useIndependentLlmApiCheckbox.checked =
      settings.useIndependentLlmApi ?? false;
  }
  if (independentLlmApiUrlInput) {
    independentLlmApiUrlInput.value = settings.independentLlmApiUrl ?? '';
  }
  if (independentLlmApiKeyInput) {
    independentLlmApiKeyInput.value = settings.independentLlmApiKey ?? '';
  }
  if (independentLlmModelInput) {
    independentLlmModelInput.value = settings.independentLlmModel ?? '';
  }
  if (independentLlmModelSelect) {
    // If there's a saved model, show it as the selected option
    const savedModel = settings.independentLlmModel ?? '';
    if (savedModel && independentLlmModelSelect.options.length <= 1) {
      const opt = document.createElement('option');
      opt.value = savedModel;
      opt.textContent = `${savedModel} (saved)`;
      independentLlmModelSelect.appendChild(opt);
    }
    independentLlmModelSelect.value = savedModel;
  }

  const independentLlmMaxTokensInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MAX_TOKENS
  ) as HTMLInputElement;
  if (independentLlmMaxTokensInput) {
    independentLlmMaxTokensInput.value = String(
      settings.independentLlmMaxTokens ?? 4096
    );
  }

  // Update context injection checkboxes
  const injectCharDescCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_CHARACTER_DESCRIPTION
  ) as HTMLInputElement;
  const injectUserPersonaCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_USER_PERSONA
  ) as HTMLInputElement;
  const injectScenarioCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_SCENARIO
  ) as HTMLInputElement;
  if (injectCharDescCheckbox) {
    injectCharDescCheckbox.checked =
      settings.injectCharacterDescription ?? true;
  }
  if (injectUserPersonaCheckbox) {
    injectUserPersonaCheckbox.checked = settings.injectUserPersona ?? true;
  }
  if (injectScenarioCheckbox) {
    injectScenarioCheckbox.checked = settings.injectScenario ?? true;
  }

  // Update world info injection checkbox
  const injectWorldInfoCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_WORLD_INFO
  ) as HTMLInputElement;
  if (injectWorldInfoCheckbox) {
    injectWorldInfoCheckbox.checked = settings.injectWorldInfo ?? false;
  }
  toggleWorldInfoPanelVisibility(settings.injectWorldInfo ?? false);

  // Update content filter tags
  const contentFilterTagsTextarea = document.getElementById(
    UI_ELEMENT_IDS.CONTENT_FILTER_TAGS
  ) as HTMLTextAreaElement;
  if (contentFilterTagsTextarea) {
    contentFilterTagsTextarea.value = (
      settings.contentFilterTags ?? DEFAULT_CONTENT_FILTER_TAGS
    ).join('\n');
  }

  // Update image subfolder label from chat metadata
  const imageSubfolderLabelInput = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_SUBFOLDER_LABEL
  ) as HTMLInputElement;
  if (imageSubfolderLabelInput) {
    try {
      const metadata = getMetadata();
      imageSubfolderLabelInput.value = metadata.imageSubfolderLabel ?? '';
      setImageSubfolderLabel(metadata.imageSubfolderLabel ?? null);
    } catch {
      // Metadata not ready (no chat loaded yet)
      imageSubfolderLabelInput.value = '';
      setImageSubfolderLabel(null);
    }
  }

  // Update preset dropdown with custom presets
  if (presetSelect) {
    const customPresetsGroup = presetSelect.querySelector(
      '#custom_presets_group'
    );
    if (customPresetsGroup) {
      customPresetsGroup.innerHTML = '';
      settings.customPresets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        customPresetsGroup.appendChild(option);
      });
    }
    presetSelect.value = settings.currentPresetId;
  }

  // Update delete button state based on preset type
  if (presetDeleteButton) {
    const isPredefined = isPresetPredefined(settings.currentPresetId);
    presetDeleteButton.disabled = isPredefined;
    presetDeleteButton.title = isPredefined
      ? 'Cannot delete predefined presets'
      : 'Delete custom preset';
  }

  // Update preview area with current preset content
  if (presetPreview) {
    presetPreview.textContent = settings.metaPrompt;
  }

  // Update textarea (used in edit mode)
  if (metaPromptTextarea) {
    metaPromptTextarea.value = settings.metaPrompt;
  }

  // Ensure editor is hidden and viewer is shown (not in edit mode)
  if (presetEditor) presetEditor.style.display = 'none';
  if (presetViewer) presetViewer.style.display = 'block';
  isEditingPreset = false;

  // Update independent LLM preset dropdown
  const ilmPresetSelect = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SELECT
  ) as HTMLSelectElement;
  const ilmPresetDeleteButton = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_DELETE
  ) as HTMLButtonElement;
  const ilmPresetEditor = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_EDITOR
  ) as HTMLDivElement;

  if (ilmPresetSelect) {
    const customGroup = ilmPresetSelect.querySelector(
      '#custom_independent_llm_presets_group'
    );
    if (customGroup) {
      customGroup.innerHTML = '';
      (settings.customIndependentLlmPresets || []).forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        customGroup.appendChild(option);
      });
    }
    ilmPresetSelect.value = settings.currentIndependentLlmPresetId;
  }

  if (ilmPresetDeleteButton) {
    const isPredefined = isIndependentLlmPresetPredefined(
      settings.currentIndependentLlmPresetId
    );
    ilmPresetDeleteButton.disabled = isPredefined;
    ilmPresetDeleteButton.title = isPredefined
      ? t('toast.cannotDeletePredefinedIndependentLlm')
      : t('settings.deletePreset');
  }

  if (ilmPresetEditor) ilmPresetEditor.style.display = 'none';
  isEditingIndependentLlmPreset = false;

  // Update API profile dropdown
  populateApiProfileDropdown();

  // Update random SD style controls
  const generationStyleModeSelect = document.getElementById(
    UI_ELEMENT_IDS.GENERATION_STYLE_MODE
  ) as HTMLSelectElement | null;
  if (generationStyleModeSelect) {
    generationStyleModeSelect.value = settings.generationStyleMode ?? 'off';
  }
  renderGenerationStylePresetSelect();
  renderFixedSdStyleSelect();
  renderFixedVibeCombinationSelect();
  updateGenerationStyleModeVisibility();

  const randomizeSdStyleCheckbox = document.getElementById(
    UI_ELEMENT_IDS.RANDOMIZE_SD_STYLE
  ) as HTMLInputElement | null;
  if (randomizeSdStyleCheckbox) {
    randomizeSdStyleCheckbox.checked = !!settings.randomizeSdStylePerGeneration;
  }
  const restoreSdStyleAfterCheckbox = document.getElementById(
    UI_ELEMENT_IDS.RESTORE_SD_STYLE_AFTER
  ) as HTMLInputElement | null;
  if (restoreSdStyleAfterCheckbox) {
    restoreSdStyleAfterCheckbox.checked =
      settings.restoreSdStyleAfter !== false;
  }
  renderSdStylePoolList();

  const randomizeVibeCombinationCheckbox = document.getElementById(
    UI_ELEMENT_IDS.RANDOMIZE_VIBE_COMBINATION
  ) as HTMLInputElement | null;
  if (randomizeVibeCombinationCheckbox) {
    randomizeVibeCombinationCheckbox.checked =
      !!settings.randomizeVibeCombinationPerGeneration;
  }
  renderVibeCombinationPoolList();

  // Update Vibe Transfer controls
  const vibeTransferEnabledCheckbox = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_ENABLED
  ) as HTMLInputElement | null;
  if (vibeTransferEnabledCheckbox) {
    vibeTransferEnabledCheckbox.checked = !!settings.vibeTransferEnabled;
  }

  const vibeManagerEditButton = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_MANAGER_EDIT_MODE
  ) as HTMLButtonElement | null;
  if (vibeManagerEditButton) {
    vibeManagerEditButton.innerHTML = settings.vibeTransferManagerEditMode
      ? `<i class="fa-solid fa-eye"></i> ${t('settings.vibeTransferDisplayMode')}`
      : `<i class="fa-solid fa-pen-to-square"></i> ${t('settings.vibeTransferEditMode')}`;
    vibeManagerEditButton.setAttribute(
      'aria-pressed',
      String(!!settings.vibeTransferManagerEditMode)
    );
  }
  renderVibeTransferReferenceList();
  renderVibeTransferManagerList();
  renderVibeTransferPresetSelect();
  updateVibeTransferStatusText();

  // Update validation status
  updateValidationStatus();
}

/**
 * Validates whether the current prompt detection patterns can find prompts in the meta prompt
 * @returns True if patterns can detect prompts, false otherwise
 */
function validatePromptPatterns(): boolean {
  const metaPrompt = settings.metaPrompt;
  const patterns = settings.promptDetectionPatterns;

  if (!metaPrompt || !patterns || patterns.length === 0) {
    return false;
  }

  try {
    const matches = extractImagePromptsMultiPattern(metaPrompt, patterns);
    return matches.length > 0;
  } catch (error) {
    logger.warn('Error validating prompt patterns:', error);
    return false;
  }
}

/**
 * Updates the validation status UI element
 */
function updateValidationStatus(): void {
  const validationElement = document.getElementById(
    UI_ELEMENT_IDS.PATTERN_VALIDATION_STATUS
  );
  if (!validationElement) return;

  const isValid = validatePromptPatterns();

  // Clear existing classes
  validationElement.className = 'pattern-validation-status';

  if (isValid) {
    validationElement.classList.add('validation-success');
    validationElement.innerHTML = `
      <span class="validation-message">${t('settings.validationSuccess')}</span>
    `;
  } else {
    validationElement.classList.add('validation-warning');
    validationElement.innerHTML = `
      <span class="validation-message">${t('settings.validationWarning')}</span>
      <span class="validation-hint">${t('settings.validationHint')}</span>
    `;
  }
}

/**
 * Clamps a value to the specified range and rounds to nearest step
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @param step - Step size for rounding
 * @returns Clamped and rounded value
 */
function clampValue(
  value: number,
  min: number,
  max: number,
  step: number
): number {
  // Round to nearest step
  const rounded = Math.round(value / step) * step;
  // Clamp to min/max
  return Math.max(min, Math.min(max, rounded));
}

/**
 * Applies the current image display width setting to all AI-generated images in chat
 * This allows retroactive width changes to already-generated images by updating the message HTML
 */
export function applyImageWidthToAllImages(): void {
  let updatedCount = 0;

  // Update the HTML in each message that contains auto-illustrator images
  context.chat?.forEach((message, messageId) => {
    if (!message.mes || !message.mes.includes('auto-illustrator-img')) {
      return;
    }

    const imagesInThisMessage = (
      message.mes.match(/class="[^"]*auto-illustrator-img[^"]*"/g) || []
    ).length;

    // Update all img tags with auto-illustrator-img class in this message
    const updatedMes = message.mes.replace(
      /<img\s+([^>]*class="[^"]*auto-illustrator-img[^"]*"[^>]*)>/g,
      (_match: string, attributes: string) => {
        // Skip failed placeholders - they should stay at 10% width
        if (attributes.includes('data-failed-placeholder="true"')) {
          return `<img ${attributes}>`;
        }

        updatedCount++;
        // Replace only the width value, keeping everything else untouched
        const updatedAttributes = attributes.replace(
          /style="([^"]*)"/,
          (_styleMatch: string, styleContent: string) => {
            // Update or add width in the style
            let newStyle = styleContent;
            if (newStyle.includes('width:')) {
              // Replace existing width
              newStyle = newStyle.replace(
                /width:\s*[^;]+;?/,
                `width: ${settings.imageDisplayWidth}%;`
              );
            } else {
              // Add width at the beginning
              newStyle = `width: ${settings.imageDisplayWidth}%; ${newStyle}`;
            }
            return `style="${newStyle}"`;
          }
        );
        return `<img ${updatedAttributes}>`;
      }
    );

    if (updatedMes !== message.mes) {
      message.mes = updatedMes;
      logger.debug(
        `[DEBUG] Updated HTML for message ${messageId} with ${imagesInThisMessage} images`
      );
    }
  });

  logger.info(
    `[DEBUG] Applied width ${settings.imageDisplayWidth}% to ${updatedCount} images in message HTML`
  );

  if (updatedCount === 0) {
    logger.warn('[DEBUG] No images found to apply width to');
  }
}

/**
 * Handles changes to settings from UI
 */
function handleSettingsChange(): void {
  const previousMetaPrompt = settings.metaPrompt;
  const previousPromptPatterns = settings.promptDetectionPatterns.join('\n');
  const enabledCheckbox = document.getElementById(
    UI_ELEMENT_IDS.ENABLED
  ) as HTMLInputElement;
  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;
  const streamingPollIntervalInput = document.getElementById(
    UI_ELEMENT_IDS.STREAMING_POLL_INTERVAL
  ) as HTMLInputElement;
  const maxConcurrentInput = document.getElementById(
    UI_ELEMENT_IDS.MAX_CONCURRENT
  ) as HTMLInputElement;
  const minGenerationIntervalInput = document.getElementById(
    UI_ELEMENT_IDS.MIN_GENERATION_INTERVAL
  ) as HTMLInputElement;
  const logLevelSelect = document.getElementById(
    UI_ELEMENT_IDS.LOG_LEVEL
  ) as HTMLSelectElement;
  const promptPatternsTextarea = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_PATTERNS
  ) as HTMLTextAreaElement;
  const commonStyleTagsTextarea = document.getElementById(
    UI_ELEMENT_IDS.COMMON_STYLE_TAGS
  ) as HTMLTextAreaElement;
  const commonStyleTagsPositionSelect = document.getElementById(
    UI_ELEMENT_IDS.COMMON_STYLE_TAGS_POSITION
  ) as HTMLSelectElement;
  const characterTagInjectionModeSelect = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_TAG_INJECTION_MODE
  ) as HTMLSelectElement;
  const manualGenModeSelect = document.getElementById(
    UI_ELEMENT_IDS.MANUAL_GEN_MODE
  ) as HTMLSelectElement;
  const showGalleryWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_GALLERY_WIDGET
  ) as HTMLInputElement;
  const showProgressWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_PROGRESS_WIDGET
  ) as HTMLInputElement;
  const showStreamingPreviewWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_STREAMING_PREVIEW_WIDGET
  ) as HTMLInputElement;
  const showFloatingPanelLauncherCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_FLOATING_PANEL_LAUNCHER
  ) as HTMLInputElement;
  const promptGenModeRegexRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_SHARED
  ) as HTMLInputElement;
  const promptGenModeLLMRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_INDEPENDENT
  ) as HTMLInputElement;
  const maxPromptsPerMessageInput = document.getElementById(
    UI_ELEMENT_IDS.MAX_PROMPTS_PER_MESSAGE
  ) as HTMLInputElement;
  const contextMessageCountInput = document.getElementById(
    UI_ELEMENT_IDS.CONTEXT_MESSAGE_COUNT
  ) as HTMLInputElement;
  const metaPromptDepthInput = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_DEPTH
  ) as HTMLInputElement;
  const standalonePromptCountInput = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_PROMPT_COUNT
  ) as HTMLInputElement;
  const llmFrequencyGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const llmPromptWritingGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;
  const imageDisplayWidthInput = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_DISPLAY_WIDTH
  ) as HTMLInputElement;
  const imageDisplayWidthValue = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_DISPLAY_WIDTH_VALUE
  ) as HTMLSpanElement;
  // Image retention days
  const imageRetentionDaysInput = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_RETENTION_DAYS
  ) as HTMLInputElement;
  if (imageRetentionDaysInput) {
    const originalValue = parseInt(imageRetentionDaysInput.value, 10);
    const clampedValue = clampValue(
      originalValue,
      IMAGE_RETENTION_DAYS.MIN,
      IMAGE_RETENTION_DAYS.MAX,
      IMAGE_RETENTION_DAYS.STEP
    );
    settings.imageRetentionDays = clampedValue;
    imageRetentionDaysInput.value = clampedValue.toString();

    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: IMAGE_RETENTION_DAYS.MIN,
          max: IMAGE_RETENTION_DAYS.MAX,
        }),
        t('extensionName')
      );
    }
  }

  // Independent LLM API settings
  const useIndependentLlmApiCheckbox = document.getElementById(
    UI_ELEMENT_IDS.USE_INDEPENDENT_LLM_API
  ) as HTMLInputElement;
  const independentLlmApiUrlInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
  ) as HTMLInputElement;
  const independentLlmApiKeyInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
  ) as HTMLInputElement;
  const independentLlmModelInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
  ) as HTMLInputElement;

  settings.useIndependentLlmApi =
    useIndependentLlmApiCheckbox?.checked ?? settings.useIndependentLlmApi;
  settings.independentLlmApiUrl =
    independentLlmApiUrlInput?.value ?? settings.independentLlmApiUrl;
  settings.independentLlmApiKey =
    independentLlmApiKeyInput?.value ?? settings.independentLlmApiKey;
  settings.independentLlmModel =
    independentLlmModelInput?.value ?? settings.independentLlmModel;

  const independentLlmMaxTokensInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MAX_TOKENS
  ) as HTMLInputElement;
  if (independentLlmMaxTokensInput) {
    const originalValue = parseInt(independentLlmMaxTokensInput.value, 10);
    const clampedValue = clampValue(
      originalValue,
      INDEPENDENT_LLM_MAX_TOKENS.MIN,
      INDEPENDENT_LLM_MAX_TOKENS.MAX,
      INDEPENDENT_LLM_MAX_TOKENS.STEP
    );
    settings.independentLlmMaxTokens = clampedValue;
    independentLlmMaxTokensInput.value = clampedValue.toString();

    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: INDEPENDENT_LLM_MAX_TOKENS.MIN,
          max: INDEPENDENT_LLM_MAX_TOKENS.MAX,
        }),
        t('extensionName')
      );
    }
  }

  // Context injection checkboxes
  const injectCharDescCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_CHARACTER_DESCRIPTION
  ) as HTMLInputElement;
  const injectUserPersonaCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_USER_PERSONA
  ) as HTMLInputElement;
  const injectScenarioCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_SCENARIO
  ) as HTMLInputElement;
  settings.injectCharacterDescription =
    injectCharDescCheckbox?.checked ?? settings.injectCharacterDescription;
  settings.injectUserPersona =
    injectUserPersonaCheckbox?.checked ?? settings.injectUserPersona;
  settings.injectScenario =
    injectScenarioCheckbox?.checked ?? settings.injectScenario;

  // World info injection
  const injectWorldInfoCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_WORLD_INFO
  ) as HTMLInputElement;
  settings.injectWorldInfo =
    injectWorldInfoCheckbox?.checked ?? settings.injectWorldInfo;
  toggleWorldInfoPanelVisibility(settings.injectWorldInfo);

  // Content filter tags
  const contentFilterTagsTextarea = document.getElementById(
    UI_ELEMENT_IDS.CONTENT_FILTER_TAGS
  ) as HTMLTextAreaElement;
  if (contentFilterTagsTextarea) {
    settings.contentFilterTags = contentFilterTagsTextarea.value
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }

  // Track if enabled state or widget visibility changed (requires page reload)
  const wasEnabled = settings.enabled;
  const wasShowGalleryWidget = settings.showGalleryWidget;
  const wasShowProgressWidget = settings.showProgressWidget;
  const wasShowStreamingPreviewWidget = settings.showStreamingPreviewWidget;
  settings.enabled = enabledCheckbox?.checked ?? settings.enabled;
  settings.metaPrompt = metaPromptTextarea?.value ?? settings.metaPrompt;

  // Validate and clamp numeric settings
  if (streamingPollIntervalInput) {
    const originalValue = parseInt(streamingPollIntervalInput.value);
    const clampedValue = clampValue(
      originalValue,
      STREAMING_POLL_INTERVAL.MIN,
      STREAMING_POLL_INTERVAL.MAX,
      STREAMING_POLL_INTERVAL.STEP
    );
    settings.streamingPollInterval = clampedValue;
    // Update UI to show validated value
    streamingPollIntervalInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjusted', {
          original: originalValue,
          clamped: clampedValue,
          min: STREAMING_POLL_INTERVAL.MIN,
          max: STREAMING_POLL_INTERVAL.MAX,
          step: STREAMING_POLL_INTERVAL.STEP,
        }),
        t('extensionName')
      );
    }
  }

  if (maxConcurrentInput) {
    const originalValue = parseInt(maxConcurrentInput.value);
    const clampedValue = clampValue(
      originalValue,
      MAX_CONCURRENT_GENERATIONS.MIN,
      MAX_CONCURRENT_GENERATIONS.MAX,
      MAX_CONCURRENT_GENERATIONS.STEP
    );
    settings.maxConcurrentGenerations = clampedValue;
    // Update UI to show validated value
    maxConcurrentInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: MAX_CONCURRENT_GENERATIONS.MIN,
          max: MAX_CONCURRENT_GENERATIONS.MAX,
        }),
        t('extensionName')
      );
    }
  }

  if (minGenerationIntervalInput) {
    const originalValue = parseInt(minGenerationIntervalInput.value);
    const clampedValue = clampValue(
      originalValue,
      MIN_GENERATION_INTERVAL.MIN,
      MIN_GENERATION_INTERVAL.MAX,
      MIN_GENERATION_INTERVAL.STEP
    );
    settings.minGenerationInterval = clampedValue;
    // Update UI to show validated value
    minGenerationIntervalInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjusted', {
          original: originalValue,
          clamped: clampedValue,
          min: MIN_GENERATION_INTERVAL.MIN,
          max: MIN_GENERATION_INTERVAL.MAX,
          step: MIN_GENERATION_INTERVAL.STEP,
        }),
        t('extensionName')
      );
    }
  }
  settings.logLevel =
    (logLevelSelect?.value as AutoIllustratorSettings['logLevel']) ??
    settings.logLevel;
  settings.promptDetectionPatterns = promptPatternsTextarea
    ? promptPatternsTextarea.value
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0)
    : settings.promptDetectionPatterns;
  settings.commonStyleTags =
    commonStyleTagsTextarea?.value ?? settings.commonStyleTags;
  settings.commonStyleTagsPosition =
    (commonStyleTagsPositionSelect?.value as 'prefix' | 'suffix') ??
    settings.commonStyleTagsPosition;
  settings.characterFixedTagInjectionMode =
    (characterTagInjectionModeSelect?.value as AutoIllustratorSettings['characterFixedTagInjectionMode']) ??
    settings.characterFixedTagInjectionMode;
  settings.manualGenerationMode =
    (manualGenModeSelect?.value as 'replace' | 'append') ??
    settings.manualGenerationMode;

  // Prompt generation mode (radio buttons)
  if (promptGenModeRegexRadio?.checked) {
    settings.promptGenerationMode = 'shared-api';
  } else if (promptGenModeLLMRadio?.checked) {
    settings.promptGenerationMode = 'independent-api';
  } else {
    // Fallback to default if neither is checked (shouldn't happen, but be defensive)
    settings.promptGenerationMode = PROMPT_GENERATION_MODE.DEFAULT;
  }

  // Max prompts per message with validation
  if (maxPromptsPerMessageInput) {
    const originalValue = parseInt(maxPromptsPerMessageInput.value);
    const clampedValue = clampValue(
      originalValue,
      MAX_PROMPTS_PER_MESSAGE.MIN,
      MAX_PROMPTS_PER_MESSAGE.MAX,
      MAX_PROMPTS_PER_MESSAGE.STEP
    );
    settings.maxPromptsPerMessage = clampedValue;
    // Update UI to show validated value
    maxPromptsPerMessageInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: MAX_PROMPTS_PER_MESSAGE.MIN,
          max: MAX_PROMPTS_PER_MESSAGE.MAX,
        }),
        t('extensionName')
      );
    }
  }

  // Context message count with validation
  if (contextMessageCountInput) {
    const originalValue = parseInt(contextMessageCountInput.value);
    const clampedValue = clampValue(
      originalValue,
      CONTEXT_MESSAGE_COUNT.MIN,
      CONTEXT_MESSAGE_COUNT.MAX,
      CONTEXT_MESSAGE_COUNT.STEP
    );
    settings.contextMessageCount = clampedValue;
    // Update UI to show validated value
    contextMessageCountInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: CONTEXT_MESSAGE_COUNT.MIN,
          max: CONTEXT_MESSAGE_COUNT.MAX,
        }),
        t('extensionName')
      );
    }
  }

  // Meta prompt depth with validation
  if (metaPromptDepthInput) {
    const originalValue = parseInt(metaPromptDepthInput.value);
    const clampedValue = clampValue(
      originalValue,
      META_PROMPT_DEPTH.MIN,
      META_PROMPT_DEPTH.MAX,
      META_PROMPT_DEPTH.STEP
    );
    settings.metaPromptDepth = clampedValue;
    logger.debug(`Meta prompt depth updated: ${clampedValue}`);
    // Update UI to show validated value
    metaPromptDepthInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: META_PROMPT_DEPTH.MIN,
          max: META_PROMPT_DEPTH.MAX,
        }),
        t('extensionName')
      );
    }
  }

  if (standalonePromptCountInput) {
    const originalValue = parseInt(standalonePromptCountInput.value);
    const clampedValue = clampValue(
      originalValue,
      STANDALONE_PROMPT_COUNT.MIN,
      STANDALONE_PROMPT_COUNT.MAX,
      STANDALONE_PROMPT_COUNT.STEP
    );
    settings.standalonePromptCount = clampedValue;
    standalonePromptCountInput.value = clampedValue.toString();

    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: STANDALONE_PROMPT_COUNT.MIN,
          max: STANDALONE_PROMPT_COUNT.MAX,
        }),
        t('extensionName')
      );
    }
  }

  // LLM guidelines (textareas)
  settings.llmFrequencyGuidelines =
    llmFrequencyGuidelinesTextarea?.value ?? settings.llmFrequencyGuidelines;
  settings.llmPromptWritingGuidelines =
    llmPromptWritingGuidelinesTextarea?.value ??
    settings.llmPromptWritingGuidelines;

  settings.showGalleryWidget =
    showGalleryWidgetCheckbox?.checked ?? settings.showGalleryWidget;
  settings.showProgressWidget =
    showProgressWidgetCheckbox?.checked ?? settings.showProgressWidget;
  settings.showStreamingPreviewWidget =
    showStreamingPreviewWidgetCheckbox?.checked ??
    settings.showStreamingPreviewWidget;
  settings.showFloatingPanelLauncher =
    showFloatingPanelLauncherCheckbox?.checked ??
    settings.showFloatingPanelLauncher;

  // Image display width with validation
  if (imageDisplayWidthInput) {
    const originalValue = parseInt(imageDisplayWidthInput.value);
    const clampedValue = clampValue(
      originalValue,
      IMAGE_DISPLAY_WIDTH.MIN,
      IMAGE_DISPLAY_WIDTH.MAX,
      IMAGE_DISPLAY_WIDTH.STEP
    );

    // Check if value actually changed from previous setting
    const valueChanged =
      previousImageDisplayWidth === null ||
      clampedValue !== previousImageDisplayWidth;

    settings.imageDisplayWidth = clampedValue;
    // Update UI to show validated value
    imageDisplayWidthInput.value = clampedValue.toString();
    if (imageDisplayWidthValue) {
      imageDisplayWidthValue.textContent = `${clampedValue}%`;
    }

    // Only apply expensive operations if the value actually changed
    if (valueChanged) {
      logger.debug(
        `Image width changed from ${previousImageDisplayWidth ?? 'initial'} to ${clampedValue}`
      );

      // Debounce the expensive operations (HTML update + re-render)
      // Clear any pending update
      if (imageWidthUpdateTimer) {
        clearTimeout(imageWidthUpdateTimer);
      }

      // Schedule the update to run after user stops sliding (1s delay)
      imageWidthUpdateTimer = setTimeout(async () => {
        // Apply width to all existing images (updates HTML)
        logger.debug(
          `[DEBUG] Applying width ${settings.imageDisplayWidth}% to all images`
        );
        applyImageWidthToAllImages();

        // Save chat to persist the updated HTML BEFORE reloading
        // This ensures the reload will load the updated HTML with new width
        if (typeof context.saveChat === 'function') {
          try {
            logger.debug(
              '[DEBUG] Saving chat with updated image width before reload'
            );
            await context.saveChat();
            logger.debug('[DEBUG] Chat saved successfully');
          } catch (error) {
            logger.error(
              'Failed to save chat after image width update:',
              error
            );
            return; // Don't reload if save failed
          }
        }

        // Reload the current chat to apply width changes
        // This triggers the full chat reload flow including CHAT_CHANGED event
        // which properly handles DOM rendering and event listener attachment
        logger.debug('[DEBUG] Reloading current chat to apply width changes');
        context.reloadCurrentChat();

        // Update tracked value after successful application
        previousImageDisplayWidth = settings.imageDisplayWidth;
        imageWidthUpdateTimer = null;
      }, 1000);
    }

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjusted', {
          original: originalValue,
          clamped: clampedValue,
          min: IMAGE_DISPLAY_WIDTH.MIN,
          max: IMAGE_DISPLAY_WIDTH.MAX,
          step: IMAGE_DISPLAY_WIDTH.STEP,
        }),
        t('extensionName')
      );
    }
  }

  // Apply log level
  setLogLevel(settings.logLevel);

  // Random SD style settings
  const randomizeSdStyleCheckbox = document.getElementById(
    UI_ELEMENT_IDS.RANDOMIZE_SD_STYLE
  ) as HTMLInputElement | null;
  const generationStyleModeSelect = document.getElementById(
    UI_ELEMENT_IDS.GENERATION_STYLE_MODE
  ) as HTMLSelectElement | null;
  if (generationStyleModeSelect) {
    const mode = generationStyleModeSelect.value;
    settings.generationStyleMode =
      mode === 'fixed' || mode === 'random' ? mode : 'off';
  }
  const fixedSdStyleSelect = document.getElementById(
    UI_ELEMENT_IDS.FIXED_SD_STYLE_SELECT
  ) as HTMLSelectElement | null;
  if (fixedSdStyleSelect) {
    settings.fixedSdStyleName = fixedSdStyleSelect.value;
  }
  const fixedVibeCombinationSelect = document.getElementById(
    UI_ELEMENT_IDS.FIXED_VIBE_COMBINATION_SELECT
  ) as HTMLSelectElement | null;
  if (fixedVibeCombinationSelect) {
    settings.fixedVibeCombinationId = fixedVibeCombinationSelect.value;
  }
  if (randomizeSdStyleCheckbox) {
    settings.randomizeSdStylePerGeneration = randomizeSdStyleCheckbox.checked;
  }
  const restoreSdStyleAfterCheckbox = document.getElementById(
    UI_ELEMENT_IDS.RESTORE_SD_STYLE_AFTER
  ) as HTMLInputElement | null;
  if (restoreSdStyleAfterCheckbox) {
    settings.restoreSdStyleAfter = restoreSdStyleAfterCheckbox.checked;
  }
  const sdStylePoolList = document.getElementById(
    UI_ELEMENT_IDS.SD_STYLE_POOL_LIST
  );
  if (sdStylePoolList) {
    const checkedNames: string[] = [];
    sdStylePoolList
      .querySelectorAll<HTMLInputElement>(
        'input.auto-illustrator-sd-style-pool-checkbox'
      )
      .forEach(cb => {
        if (cb.checked) {
          const name = cb.dataset.styleName ?? '';
          if (name) checkedNames.push(name);
        }
      });
    settings.sdStylePoolWhitelist = checkedNames;
  }
  const randomizeVibeCombinationCheckbox = document.getElementById(
    UI_ELEMENT_IDS.RANDOMIZE_VIBE_COMBINATION
  ) as HTMLInputElement | null;
  if (randomizeVibeCombinationCheckbox) {
    settings.randomizeVibeCombinationPerGeneration =
      randomizeVibeCombinationCheckbox.checked;
  }
  const vibeCombinationPoolList = document.getElementById(
    UI_ELEMENT_IDS.VIBE_COMBINATION_POOL_LIST
  );
  if (vibeCombinationPoolList) {
    const checkedIds: string[] = [];
    vibeCombinationPoolList
      .querySelectorAll<HTMLInputElement>(
        'input.auto-illustrator-vibe-combination-pool-checkbox'
      )
      .forEach(cb => {
        if (cb.checked) {
          const id = cb.dataset.combinationId ?? '';
          if (id) checkedIds.push(id);
        }
      });
    settings.vibeCombinationPoolWhitelist = checkedIds;
  }

  // Vibe Transfer settings
  const vibeTransferEnabledCheckbox = document.getElementById(
    UI_ELEMENT_IDS.VIBE_TRANSFER_ENABLED
  ) as HTMLInputElement | null;
  if (vibeTransferEnabledCheckbox) {
    settings.vibeTransferEnabled = vibeTransferEnabledCheckbox.checked;
  }

  updateVibeTransferStatusText();

  // Update concurrency limiter settings
  updateMaxConcurrent(settings.maxConcurrentGenerations);
  updateMinInterval(settings.minGenerationInterval);
  setFloatingPanelLauncherVisible(settings.showFloatingPanelLauncher);

  saveSettings(settings, context);

  if (
    previousMetaPrompt !== settings.metaPrompt ||
    previousPromptPatterns !== settings.promptDetectionPatterns.join('\n')
  ) {
    updateValidationStatus();
  }

  // ===== 处理 enabled 开关的立即生效 =====
  if (wasEnabled !== settings.enabled) {
    if (settings.enabled) {
      // ===== 启用扩展 =====
      logger.info('扩展已启用 - 正在注册事件处理器');

      // 注册事件处理器
      if (!eventHandlersRegistered) {
        registerEventHandlers();
      }

      // 初始化必要的组件
      if (settings.showProgressWidget) {
        initializeProgressWidget(progressManager);
        logger.info('已初始化进度 Widget');
      }

      if (settings.showGalleryWidget) {
        initializeGalleryWidget(progressManager);
        const gallery = getGalleryWidget();
        if (gallery) gallery.show();
        logger.info('已初始化图库 Widget');
      }

      if (settings.showStreamingPreviewWidget && !streamingPreviewWidget) {
        streamingPreviewWidget = new StreamingPreviewWidget(
          progressManager,
          settings.promptDetectionPatterns || DEFAULT_PROMPT_DETECTION_PATTERNS
        );
        logger.info('已初始化流式预览 Widget');
      }

      // 使用 toastr 显示成功提示 (去掉 positionClass)
      toastr.success('扩展已启用', t('extensionName'), {
        timeOut: 2000,
      });
    } else {
      // ===== 禁用扩展 =====
      logger.info('扩展已禁用 - 正在注销事件处理器');

      // 注销事件处理器
      unregisterEventHandlers();

      // 清理组件
      clearProgressWidgetState();

      // 清理 streamingPreviewWidget (不调用 hide,直接设为 null)
      if (streamingPreviewWidget) {
        streamingPreviewWidget.destroy();
        streamingPreviewWidget = null;
      }

      const gallery = getGalleryWidget();
      if (gallery) gallery.hide();

      // 使用 toastr 显示提示 (去掉 positionClass)
      toastr.info('扩展已禁用', t('extensionName'), {
        timeOut: 2000,
      });
    }
  }

  // Widget 可见性变化仍需刷新页面
  if (
    wasShowGalleryWidget !== settings.showGalleryWidget ||
    wasShowProgressWidget !== settings.showProgressWidget ||
    wasShowStreamingPreviewWidget !== settings.showStreamingPreviewWidget
  ) {
    toastr.info(t('toast.reloadRequired'), t('extensionName'), {
      timeOut: 5000,
    });

    if (wasShowGalleryWidget !== settings.showGalleryWidget) {
      logger.info(
        `图库 Widget ${settings.showGalleryWidget ? '已启用' : '已禁用'} - 需要重载`
      );
    }
    if (wasShowProgressWidget !== settings.showProgressWidget) {
      logger.info(
        `进度 Widget ${settings.showProgressWidget ? '已启用' : '已禁用'} - 需要重载`
      );
    }
    if (wasShowStreamingPreviewWidget !== settings.showStreamingPreviewWidget) {
      logger.info(
        `流式预览 Widget ${settings.showStreamingPreviewWidget ? '已启用' : '已禁用'} - 需要重载`
      );
    }
  }

  logger.info('设置已更新:', settings);
}

/**
 * Resets settings to defaults
 */
function handleResetSettings(): void {
  if (
    typeof confirm === 'function' &&
    !confirm(t('prompt.resetSettingsConfirm'))
  ) {
    return;
  }

  const previousSettings = settings;
  const defaults = getDefaultSettings();
  settings = {
    ...defaults,
    customPresets: [...(previousSettings.customPresets || [])],
    customIndependentLlmPresets: [
      ...(previousSettings.customIndependentLlmPresets || []),
    ],
    apiProfiles: [...(previousSettings.apiProfiles || [])],
  };
  saveSettings(settings, context);
  updateUI();

  setLogLevel(settings.logLevel);
  updateMaxConcurrent(settings.maxConcurrentGenerations);
  updateMinInterval(settings.minGenerationInterval);
  setFloatingPanelLauncherVisible(settings.showFloatingPanelLauncher);

  if (previousSettings.enabled !== settings.enabled) {
    if (settings.enabled) {
      if (!eventHandlersRegistered) {
        registerEventHandlers();
      }

      if (settings.showProgressWidget) {
        initializeProgressWidget(progressManager);
      }

      if (settings.showGalleryWidget) {
        initializeGalleryWidget(progressManager);
        getGalleryWidget()?.show();
      }

      if (settings.showStreamingPreviewWidget && !streamingPreviewWidget) {
        streamingPreviewWidget = new StreamingPreviewWidget(
          progressManager,
          settings.promptDetectionPatterns || DEFAULT_PROMPT_DETECTION_PATTERNS
        );
      }
    } else {
      unregisterEventHandlers();
      clearProgressWidgetState();
      if (streamingPreviewWidget) {
        streamingPreviewWidget.destroy();
        streamingPreviewWidget = null;
      }
      getGalleryWidget()?.hide();
    }
  }

  if (
    previousSettings.showGalleryWidget !== settings.showGalleryWidget ||
    previousSettings.showProgressWidget !== settings.showProgressWidget ||
    previousSettings.showStreamingPreviewWidget !==
      settings.showStreamingPreviewWidget
  ) {
    toastr.info(t('toast.reloadRequired'), t('extensionName'), {
      timeOut: 5000,
    });
  }

  logger.info('Settings reset to defaults');
}

/**
 * Resets prompt patterns to defaults
 */
function handlePromptPatternsReset(): void {
  const promptPatternsTextarea = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_PATTERNS
  ) as HTMLTextAreaElement;

  if (promptPatternsTextarea) {
    promptPatternsTextarea.value = DEFAULT_PROMPT_DETECTION_PATTERNS.join('\n');
    // Trigger change event to save the settings
    handleSettingsChange();
  }

  logger.info('Prompt patterns reset to defaults');
}

/**
 * Handles LLM frequency guidelines reset to defaults
 */
function handleLLMFrequencyGuidelinesReset(): void {
  const llmFrequencyGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;

  if (llmFrequencyGuidelinesTextarea) {
    llmFrequencyGuidelinesTextarea.value = DEFAULT_LLM_FREQUENCY_GUIDELINES;
    // Trigger change event to save the settings
    handleSettingsChange();
    toastr.success('Frequency guidelines reset to default', t('extensionName'));
  }

  logger.info('LLM frequency guidelines reset to defaults');
}

/**
 * Handles LLM prompt writing guidelines reset to defaults
 */
function handleLLMPromptWritingGuidelinesReset(): void {
  const llmPromptWritingGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;

  if (llmPromptWritingGuidelinesTextarea) {
    llmPromptWritingGuidelinesTextarea.value =
      DEFAULT_LLM_PROMPT_WRITING_GUIDELINES;
    // Trigger change event to save the settings
    handleSettingsChange();
    toastr.success(
      'Prompt writing guidelines reset to default',
      t('extensionName')
    );
  }

  logger.info('LLM prompt writing guidelines reset to defaults');
}

/**
 * Tests the independent LLM API connection
 */
async function handleTestIndependentLlmConnection(): Promise<void> {
  const urlInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
  ) as HTMLInputElement;
  const keyInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
  ) as HTMLInputElement;
  const modelInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
  ) as HTMLInputElement;

  const apiUrl = urlInput?.value?.trim();
  const apiKey = keyInput?.value?.trim();
  const model = modelInput?.value?.trim();

  if (!apiUrl || !model) {
    toastr.error(t('toast.independentLlmApiMissingConfig'), t('extensionName'));
    return;
  }

  try {
    toastr.info(t('toast.testingConnection'), t('extensionName'));

    const {buildChatCompletionsUrl} = await import(
      './services/independent_llm'
    );
    const fullUrl = buildChatCompletionsUrl(apiUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        max_tokens: 10,
      }),
    });

    if (response.ok) {
      toastr.success(t('toast.connectionSuccess'), t('extensionName'));
      logger.info('Independent LLM API connection test successful');
    } else {
      const errorText = await response.text();
      toastr.error(
        t('toast.connectionFailed', {
          error: `${response.status}: ${errorText}`,
        }),
        t('extensionName')
      );
      logger.error('Independent LLM API connection test failed:', errorText);
    }
  } catch (error) {
    toastr.error(
      t('toast.connectionFailed', {error: String(error)}),
      t('extensionName')
    );
    logger.error('Independent LLM API connection test error:', error);
  }
}

/**
 * Shows a read-only modal with the last independent LLM request snapshot.
 */
function handleViewLastRequest(): void {
  const {getLastRequestSnapshot} = require('./services/independent_llm');
  const snapshot = getLastRequestSnapshot();

  if (!snapshot) {
    toastr.info(t('toast.noRequestSnapshot'), t('extensionName'));
    return;
  }

  // Build formatted content
  const timestamp = new Date(snapshot.timestamp).toLocaleString();
  const messagesFormatted = snapshot.messages
    .map(
      (m: {role: string; content: string}) =>
        `--- ${m.role.toUpperCase()} ---\n${m.content}`
    )
    .join('\n\n');

  const content = [
    `URL: ${snapshot.url}`,
    `Model: ${snapshot.model}`,
    `Max Tokens: ${snapshot.maxTokens}`,
    `Temperature: ${snapshot.temperature}`,
    `Authorization: ${snapshot.hasAuthorization ? 'Bearer ****' : '(none)'}`,
    `Time: ${timestamp}`,
    '',
    '=== Messages ===',
    messagesFormatted,
  ].join('\n');

  // Create backdrop
  const backdrop = $('<div>').addClass('auto-illustrator-dialog-backdrop');
  const dialog = $('<div>')
    .attr('id', 'auto_illustrator_last_request_dialog')
    .addClass('auto-illustrator-dialog')
    .css({maxWidth: '700px', maxHeight: '80vh'});

  dialog.append($('<h3>').text(t('dialog.lastRequestTitle')));

  const pre = $('<pre>')
    .css({
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      maxHeight: '60vh',
      overflow: 'auto',
      fontSize: '0.85em',
      background: 'var(--ai-panel-bg-2)',
      color: 'var(--ai-panel-text)',
      padding: '0.75rem',
      borderRadius: '6px',
    })
    .text(content);
  dialog.append(pre);

  const buttons = $('<div>').addClass('auto-illustrator-dialog-buttons');
  const closeBtn = $('<button>')
    .text(t('dialog.cancel'))
    .addClass('menu_button')
    .on('click', () => {
      backdrop.remove();
      dialog.remove();
    });
  buttons.append(closeBtn);
  dialog.append(buttons);

  backdrop.on('click', () => {
    backdrop.remove();
    dialog.remove();
  });

  $('body').append(backdrop).append(dialog);
}

/**
 * Fetches available models from the independent LLM API endpoint
 * and populates the model select dropdown.
 */
async function handleFetchModels(): Promise<void> {
  const urlInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
  ) as HTMLInputElement;
  const keyInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
  ) as HTMLInputElement;
  const modelSelect = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL_SELECT
  ) as HTMLSelectElement;
  const modelInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
  ) as HTMLInputElement;

  const apiUrl = urlInput?.value?.trim();
  if (!apiUrl) {
    toastr.warning(t('toast.fetchModelsNeedUrl'), t('extensionName'));
    return;
  }

  const apiKey = keyInput?.value?.trim();

  try {
    toastr.info(t('toast.fetchingModels'), t('extensionName'));

    const {fetchAvailableModels} = await import('./services/independent_llm');
    const models = await fetchAvailableModels(apiUrl, apiKey || undefined);

    if (!modelSelect) return;

    // Clear existing options
    modelSelect.innerHTML = '';

    if (models.length === 0) {
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = t('toast.fetchModelsEmpty');
      modelSelect.appendChild(emptyOpt);
      toastr.warning(t('toast.fetchModelsEmpty'), t('extensionName'));
      return;
    }

    // Add placeholder
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('settings.independentLlmModelPlaceholder');
    placeholder.disabled = true;
    modelSelect.appendChild(placeholder);

    // Add fetched models
    for (const modelId of models) {
      const opt = document.createElement('option');
      opt.value = modelId;
      opt.textContent = modelId;
      modelSelect.appendChild(opt);
    }

    // If current model input matches one of the fetched models, select it
    const currentModel = modelInput?.value?.trim();
    if (currentModel) {
      const matchingOpt = modelSelect.querySelector(
        `option[value="${CSS.escape(currentModel)}"]`
      );
      if (matchingOpt) {
        modelSelect.value = currentModel;
      } else {
        modelSelect.selectedIndex = 0;
      }
    }

    toastr.success(
      t('toast.fetchModelsSuccess', {count: String(models.length)}),
      t('extensionName')
    );
    logger.info(`Fetched ${models.length} models from API`);
  } catch (error) {
    toastr.error(
      t('toast.fetchModelsFailed', {error: String(error)}),
      t('extensionName')
    );
    logger.error('Failed to fetch models:', error);
  }
}

/**
 * Toggles visibility of LLM-specific settings based on prompt generation mode
 */
function toggleIndependentApiSettingsVisibility(): void {
  const llmSettingsContainer = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_API_SETTINGS_CONTAINER
  );
  const promptGenModeLLMRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_INDEPENDENT
  ) as HTMLInputElement;

  if (llmSettingsContainer && promptGenModeLLMRadio) {
    llmSettingsContainer.style.display = promptGenModeLLMRadio.checked
      ? 'block'
      : 'none';
  }
}

/**
 * Handles preset selection change
 */
function handlePresetChange(): void {
  // Exit edit mode if active
  if (isEditingPreset) {
    handlePresetCancel();
  }

  const presetSelect = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_PRESET_SELECT
  ) as HTMLSelectElement;
  if (!presetSelect) return;

  const selectedId = presetSelect.value;
  const preset = getPresetById(selectedId, settings.customPresets);

  settings.currentPresetId = selectedId;
  settings.metaPrompt = preset.template;
  saveSettings(settings, context);
  updateUI();

  logger.info('Preset changed:', {id: selectedId, name: preset.name});
}

/**
 * Handles entering edit mode for current preset
 */
function handlePresetEdit(): void {
  const presetEditor = document.getElementById(
    UI_ELEMENT_IDS.PRESET_EDITOR
  ) as HTMLDivElement;
  const presetViewer = document.getElementById(
    UI_ELEMENT_IDS.PRESET_VIEWER
  ) as HTMLDivElement;
  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;
  const presetSaveButton = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_PRESET_SAVE
  ) as HTMLButtonElement;

  if (!presetEditor || !presetViewer || !metaPromptTextarea) return;

  // Show editor, hide viewer
  presetViewer.style.display = 'none';
  presetEditor.style.display = 'block';

  // Make textarea editable and populate with current content
  metaPromptTextarea.removeAttribute('readonly');
  metaPromptTextarea.value = settings.metaPrompt;

  // Update save button state (disabled for predefined presets)
  if (presetSaveButton) {
    const isPredefined = isPresetPredefined(settings.currentPresetId);
    presetSaveButton.disabled = isPredefined;
    presetSaveButton.title = isPredefined
      ? 'Cannot save changes to predefined presets (use Save As)'
      : 'Save changes to this preset';
  }

  isEditingPreset = true;
  logger.info('Entered preset edit mode');
}

/**
 * Handles saving changes to current custom preset
 */
function handlePresetSave(): void {
  if (isPresetPredefined(settings.currentPresetId)) {
    toastr.error(t('settings.cannotDeletePredefined'), t('extensionName'));
    return;
  }

  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;
  if (!metaPromptTextarea) return;

  const content = metaPromptTextarea.value;

  // Find and update the custom preset
  const presetIndex = settings.customPresets.findIndex(
    p => p.id === settings.currentPresetId
  );
  if (presetIndex === -1) {
    toastr.error(t('toast.presetNotFound'), t('extensionName'));
    return;
  }

  settings.customPresets[presetIndex].template = content;
  settings.metaPrompt = content;
  saveSettings(settings, context);

  // Exit edit mode
  const presetEditor = document.getElementById(
    UI_ELEMENT_IDS.PRESET_EDITOR
  ) as HTMLDivElement;
  const presetViewer = document.getElementById(
    UI_ELEMENT_IDS.PRESET_VIEWER
  ) as HTMLDivElement;
  if (presetEditor) presetEditor.style.display = 'none';
  if (presetViewer) presetViewer.style.display = 'block';
  isEditingPreset = false;

  updateUI();
  toastr.success(t('toast.presetSaved'), t('extensionName'));
  logger.info('Preset saved:', settings.customPresets[presetIndex].name);
}

/**
 * Handles saving current content as a new preset or overwriting existing
 */
function handlePresetSaveAs(): void {
  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;
  if (!metaPromptTextarea) return;

  const content = metaPromptTextarea.value;
  const name = prompt(t('prompt.enterPresetName'));

  if (!name || name.trim() === '') {
    return;
  }

  const trimmedName = name.trim();

  // Check if name is a predefined preset name
  if (isPredefinedPresetName(trimmedName)) {
    toastr.error(t('toast.cannotUsePredefinedNames'), t('extensionName'));
    return;
  }

  // Check if name already exists in custom presets
  const existingPreset = settings.customPresets.find(
    p => p.name === trimmedName
  );

  if (existingPreset) {
    const overwrite = confirm(t('prompt.overwritePreset', {name: trimmedName}));
    if (!overwrite) {
      return;
    }

    // Overwrite existing preset
    existingPreset.template = content;
    settings.currentPresetId = existingPreset.id;
    settings.metaPrompt = content;
  } else {
    // Create new preset
    const newPreset: MetaPromptPreset = {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      template: content,
      predefined: false,
    };

    settings.customPresets.push(newPreset);
    settings.currentPresetId = newPreset.id;
    settings.metaPrompt = content;
  }

  saveSettings(settings, context);

  // Exit edit mode
  const presetEditor = document.getElementById(
    UI_ELEMENT_IDS.PRESET_EDITOR
  ) as HTMLDivElement;
  const presetViewer = document.getElementById(
    UI_ELEMENT_IDS.PRESET_VIEWER
  ) as HTMLDivElement;
  if (presetEditor) presetEditor.style.display = 'none';
  if (presetViewer) presetViewer.style.display = 'block';
  isEditingPreset = false;

  updateUI();
  toastr.success(
    t('toast.presetSavedNamed', {name: trimmedName}),
    t('extensionName')
  );
  logger.info('Preset saved as:', trimmedName);
}

/**
 * Handles canceling preset edit
 */
function handlePresetCancel(): void {
  const presetEditor = document.getElementById(
    UI_ELEMENT_IDS.PRESET_EDITOR
  ) as HTMLDivElement;
  const presetViewer = document.getElementById(
    UI_ELEMENT_IDS.PRESET_VIEWER
  ) as HTMLDivElement;
  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;

  if (!presetEditor || !presetViewer || !metaPromptTextarea) return;

  // Hide editor, show viewer
  presetEditor.style.display = 'none';
  presetViewer.style.display = 'block';

  // Reset textarea to readonly and restore content
  metaPromptTextarea.setAttribute('readonly', 'readonly');
  metaPromptTextarea.value = settings.metaPrompt;

  isEditingPreset = false;
  logger.info('Cancelled preset edit');
}

/**
 * Handles deleting a custom preset
 */
function handlePresetDelete(): void {
  if (isPresetPredefined(settings.currentPresetId)) {
    toastr.error(t('toast.cannotDeletePredefined'), t('extensionName'));
    return;
  }

  const preset = settings.customPresets.find(
    p => p.id === settings.currentPresetId
  );
  if (!preset) {
    toastr.error(t('toast.presetNotFound'), t('extensionName'));
    return;
  }

  const confirmDelete = confirm(
    t('prompt.deletePresetConfirm', {name: preset.name})
  );
  if (!confirmDelete) {
    return;
  }

  // Remove preset from array
  settings.customPresets = settings.customPresets.filter(
    p => p.id !== settings.currentPresetId
  );

  // Switch to default preset
  settings.currentPresetId = 'default';
  const defaultPreset = getPresetById('default', settings.customPresets);
  settings.metaPrompt = defaultPreset.template;

  saveSettings(settings, context);
  updateUI();

  toastr.success(
    t('toast.presetDeleted', {name: preset.name}),
    t('extensionName')
  );
  logger.info('Preset deleted:', preset.name);
}

// ===== Independent LLM Preset Handlers =====

/**
 * Handles independent LLM preset selection change
 */
function handleIndependentLlmPresetChange(): void {
  if (isEditingIndependentLlmPreset) {
    handleIndependentLlmPresetCancel();
  }

  const select = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SELECT
  ) as HTMLSelectElement;
  if (!select) return;

  const selectedId = select.value;
  const preset = getIndependentLlmPresetById(
    selectedId,
    settings.customIndependentLlmPresets || []
  );

  settings.currentIndependentLlmPresetId = selectedId;
  settings.llmFrequencyGuidelines = preset.frequencyGuidelines;
  settings.llmPromptWritingGuidelines = preset.promptWritingGuidelines;
  saveSettings(settings, context);
  updateUI();

  logger.info('Independent LLM preset changed:', {
    id: selectedId,
    name: preset.name,
  });
}

/**
 * Handles entering edit mode for independent LLM preset
 */
function handleIndependentLlmPresetEdit(): void {
  const editor = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_EDITOR
  ) as HTMLDivElement;
  const freqTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const writingTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;
  const saveButton = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SAVE
  ) as HTMLButtonElement;

  if (!editor || !freqTextarea || !writingTextarea) return;

  editor.style.display = 'block';
  freqTextarea.removeAttribute('readonly');
  writingTextarea.removeAttribute('readonly');

  if (saveButton) {
    const isPredefined = isIndependentLlmPresetPredefined(
      settings.currentIndependentLlmPresetId
    );
    saveButton.disabled = isPredefined;
    saveButton.title = isPredefined
      ? t('toast.cannotDeletePredefinedIndependentLlm')
      : t('settings.save');
  }

  isEditingIndependentLlmPreset = true;
  logger.info('Entered independent LLM preset edit mode');
}

/**
 * Handles saving changes to current custom independent LLM preset
 */
function handleIndependentLlmPresetSave(): void {
  if (
    isIndependentLlmPresetPredefined(settings.currentIndependentLlmPresetId)
  ) {
    toastr.error(
      t('toast.cannotDeletePredefinedIndependentLlm'),
      t('extensionName')
    );
    return;
  }

  const freqTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const writingTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;
  if (!freqTextarea || !writingTextarea) return;

  const presetIndex = (settings.customIndependentLlmPresets || []).findIndex(
    p => p.id === settings.currentIndependentLlmPresetId
  );
  if (presetIndex === -1) {
    toastr.error(t('toast.presetNotFound'), t('extensionName'));
    return;
  }

  settings.customIndependentLlmPresets[presetIndex].frequencyGuidelines =
    freqTextarea.value;
  settings.customIndependentLlmPresets[presetIndex].promptWritingGuidelines =
    writingTextarea.value;
  settings.llmFrequencyGuidelines = freqTextarea.value;
  settings.llmPromptWritingGuidelines = writingTextarea.value;
  saveSettings(settings, context);

  exitIndependentLlmEditMode();
  updateUI();
  toastr.success(t('toast.independentLlmPresetSaved'), t('extensionName'));
  logger.info(
    'Independent LLM preset saved:',
    settings.customIndependentLlmPresets[presetIndex].name
  );
}

/**
 * Handles saving current content as a new independent LLM preset
 */
function handleIndependentLlmPresetSaveAs(): void {
  const freqTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const writingTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;
  if (!freqTextarea || !writingTextarea) return;

  const name = prompt(t('prompt.enterIndependentLlmPresetName'));
  if (!name || name.trim() === '') return;

  const trimmedName = name.trim();

  if (isIndependentLlmPredefinedPresetName(trimmedName)) {
    toastr.error(
      t('toast.cannotUsePredefinedIndependentLlmNames'),
      t('extensionName')
    );
    return;
  }

  if (!settings.customIndependentLlmPresets) {
    settings.customIndependentLlmPresets = [];
  }

  const existingPreset = settings.customIndependentLlmPresets.find(
    p => p.name === trimmedName
  );

  if (existingPreset) {
    const overwrite = confirm(
      t('prompt.overwriteIndependentLlmPreset', {name: trimmedName})
    );
    if (!overwrite) return;

    existingPreset.frequencyGuidelines = freqTextarea.value;
    existingPreset.promptWritingGuidelines = writingTextarea.value;
    settings.currentIndependentLlmPresetId = existingPreset.id;
  } else {
    const newPreset: IndependentLlmGuidelinesPreset = {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      frequencyGuidelines: freqTextarea.value,
      promptWritingGuidelines: writingTextarea.value,
      predefined: false,
    };
    settings.customIndependentLlmPresets.push(newPreset);
    settings.currentIndependentLlmPresetId = newPreset.id;
  }

  settings.llmFrequencyGuidelines = freqTextarea.value;
  settings.llmPromptWritingGuidelines = writingTextarea.value;
  saveSettings(settings, context);

  exitIndependentLlmEditMode();
  updateUI();
  toastr.success(
    t('toast.independentLlmPresetSavedNamed', {name: trimmedName}),
    t('extensionName')
  );
  logger.info('Independent LLM preset saved as:', trimmedName);
}

/**
 * Handles canceling independent LLM preset edit
 */
function handleIndependentLlmPresetCancel(): void {
  const freqTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const writingTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;

  // Restore original values
  if (freqTextarea) freqTextarea.value = settings.llmFrequencyGuidelines;
  if (writingTextarea)
    writingTextarea.value = settings.llmPromptWritingGuidelines;

  exitIndependentLlmEditMode();
  logger.info('Cancelled independent LLM preset edit');
}

/**
 * Handles deleting a custom independent LLM preset
 */
function handleIndependentLlmPresetDelete(): void {
  if (
    isIndependentLlmPresetPredefined(settings.currentIndependentLlmPresetId)
  ) {
    toastr.error(
      t('toast.cannotDeletePredefinedIndependentLlm'),
      t('extensionName')
    );
    return;
  }

  const preset = (settings.customIndependentLlmPresets || []).find(
    p => p.id === settings.currentIndependentLlmPresetId
  );
  if (!preset) {
    toastr.error(t('toast.presetNotFound'), t('extensionName'));
    return;
  }

  const confirmDelete = confirm(
    t('prompt.deleteIndependentLlmPresetConfirm', {name: preset.name})
  );
  if (!confirmDelete) return;

  settings.customIndependentLlmPresets =
    settings.customIndependentLlmPresets.filter(
      p => p.id !== settings.currentIndependentLlmPresetId
    );

  // Switch to default
  settings.currentIndependentLlmPresetId = 'default';
  const defaultPreset = getIndependentLlmPresetById(
    'default',
    settings.customIndependentLlmPresets
  );
  settings.llmFrequencyGuidelines = defaultPreset.frequencyGuidelines;
  settings.llmPromptWritingGuidelines = defaultPreset.promptWritingGuidelines;

  saveSettings(settings, context);
  updateUI();

  toastr.success(
    t('toast.independentLlmPresetDeleted', {name: preset.name}),
    t('extensionName')
  );
  logger.info('Independent LLM preset deleted:', preset.name);
}

/**
 * Exits independent LLM preset edit mode
 */
function exitIndependentLlmEditMode(): void {
  const editor = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_EDITOR
  ) as HTMLDivElement;
  const freqTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const writingTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;

  if (editor) editor.style.display = 'none';
  if (freqTextarea) freqTextarea.setAttribute('readonly', 'readonly');
  if (writingTextarea) writingTextarea.setAttribute('readonly', 'readonly');
  isEditingIndependentLlmPreset = false;
}

// ===== API Profile Handlers =====

/**
 * Populates the API profile dropdown with saved profiles
 */
function populateApiProfileDropdown(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.API_PROFILE_SELECT
  ) as HTMLSelectElement;
  if (!select) return;

  // Preserve manual option, clear the rest
  const manualOption = select.querySelector('option[value=""]');
  select.innerHTML = '';
  if (manualOption) {
    select.appendChild(manualOption);
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = t('settings.apiProfileManual');
    select.appendChild(opt);
  }

  // Add saved profiles
  (settings.apiProfiles || []).forEach(profile => {
    const opt = document.createElement('option');
    opt.value = profile.id;
    opt.textContent = profile.name;
    select.appendChild(opt);
  });

  select.value = settings.currentApiProfileId || '';
}

/**
 * Handles API profile selection change - fills fields with profile data
 */
function handleApiProfileChange(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.API_PROFILE_SELECT
  ) as HTMLSelectElement;
  if (!select) return;

  const profileId = select.value;
  settings.currentApiProfileId = profileId;

  if (profileId) {
    const profile = (settings.apiProfiles || []).find(p => p.id === profileId);
    if (profile) {
      // Fill fields with profile data
      const urlInput = document.getElementById(
        UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
      ) as HTMLInputElement;
      const keyInput = document.getElementById(
        UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
      ) as HTMLInputElement;
      const modelInput = document.getElementById(
        UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
      ) as HTMLInputElement;
      const maxTokensInput = document.getElementById(
        UI_ELEMENT_IDS.INDEPENDENT_LLM_MAX_TOKENS
      ) as HTMLInputElement;

      if (urlInput) urlInput.value = profile.apiUrl;
      if (keyInput) keyInput.value = profile.apiKey;
      if (modelInput) modelInput.value = profile.model;
      if (maxTokensInput) maxTokensInput.value = String(profile.maxTokens);

      // Update settings
      settings.independentLlmApiUrl = profile.apiUrl;
      settings.independentLlmApiKey = profile.apiKey;
      settings.independentLlmModel = profile.model;
      settings.independentLlmMaxTokens = profile.maxTokens;
    }
  }

  saveSettings(settings, context);
}

/**
 * Handles saving current API config as a profile
 */
function handleApiProfileSave(): void {
  const urlInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
  ) as HTMLInputElement;
  const keyInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
  ) as HTMLInputElement;
  const modelInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
  ) as HTMLInputElement;
  const maxTokensInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MAX_TOKENS
  ) as HTMLInputElement;

  const name = prompt(t('prompt.enterApiProfileName'));
  if (!name || name.trim() === '') return;

  const trimmedName = name.trim();

  if (!settings.apiProfiles) {
    settings.apiProfiles = [];
  }

  // Check if name already exists - overwrite if so
  const existing = settings.apiProfiles.find(p => p.name === trimmedName);
  if (existing) {
    existing.apiUrl = urlInput?.value || '';
    existing.apiKey = keyInput?.value || '';
    existing.model = modelInput?.value || '';
    existing.maxTokens = parseInt(maxTokensInput?.value || '4096', 10);
    settings.currentApiProfileId = existing.id;
  } else {
    const newProfile: ApiProfile = {
      id: `profile-${Date.now()}`,
      name: trimmedName,
      apiUrl: urlInput?.value || '',
      apiKey: keyInput?.value || '',
      model: modelInput?.value || '',
      maxTokens: parseInt(maxTokensInput?.value || '4096', 10),
    };
    settings.apiProfiles.push(newProfile);
    settings.currentApiProfileId = newProfile.id;
  }

  saveSettings(settings, context);
  populateApiProfileDropdown();

  toastr.success(
    t('toast.apiProfileSaved', {name: trimmedName}),
    t('extensionName')
  );
  logger.info('API profile saved:', trimmedName);
}

/**
 * Handles deleting the selected API profile
 */
function handleApiProfileDelete(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.API_PROFILE_SELECT
  ) as HTMLSelectElement;
  if (!select || !select.value) {
    toastr.warning(t('toast.apiProfileSelectToDelete'), t('extensionName'));
    return;
  }

  const profile = (settings.apiProfiles || []).find(p => p.id === select.value);
  if (!profile) return;

  const confirmDelete = confirm(
    t('prompt.deleteApiProfileConfirm', {name: profile.name})
  );
  if (!confirmDelete) return;

  settings.apiProfiles = settings.apiProfiles.filter(p => p.id !== profile.id);
  settings.currentApiProfileId = '';

  saveSettings(settings, context);
  populateApiProfileDropdown();

  toastr.success(
    t('toast.apiProfileDeleted', {name: profile.name}),
    t('extensionName')
  );
  logger.info('API profile deleted:', profile.name);
}

/**
 * Checks for extension updates from GitHub releases API
 */
type GitHubRelease = {
  tag_name?: string;
  html_url?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
};

function normalizeReleaseVersion(version: string): string {
  return version.replace(/^v/i, '');
}

function parseVersionParts(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split(/[.-]/)
    .map(part => Number.parseInt(part, 10))
    .map(value => (Number.isFinite(value) ? value : 0));
}

function compareVersions(a: string, b: string): number {
  const aParts = parseVersionParts(a);
  const bParts = parseVersionParts(b);
  const length = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < length; index += 1) {
    const aValue = aParts[index] ?? 0;
    const bValue = bParts[index] ?? 0;
    if (aValue !== bValue) {
      return aValue > bValue ? 1 : -1;
    }
  }
  return 0;
}

function isSummaryHeading(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return (
    normalized === '更新摘要' ||
    normalized === '更新摘要（面板显示）' ||
    normalized === '更新摘要(面板显示)' ||
    normalized === 'highlights' ||
    normalized === 'summary' ||
    normalized === "what's new" ||
    normalized === 'whats new'
  );
}

function getReleaseSummaryLines(body: string): string[] {
  const lines = body.split(/\r?\n/);
  let summaryStart = -1;
  let summaryLevel = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{2,6})\s+(.+?)\s*$/);
    if (match && isSummaryHeading(match[2])) {
      summaryStart = index + 1;
      summaryLevel = match[1].length;
      break;
    }
  }

  if (summaryStart < 0) {
    return lines;
  }

  const summaryLines: string[] = [];
  for (let index = summaryStart; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{2,6})\s+(.+?)\s*$/);
    if (match && match[1].length <= summaryLevel) {
      break;
    }
    summaryLines.push(lines[index]);
  }

  return summaryLines;
}

function extractReleaseHighlights(body: string): string[] {
  return getReleaseSummaryLines(body)
    .map(line => line.trim())
    .filter(line => /^[-*]\s+/.test(line))
    .map(line =>
      line
        .replace(/^[-*]\s+/, '')
        .replace(/^\[[ xX]\]\s+/, '')
        .replace(/\*\*/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .trim()
    )
    .filter(Boolean);
}

function renderVersionHighlights(
  titleText: string,
  highlights: readonly string[],
  linkUrl: string,
  linkText: string,
  expanded = false
): void {
  const notice = document.getElementById(
    UI_ELEMENT_IDS.UPDATE_NOTICE
  ) as HTMLDetailsElement | null;
  const title = document.getElementById(UI_ELEMENT_IDS.UPDATE_NOTICE_TITLE);
  const list = document.getElementById(UI_ELEMENT_IDS.UPDATE_NOTICE_LIST);
  const link = document.getElementById(
    UI_ELEMENT_IDS.UPDATE_NOTICE_LINK
  ) as HTMLAnchorElement | null;

  if (!notice || !title || !list || !link) {
    return;
  }

  title.textContent = titleText;
  list.innerHTML = '';
  const items = highlights.length
    ? highlights
    : [t('version.updateSummaryFallback')];
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    list.append(li);
  });

  link.href = linkUrl;
  link.textContent = linkText;
  notice.open = expanded;
  notice.hidden = false;
}

function findReleaseByVersion(
  releases: readonly GitHubRelease[],
  version: string
): GitHubRelease | undefined {
  return releases.find(release => {
    const releaseVersion = normalizeReleaseVersion(release.tag_name || '');
    return releaseVersion && compareVersions(releaseVersion, version) === 0;
  });
}

function renderCurrentVersionHighlights(
  releases: readonly GitHubRelease[]
): void {
  const currentRelease = findReleaseByVersion(releases, EXTENSION_VERSION);
  renderVersionHighlights(
    t('version.currentSummaryTitle', {version: EXTENSION_VERSION}),
    extractReleaseHighlights(currentRelease?.body || ''),
    currentRelease?.html_url ||
      `https://github.com/${GITHUB_REPO}/releases/tag/v${EXTENSION_VERSION}`,
    t('version.releaseNotes'),
    false
  );
}

function renderUpdateNotice(
  currentVersion: string,
  latestVersion: string,
  releases: GitHubRelease[],
  latestUrl: string
): void {
  const updateReleases = releases
    .filter(release => {
      const version = normalizeReleaseVersion(release.tag_name || '');
      return (
        version &&
        compareVersions(version, currentVersion) > 0 &&
        compareVersions(version, latestVersion) <= 0
      );
    })
    .sort((a, b) => {
      const aVersion = normalizeReleaseVersion(a.tag_name || '');
      const bVersion = normalizeReleaseVersion(b.tag_name || '');
      return compareVersions(aVersion, bVersion);
    });
  const highlights = updateReleases.flatMap(release =>
    extractReleaseHighlights(release.body || '')
  );
  renderVersionHighlights(
    t('version.updateSummaryTitle', {
      current: currentVersion,
      latest: latestVersion,
    }),
    highlights,
    latestUrl || `https://github.com/${GITHUB_REPO}/releases`,
    t('version.releaseNotes'),
    true
  );
}

async function checkForUpdates(): Promise<void> {
  const statusEl = document.getElementById(UI_ELEMENT_IDS.VERSION_STATUS);
  if (!statusEl) return;

  statusEl.classList.remove('is-latest');

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`,
      {signal: AbortSignal.timeout(10000)}
    );

    if (!response.ok) {
      statusEl.textContent = t('version.checkFailed');
      return;
    }

    const releases = ((await response.json()) as GitHubRelease[]).filter(
      release => !release.draft && !release.prerelease
    );
    const sortedReleases = [...releases].sort((a, b) => {
      const aVersion = normalizeReleaseVersion(a.tag_name || '');
      const bVersion = normalizeReleaseVersion(b.tag_name || '');
      return compareVersions(bVersion, aVersion);
    });
    const latestRelease = sortedReleases[0];
    const latestVersion = normalizeReleaseVersion(
      latestRelease?.tag_name || ''
    );

    if (
      latestVersion &&
      compareVersions(latestVersion, EXTENSION_VERSION) > 0
    ) {
      statusEl.textContent = '→ ';
      const link = document.createElement('a');
      link.href =
        latestRelease.html_url || `https://github.com/${GITHUB_REPO}/releases`;
      link.target = '_blank';
      link.className = 'auto-illustrator-version-update-link';
      link.textContent = t('version.updateAvailable', {
        version: latestVersion,
      });
      statusEl.append(link);
      renderUpdateNotice(
        EXTENSION_VERSION,
        latestVersion,
        sortedReleases,
        latestRelease.html_url || ''
      );
    } else {
      statusEl.textContent = `✓ ${t('version.latest')}`;
      statusEl.classList.add('is-latest');
      renderCurrentVersionHighlights(sortedReleases);
    }
  } catch {
    statusEl.textContent = t('version.checkFailed');
  }
}

function setServerPluginStatus(
  statusEl: HTMLElement,
  state: 'checking' | 'synced' | 'warning' | 'unavailable',
  text: string
): void {
  statusEl.classList.remove(
    'is-checking',
    'is-synced',
    'is-warning',
    'is-unavailable'
  );
  statusEl.classList.add(`is-${state}`);
  statusEl.textContent = text;
}

/**
 * Checks whether the companion server plugin matches the frontend bundle.
 */
async function checkServerPluginStatus(): Promise<void> {
  const statusEl = document.getElementById(UI_ELEMENT_IDS.SERVER_PLUGIN_STATUS);
  if (!statusEl) return;

  setServerPluginStatus(statusEl, 'checking', t('serverPlugin.checking'));

  try {
    const response = await fetch(SERVER_PLUGIN.STATUS_ROUTE, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      setServerPluginStatus(
        statusEl,
        'unavailable',
        t('serverPlugin.unavailable')
      );
      return;
    }

    const data = (await response.json()) as {
      ok?: boolean;
      plugin?: string;
      version?: string;
    };

    if (!data.ok || data.plugin !== SERVER_PLUGIN.ID) {
      setServerPluginStatus(
        statusEl,
        'unavailable',
        t('serverPlugin.unavailable')
      );
      return;
    }

    if (data.version !== SERVER_PLUGIN.VERSION) {
      setServerPluginStatus(
        statusEl,
        'warning',
        t('serverPlugin.updateRequired')
      );
      return;
    }

    setServerPluginStatus(statusEl, 'synced', t('serverPlugin.synced'));
  } catch {
    setServerPluginStatus(
      statusEl,
      'unavailable',
      t('serverPlugin.unavailable')
    );
  }
}

/**
 * Cancels all active streaming sessions
 * Used when chat is cleared or reset
 */
function cancelAllSessions(): void {
  const sessions = sessionManager.getAllSessions();
  if (sessions.length === 0) {
    return;
  }

  logger.info(`Cancelling ${sessions.length} active streaming sessions`);

  for (const session of sessions) {
    sessionManager.cancelSession(session.messageId);
  }
}

/**
 * Track whether event handlers have been registered to prevent duplicates
 */
let eventHandlersRegistered = false;

/**
 * Registers all event handlers for the extension
 * Only called when extension is enabled
 * Uses flag to prevent duplicate registration
 */
function registerEventHandlers(): void {
  // Prevent duplicate registration
  if (eventHandlersRegistered) {
    logger.debug(
      'Event handlers already registered, skipping duplicate registration'
    );
    return;
  }

  logger.info('Registering event handlers...');

  if (!registeredEventHandlers) {
    registeredEventHandlers = {
      streamTokenReceived: () => {
        if (!settings.enabled) {
          return;
        }

        const messageId = context.chat.length - 1;
        if (messageId < 0) {
          logger.warn('No messages in chat, cannot start streaming session');
          return;
        }
        handleStreamTokenStarted(messageId, context, settings);
      },
      messageReceived: (messageId: number) => {
        if (!settings.enabled) {
          return;
        }

        handleMessageReceived(messageId, context, settings);

        setTimeout(() => {
          if (!settings.enabled) {
            return;
          }
          addImageClickHandlers(settings);
          syncIndependentPromptRetryButtons(context, settings, retryMessageId =>
            handleManualIndependentPromptRetry(retryMessageId, settings)
          );
        }, 100);
      },
      messageUpdated: () => {
        if (!settings.enabled) {
          return;
        }

        setTimeout(() => {
          if (!settings.enabled) {
            return;
          }
          addImageClickHandlers(settings);
          syncIndependentPromptRetryButtons(context, settings, retryMessageId =>
            handleManualIndependentPromptRetry(retryMessageId, settings)
          );
        }, 100);
      },
      generationStarted: (type: string, _options: unknown, dryRun: boolean) => {
        if (!settings.enabled) {
          return;
        }

        if (dryRun) {
          logger.trace('Generation started (dry run), skipping type tracking', {
            type,
          });
          return;
        }
        currentGenerationType = type;
        logger.info('Generation started', {type});
      },
      generationEnded: (messageId: number) => {
        if (!settings.enabled) {
          return;
        }

        handleGenerationEnded(messageId, context, settings);
      },
      chatCompletionPromptReady: (eventData: any) => {
        if (!settings.enabled) {
          return;
        }

        if (eventData?.dryRun) {
          logger.trace('Skipping prompt ready processing for dry run');
          return;
        }

        if (!eventData?.chat) {
          return;
        }

        if (isIndependentApiMode(settings.promptGenerationMode)) {
          pruneGeneratedImagesAndPrompts(
            eventData.chat,
            settings.promptDetectionPatterns
          );
          logger.debug(
            'Applied independent-API-mode pruning (images + prompts)'
          );
        } else {
          pruneGeneratedImages(
            eventData.chat,
            settings.promptDetectionPatterns
          );
          logger.debug('Applied shared-API-mode pruning (images only)');
        }

        const effectiveType = currentGenerationType || 'normal';
        const shouldInject =
          settings.metaPrompt &&
          settings.metaPrompt.length > 0 &&
          !['quiet', 'impersonate'].includes(effectiveType) &&
          !isIndependentApiMode(settings.promptGenerationMode);

        if (shouldInject) {
          const depth = settings.metaPromptDepth || 0;
          const insertPosition = Math.max(0, eventData.chat.length - depth);

          logger.info('Injecting meta-prompt as system message', {
            generationType: effectiveType,
            depth,
            insertPosition,
            chatLength: eventData.chat.length,
          });

          eventData.chat.splice(insertPosition, 0, {
            role: 'system',
            content: settings.metaPrompt,
          });
        } else {
          logger.info('Skipping meta-prompt injection', {
            enabled: settings.enabled,
            hasMetaPrompt: !!settings.metaPrompt,
            generationType: effectiveType,
            promptGenerationMode: settings.promptGenerationMode,
            reason: !settings.metaPrompt
              ? 'no meta-prompt'
              : ['quiet', 'impersonate'].includes(effectiveType)
                ? `filtered generation type: ${effectiveType}`
                : isIndependentApiMode(settings.promptGenerationMode)
                  ? 'Independent API mode enabled'
                  : 'unknown',
          });
        }
      },
    };
  }

  const STREAM_TOKEN_RECEIVED = context.eventTypes.STREAM_TOKEN_RECEIVED;
  context.eventSource.on(
    STREAM_TOKEN_RECEIVED,
    registeredEventHandlers.streamTokenReceived
  );

  const MESSAGE_RECEIVED = context.eventTypes.MESSAGE_RECEIVED;
  context.eventSource.on(
    MESSAGE_RECEIVED,
    registeredEventHandlers.messageReceived
  );

  const MESSAGE_UPDATED = context.eventTypes.MESSAGE_UPDATED;
  context.eventSource.on(
    MESSAGE_UPDATED,
    registeredEventHandlers.messageUpdated
  );

  const GENERATION_STARTED = context.eventTypes.GENERATION_STARTED;
  context.eventSource.on(
    GENERATION_STARTED,
    registeredEventHandlers.generationStarted
  );

  const GENERATION_ENDED = context.eventTypes.GENERATION_ENDED;
  context.eventSource.on(
    GENERATION_ENDED,
    registeredEventHandlers.generationEnded
  );

  const CHAT_COMPLETION_PROMPT_READY =
    context.eventTypes.CHAT_COMPLETION_PROMPT_READY;
  context.eventSource.on(
    CHAT_COMPLETION_PROMPT_READY,
    registeredEventHandlers.chatCompletionPromptReady
  );

  // Note: CHAT_CHANGED is now handled by chat_changed_handler module

  // Mark as registered to prevent duplicates
  eventHandlersRegistered = true;

  logger.info('Event handlers registered:', {
    STREAM_TOKEN_RECEIVED,
    MESSAGE_RECEIVED,
    MESSAGE_UPDATED,
    GENERATION_STARTED,
    CHAT_COMPLETION_PROMPT_READY,
  });
}

/**
 * 注销所有事件处理器
 * 允许扩展被禁用而无需刷新页面
 */
function unregisterEventHandlers(): void {
  if (!eventHandlersRegistered) {
    logger.debug('事件处理器未注册,无需注销');
    return;
  }

  logger.info('正在注销事件处理器...');
  const off =
    (context.eventSource as any).off ||
    (context.eventSource as any).removeListener;

  if (typeof off === 'function' && registeredEventHandlers) {
    off.call(
      context.eventSource,
      context.eventTypes.STREAM_TOKEN_RECEIVED,
      registeredEventHandlers.streamTokenReceived
    );
    off.call(
      context.eventSource,
      context.eventTypes.MESSAGE_RECEIVED,
      registeredEventHandlers.messageReceived
    );
    off.call(
      context.eventSource,
      context.eventTypes.MESSAGE_UPDATED,
      registeredEventHandlers.messageUpdated
    );
    off.call(
      context.eventSource,
      context.eventTypes.GENERATION_STARTED,
      registeredEventHandlers.generationStarted
    );
    off.call(
      context.eventSource,
      context.eventTypes.GENERATION_ENDED,
      registeredEventHandlers.generationEnded
    );
    off.call(
      context.eventSource,
      context.eventTypes.CHAT_COMPLETION_PROMPT_READY,
      registeredEventHandlers.chatCompletionPromptReady
    );
    eventHandlersRegistered = false;
    logger.info('事件处理器已注销');
    return;
  }

  logger.warn(
    'eventSource 不支持解绑，保留已注册处理器并通过 enabled 开关使其休眠'
  );
}

/**
 * Initializes the extension
 */
function initialize(): void {
  if (extensionInitialized) {
    logger.info(
      'Extension already initialized, skipping duplicate initialization'
    );
    return;
  }

  logger.info('Initializing extension...');

  const st = (
    globalThis as {SillyTavern?: {getContext?: () => SillyTavernContext}}
  ).SillyTavern;
  if (!st || typeof st.getContext !== 'function') {
    logger.debug('SillyTavern global not available; skipping initialization');
    return;
  }

  // Get SillyTavern context
  try {
    context = st.getContext();
    logger.info('Got SillyTavern context');
  } catch (error) {
    logger.error('Failed to get SillyTavern context:', error);
    return;
  }

  // Initialize i18n
  initializeI18n(context);
  logger.info('Initialized i18n');

  // Initialize CHAT_CHANGED handler (single centralized handler)
  initializeChatChangedHandler();
  logger.info('Initialized centralized CHAT_CHANGED handler');

  // Load settings
  settings = loadSettings(context);
  logger.info('Loaded settings:', settings);

  // Initialize previous image display width to track changes
  previousImageDisplayWidth = settings.imageDisplayWidth;

  // Apply log level from settings
  setLogLevel(settings.logLevel);

  // Initialize chat change operations module with current context and callbacks
  // This must be done after settings are loaded
  initializeChatChangeOperations(
    context,
    settings,
    updateMaxConcurrent,
    updateMinInterval,
    updateUI
  );
  logger.info('Initialized chat change operations module');

  // Conditionally initialize extension components based on settings.enabled
  if (settings.enabled) {
    // SessionManager is already a singleton, no initialization needed
    logger.info('SessionManager ready (singleton)');

    // Initialize progress widget if enabled (connects to progressManager via events)
    if (settings.showProgressWidget) {
      initializeProgressWidget(progressManager);
      logger.info('Initialized ProgressWidget with event subscriptions');
    } else {
      logger.info('Progress widget disabled - skipping initialization');
    }

    // Initialize gallery widget if enabled (connects to progressManager via events)
    if (settings.showGalleryWidget) {
      initializeGalleryWidget(progressManager);
      logger.info('Initialized GalleryWidget');

      // Show gallery widget on initialization to scan for existing images
      const gallery = getGalleryWidget();
      if (gallery) {
        gallery.show();
        logger.debug('Gallery widget shown on initialization');
      }
    } else {
      logger.info('Gallery widget disabled - skipping initialization');
    }

    // Initialize streaming preview widget if enabled
    if (settings.showStreamingPreviewWidget) {
      streamingPreviewWidget = new StreamingPreviewWidget(
        progressManager,
        settings.promptDetectionPatterns || DEFAULT_PROMPT_DETECTION_PATTERNS
      );
      logger.info('Initialized StreamingPreviewWidget');
    } else {
      logger.info(
        'Streaming preview widget disabled - skipping initialization'
      );
    }
  } else {
    logger.info(
      'Extension is disabled - skipping SessionManager and widget initialization'
    );
  }

  // Initialize concurrency limiter with settings
  initializeConcurrencyLimiter(
    settings.maxConcurrentGenerations,
    settings.minGenerationInterval
  );
  logger.info(
    `Initialized concurrency limiter: max=${settings.maxConcurrentGenerations}, minInterval=${settings.minGenerationInterval}ms`
  );

  // Conditionally register event handlers based on settings.enabled
  if (settings.enabled) {
    registerEventHandlers();
    logger.info('Extension is enabled - event handlers registered');
  } else {
    logger.info('Extension is disabled - skipping event handler registration');
  }

  // Inject settings UI
  const settingsContainer = document.getElementById('extensions_settings2');
  if (settingsContainer) {
    const settingsHTML = createSettingsUI();
    settingsContainer.insertAdjacentHTML('beforeend', settingsHTML);

    // Attach event listeners
    const enabledCheckbox = document.getElementById(UI_ELEMENT_IDS.ENABLED);
    const presetSelect = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_SELECT
    );
    const presetEditButton = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_EDIT
    );
    const presetSaveButton = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_SAVE
    );
    const presetSaveAsButton = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_SAVE_AS
    );
    const presetDeleteButton = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_DELETE
    );
    const presetCancelButton = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_CANCEL
    );
    const streamingPollIntervalInput = document.getElementById(
      UI_ELEMENT_IDS.STREAMING_POLL_INTERVAL
    );
    const maxConcurrentInput = document.getElementById(
      UI_ELEMENT_IDS.MAX_CONCURRENT
    );
    const minGenerationIntervalInput = document.getElementById(
      UI_ELEMENT_IDS.MIN_GENERATION_INTERVAL
    );
    const logLevelSelect = document.getElementById(UI_ELEMENT_IDS.LOG_LEVEL);
    const promptPatternsTextarea = document.getElementById(
      UI_ELEMENT_IDS.PROMPT_PATTERNS
    );
    const promptPatternsResetButton = document.getElementById(
      UI_ELEMENT_IDS.PROMPT_PATTERNS_RESET
    );
    const commonStyleTagsTextarea = document.getElementById(
      UI_ELEMENT_IDS.COMMON_STYLE_TAGS
    );
    const commonStyleTagsPositionSelect = document.getElementById(
      UI_ELEMENT_IDS.COMMON_STYLE_TAGS_POSITION
    );
    const manualGenModeSelect = document.getElementById(
      UI_ELEMENT_IDS.MANUAL_GEN_MODE
    );
    const promptGenModeRegexRadio = document.getElementById(
      UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_SHARED
    ) as HTMLInputElement;
    const promptGenModeLLMRadio = document.getElementById(
      UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_INDEPENDENT
    ) as HTMLInputElement;
    const maxPromptsPerMessageInput = document.getElementById(
      UI_ELEMENT_IDS.MAX_PROMPTS_PER_MESSAGE
    ) as HTMLInputElement;
    const contextMessageCountInput = document.getElementById(
      UI_ELEMENT_IDS.CONTEXT_MESSAGE_COUNT
    ) as HTMLInputElement;
    const metaPromptDepthInput = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_DEPTH
    ) as HTMLInputElement;
    const standalonePromptCountInput = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_PROMPT_COUNT
    ) as HTMLInputElement;
    const llmFrequencyGuidelinesTextarea = document.getElementById(
      UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
    ) as HTMLTextAreaElement;
    const llmFrequencyGuidelinesResetButton = document.getElementById(
      UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES_RESET
    );
    const llmPromptWritingGuidelinesTextarea = document.getElementById(
      UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
    ) as HTMLTextAreaElement;
    const llmPromptWritingGuidelinesResetButton = document.getElementById(
      UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES_RESET
    );
    const resetButton = document.getElementById(UI_ELEMENT_IDS.RESET_BUTTON);

    enabledCheckbox?.addEventListener('change', handleSettingsChange);
    presetSelect?.addEventListener('change', handlePresetChange);
    presetEditButton?.addEventListener('click', handlePresetEdit);
    presetSaveButton?.addEventListener('click', handlePresetSave);
    presetSaveAsButton?.addEventListener('click', handlePresetSaveAs);
    presetDeleteButton?.addEventListener('click', handlePresetDelete);
    presetCancelButton?.addEventListener('click', handlePresetCancel);
    streamingPollIntervalInput?.addEventListener(
      'change',
      handleSettingsChange
    );
    maxConcurrentInput?.addEventListener('change', handleSettingsChange);
    minGenerationIntervalInput?.addEventListener(
      'change',
      handleSettingsChange
    );
    logLevelSelect?.addEventListener('change', handleSettingsChange);
    promptPatternsTextarea?.addEventListener('change', handleSettingsChange);
    promptPatternsResetButton?.addEventListener(
      'click',
      handlePromptPatternsReset
    );
    commonStyleTagsTextarea?.addEventListener('change', handleSettingsChange);
    commonStyleTagsPositionSelect?.addEventListener(
      'change',
      handleSettingsChange
    );
    document
      .getElementById(UI_ELEMENT_IDS.CHARACTER_TAG_INJECTION_MODE)
      ?.addEventListener('change', handleSettingsChange);
    manualGenModeSelect?.addEventListener('change', handleSettingsChange);
    promptGenModeRegexRadio?.addEventListener('change', () => {
      toggleIndependentApiSettingsVisibility();
      handleSettingsChange();
    });
    promptGenModeLLMRadio?.addEventListener('change', () => {
      toggleIndependentApiSettingsVisibility();
      handleSettingsChange();
    });
    maxPromptsPerMessageInput?.addEventListener('change', handleSettingsChange);
    contextMessageCountInput?.addEventListener('change', handleSettingsChange);
    metaPromptDepthInput?.addEventListener('change', handleSettingsChange);
    standalonePromptCountInput?.addEventListener(
      'change',
      handleSettingsChange
    );
    llmFrequencyGuidelinesTextarea?.addEventListener(
      'change',
      handleSettingsChange
    );
    llmFrequencyGuidelinesResetButton?.addEventListener(
      'click',
      handleLLMFrequencyGuidelinesReset
    );
    llmPromptWritingGuidelinesTextarea?.addEventListener(
      'change',
      handleSettingsChange
    );
    llmPromptWritingGuidelinesResetButton?.addEventListener(
      'click',
      handleLLMPromptWritingGuidelinesReset
    );

    const showGalleryWidgetCheckbox = document.getElementById(
      UI_ELEMENT_IDS.SHOW_GALLERY_WIDGET
    ) as HTMLInputElement;
    const showProgressWidgetCheckbox = document.getElementById(
      UI_ELEMENT_IDS.SHOW_PROGRESS_WIDGET
    ) as HTMLInputElement;
    const showStreamingPreviewWidgetCheckbox = document.getElementById(
      UI_ELEMENT_IDS.SHOW_STREAMING_PREVIEW_WIDGET
    ) as HTMLInputElement;
    const showFloatingPanelLauncherCheckbox = document.getElementById(
      UI_ELEMENT_IDS.SHOW_FLOATING_PANEL_LAUNCHER
    ) as HTMLInputElement;
    const openFloatingPanelButton = document.getElementById(
      UI_ELEMENT_IDS.OPEN_FLOATING_PANEL
    );
    showGalleryWidgetCheckbox?.addEventListener('change', handleSettingsChange);
    showProgressWidgetCheckbox?.addEventListener(
      'change',
      handleSettingsChange
    );
    showStreamingPreviewWidgetCheckbox?.addEventListener(
      'change',
      handleSettingsChange
    );
    showFloatingPanelLauncherCheckbox?.addEventListener(
      'change',
      handleSettingsChange
    );
    openFloatingPanelButton?.addEventListener('click', () => {
      openFloatingPanel();
    });
    // Image retention days
    const imageRetentionDaysInput = document.getElementById(
      UI_ELEMENT_IDS.IMAGE_RETENTION_DAYS
    );
    imageRetentionDaysInput?.addEventListener('change', handleSettingsChange);

    // Random SD Style controls
    const generationStyleModeSelect = document.getElementById(
      UI_ELEMENT_IDS.GENERATION_STYLE_MODE
    );
    generationStyleModeSelect?.addEventListener('change', () => {
      handleSettingsChange();
      updateGenerationStyleModeVisibility();
    });

    const generationStylePresetSelect = document.getElementById(
      UI_ELEMENT_IDS.GENERATION_STYLE_PRESET_SELECT
    ) as HTMLSelectElement | null;
    generationStylePresetSelect?.addEventListener('change', () => {
      const presetId = generationStylePresetSelect.value;
      if (!presetId) {
        settings.currentGenerationStylePresetId = '';
        saveSettings(settings, context);
        updateUI();
        return;
      }
      applyGenerationStylePresetById(presetId);
    });

    const generationStylePresetSaveButton = document.getElementById(
      UI_ELEMENT_IDS.GENERATION_STYLE_PRESET_SAVE
    );
    generationStylePresetSaveButton?.addEventListener(
      'click',
      saveCurrentGenerationStylePreset
    );

    const generationStylePresetOverwriteButton = document.getElementById(
      UI_ELEMENT_IDS.GENERATION_STYLE_PRESET_OVERWRITE
    );
    generationStylePresetOverwriteButton?.addEventListener(
      'click',
      overwriteSelectedGenerationStylePreset
    );

    const generationStylePresetDeleteButton = document.getElementById(
      UI_ELEMENT_IDS.GENERATION_STYLE_PRESET_DELETE
    );
    generationStylePresetDeleteButton?.addEventListener(
      'click',
      deleteSelectedGenerationStylePreset
    );

    const fixedSdStyleSelect = document.getElementById(
      UI_ELEMENT_IDS.FIXED_SD_STYLE_SELECT
    );
    fixedSdStyleSelect?.addEventListener('change', handleSettingsChange);

    const fixedVibeCombinationSelect = document.getElementById(
      UI_ELEMENT_IDS.FIXED_VIBE_COMBINATION_SELECT
    );
    fixedVibeCombinationSelect?.addEventListener(
      'change',
      handleSettingsChange
    );

    const randomizeSdStyleCheckbox = document.getElementById(
      UI_ELEMENT_IDS.RANDOMIZE_SD_STYLE
    );
    randomizeSdStyleCheckbox?.addEventListener('change', handleSettingsChange);

    const restoreSdStyleAfterCheckbox = document.getElementById(
      UI_ELEMENT_IDS.RESTORE_SD_STYLE_AFTER
    );
    restoreSdStyleAfterCheckbox?.addEventListener(
      'change',
      handleSettingsChange
    );

    const sdStylePoolRefreshBtn = document.getElementById(
      UI_ELEMENT_IDS.SD_STYLE_POOL_REFRESH
    );
    sdStylePoolRefreshBtn?.addEventListener('click', () => {
      renderSdStylePoolList();
      renderFixedSdStyleSelect();
    });

    const sdStylePoolSearchInput = document.getElementById(
      UI_ELEMENT_IDS.SD_STYLE_POOL_SEARCH
    );
    sdStylePoolSearchInput?.addEventListener('input', () => {
      renderSdStylePoolList();
    });

    const sdStylePoolList = document.getElementById(
      UI_ELEMENT_IDS.SD_STYLE_POOL_LIST
    );
    // Event delegation: any checkbox change inside the pool list triggers settings save.
    sdStylePoolList?.addEventListener('change', evt => {
      const target = evt.target as HTMLElement | null;
      if (
        target &&
        target instanceof HTMLInputElement &&
        target.classList.contains('auto-illustrator-sd-style-pool-checkbox')
      ) {
        handleSettingsChange();
      }
    });

    const randomizeVibeCombinationCheckbox = document.getElementById(
      UI_ELEMENT_IDS.RANDOMIZE_VIBE_COMBINATION
    );
    randomizeVibeCombinationCheckbox?.addEventListener(
      'change',
      handleSettingsChange
    );

    const vibeCombinationPoolSearchInput = document.getElementById(
      UI_ELEMENT_IDS.VIBE_COMBINATION_POOL_SEARCH
    );
    vibeCombinationPoolSearchInput?.addEventListener('input', () => {
      renderVibeCombinationPoolList();
    });

    const vibeCombinationPoolList = document.getElementById(
      UI_ELEMENT_IDS.VIBE_COMBINATION_POOL_LIST
    );
    vibeCombinationPoolList?.addEventListener('change', evt => {
      const target = evt.target as HTMLElement | null;
      if (
        target &&
        target instanceof HTMLInputElement &&
        target.classList.contains(
          'auto-illustrator-vibe-combination-pool-checkbox'
        )
      ) {
        handleSettingsChange();
      }
    });

    // Vibe Transfer controls
    const vibeTransferEnabledCheckbox = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_ENABLED
    );
    vibeTransferEnabledCheckbox?.addEventListener(
      'change',
      handleSettingsChange
    );

    const vibeManagerOpenButton = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_MANAGER_OPEN
    );
    vibeManagerOpenButton?.addEventListener('click', () => {
      openFloatingPanel('vibe');
    });

    const serverPluginInstallHelpButton = document.getElementById(
      UI_ELEMENT_IDS.SERVER_PLUGIN_INSTALL_HELP
    );
    serverPluginInstallHelpButton?.addEventListener(
      'click',
      showServerPluginInstallHelpDialog
    );

    const vibeManagerEditModeButton = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_MANAGER_EDIT_MODE
    );
    vibeManagerEditModeButton?.addEventListener('click', () => {
      settings.vibeTransferManagerEditMode =
        !settings.vibeTransferManagerEditMode;
      saveSettings(settings, context);
      updateUI();
      renderVibeTransferManagerList();
    });

    const vibeUploadZone = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_UPLOAD
    );
    const vibeUploadInput = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_UPLOAD_INPUT
    ) as HTMLInputElement | null;
    vibeUploadZone?.addEventListener('click', event => {
      if (event.target === vibeUploadInput) return;
      vibeUploadInput?.click();
    });
    bindVibeFileDropZone(vibeUploadZone, files => {
      handleVibeTransferFileSelection(files).catch(error => {
        logger.warn('Failed to add Vibe Transfer references:', error);
        toastr.error(t('toast.vibeTransferAddFailed'), t('extensionName'));
      });
    });
    vibeUploadInput?.addEventListener('change', () => {
      if (vibeUploadInput.files && vibeUploadInput.files.length > 0) {
        handleVibeTransferFileSelection(vibeUploadInput.files).catch(error => {
          logger.warn('Failed to add Vibe Transfer references:', error);
          toastr.error(t('toast.vibeTransferAddFailed'), t('extensionName'));
        });
        vibeUploadInput.value = '';
      }
    });

    const vibeBundleImportButton = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_BUNDLE_IMPORT
    );
    const vibeBundleImportInput = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_BUNDLE_IMPORT_INPUT
    ) as HTMLInputElement | null;
    vibeBundleImportButton?.addEventListener('click', () => {
      vibeBundleImportInput?.click();
    });
    bindVibeFileDropZone(vibeBundleImportButton, files => {
      const file = files.find(isSupportedVibeBundleFile);
      if (!file) {
        toastr.error(
          t('toast.vibeTransferBundleImportFailed'),
          t('extensionName')
        );
        return;
      }
      handleVibeBundleImport(file).catch(error => {
        logger.warn('Failed to import Vibe bundle:', error);
        toastr.error(
          `${t('toast.vibeTransferBundleImportFailed')}: ${extractErrorMessage(
            error
          )}`,
          t('extensionName')
        );
      });
    });
    vibeBundleImportInput?.addEventListener('change', () => {
      const file = vibeBundleImportInput.files?.[0];
      if (!file) return;
      handleVibeBundleImport(file).catch(error => {
        logger.warn('Failed to import Vibe bundle:', error);
        toastr.error(
          `${t('toast.vibeTransferBundleImportFailed')}: ${extractErrorMessage(
            error
          )}`,
          t('extensionName')
        );
      });
      vibeBundleImportInput.value = '';
    });

    const vibeBundleExportButton = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_BUNDLE_EXPORT
    );
    vibeBundleExportButton?.addEventListener('click', handleVibeBundleExport);

    const vibeClearButton = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_CLEAR
    );
    vibeClearButton?.addEventListener('click', deleteSelectedVibeTransferItems);

    const vibePresetSaveButton = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_PRESET_SAVE
    );
    vibePresetSaveButton?.addEventListener(
      'click',
      saveCurrentVibeTransferPreset
    );

    const vibePresetOverwriteButton = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_PRESET_OVERWRITE
    );
    vibePresetOverwriteButton?.addEventListener(
      'click',
      overwriteSelectedVibeTransferPreset
    );

    const vibePresetApplyButton = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_PRESET_APPLY
    );
    vibePresetApplyButton?.addEventListener(
      'click',
      applySelectedVibeTransferPreset
    );

    const vibePresetDeleteButton = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_PRESET_DELETE
    );
    vibePresetDeleteButton?.addEventListener(
      'click',
      deleteSelectedVibeTransferPreset
    );

    const vibePresetSelect = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_PRESET_SELECT
    ) as HTMLSelectElement | null;
    vibePresetSelect?.addEventListener('change', () => {
      const presetId = vibePresetSelect.value;
      if (!presetId) {
        clearAppliedVibeTransferPreset();
        return;
      }
      applyVibeTransferPresetById(presetId);
    });

    const vibeReferenceList = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_REFERENCE_LIST
    );
    const vibeManagerList = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_MANAGER_LIST
    );
    const vibeReferenceSearchInput = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_REFERENCE_SEARCH
    );
    const vibeManagerSearchInput = document.getElementById(
      UI_ELEMENT_IDS.VIBE_TRANSFER_MANAGER_SEARCH
    );
    vibeReferenceSearchInput?.addEventListener('input', () => {
      renderVibeTransferReferenceList();
    });
    vibeManagerSearchInput?.addEventListener('input', () => {
      renderVibeTransferManagerList();
    });

    const bindVibeListEvents = (list: HTMLElement | null): void => {
      const handleVibeRangeInput = (
        event: Event,
        options: {render?: boolean} = {}
      ): void => {
        const target = event.target as HTMLElement | null;
        if (
          target instanceof HTMLInputElement &&
          target.dataset.vibeStrengthId
        ) {
          const value = updateVibeItemGenerationParameter(
            target.dataset.vibeStrengthId,
            'strength',
            Number.parseFloat(target.value),
            options
          );
          const valueLabel = target.nextElementSibling;
          if (valueLabel) valueLabel.textContent = formatVibeValue(value);
        }
        if (
          target instanceof HTMLInputElement &&
          target.dataset.vibeInformationId
        ) {
          const value = updateVibeItemGenerationParameter(
            target.dataset.vibeInformationId,
            'information_extracted',
            Number.parseFloat(target.value),
            options
          );
          const valueLabel = target.nextElementSibling;
          if (valueLabel) valueLabel.textContent = formatVibeValue(value);
        }
      };
      list?.addEventListener('click', event => {
        const target = event.target as HTMLElement | null;
        const tagButton = target?.closest<HTMLButtonElement>(
          'button[data-vibe-reference-tag-remove-id]'
        );
        const tagReferenceId = tagButton?.dataset.vibeReferenceTagRemoveId;
        const tag = tagButton?.dataset.vibeReferenceTag;
        if (tagReferenceId && tag) {
          removeVibeTransferReferenceTag(tagReferenceId, tag);
          return;
        }
      });
      list?.addEventListener('input', event => {
        handleVibeRangeInput(event, {render: false});
      });
      list?.addEventListener('change', event => {
        const target = event.target as HTMLElement | null;
        if (
          target instanceof HTMLInputElement &&
          target.dataset.vibeReferenceToggleId
        ) {
          toggleVibeTransferReference(
            target.dataset.vibeReferenceToggleId,
            target.checked
          );
        }
        handleVibeRangeInput(event);
      });
      list?.addEventListener('focusout', event => {
        const target = event.target as HTMLElement | null;
        if (
          target instanceof HTMLInputElement &&
          target.dataset.vibeReferenceNameId
        ) {
          renameVibeTransferReference(
            target.dataset.vibeReferenceNameId,
            target.value
          );
        }
        if (
          target instanceof HTMLInputElement &&
          target.dataset.vibeReferenceTagInputId
        ) {
          addVibeTransferReferenceTags(
            target.dataset.vibeReferenceTagInputId,
            target.value
          );
        }
      });
      list?.addEventListener('keydown', event => {
        const target = event.target as HTMLElement | null;
        if (
          event.key === 'Enter' &&
          target instanceof HTMLInputElement &&
          target.dataset.vibeReferenceTagInputId
        ) {
          event.preventDefault();
          addVibeTransferReferenceTags(
            target.dataset.vibeReferenceTagInputId,
            target.value
          );
        }
      });
    };
    bindVibeListEvents(vibeReferenceList);
    bindVibeListEvents(vibeManagerList);

    // Independent LLM API settings
    const useIndependentLlmApiCheckbox = document.getElementById(
      UI_ELEMENT_IDS.USE_INDEPENDENT_LLM_API
    ) as HTMLInputElement;
    const independentLlmApiUrlInput = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
    ) as HTMLInputElement;
    const independentLlmApiKeyInput = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
    ) as HTMLInputElement;
    const independentLlmModelInput = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
    ) as HTMLInputElement;
    const independentLlmModelSelect = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL_SELECT
    ) as HTMLSelectElement;
    const independentLlmFetchModelsButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_FETCH_MODELS
    );
    const independentLlmTestConnectionButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_TEST_CONNECTION
    );

    useIndependentLlmApiCheckbox?.addEventListener(
      'change',
      handleSettingsChange
    );
    independentLlmApiUrlInput?.addEventListener('change', handleSettingsChange);
    independentLlmApiKeyInput?.addEventListener('change', handleSettingsChange);
    independentLlmModelInput?.addEventListener('change', handleSettingsChange);

    // Model select → sync to text input on change
    independentLlmModelSelect?.addEventListener('change', () => {
      const selectedModel = independentLlmModelSelect.value;
      if (selectedModel && independentLlmModelInput) {
        independentLlmModelInput.value = selectedModel;
        handleSettingsChange();
      }
    });

    independentLlmFetchModelsButton?.addEventListener(
      'click',
      handleFetchModels
    );

    const independentLlmMaxTokensInput = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_MAX_TOKENS
    );
    independentLlmMaxTokensInput?.addEventListener(
      'change',
      handleSettingsChange
    );

    // Context injection checkboxes
    const injectCharDescCheckbox = document.getElementById(
      UI_ELEMENT_IDS.INJECT_CHARACTER_DESCRIPTION
    ) as HTMLInputElement;
    const injectUserPersonaCheckbox = document.getElementById(
      UI_ELEMENT_IDS.INJECT_USER_PERSONA
    ) as HTMLInputElement;
    const injectScenarioCheckbox = document.getElementById(
      UI_ELEMENT_IDS.INJECT_SCENARIO
    ) as HTMLInputElement;
    injectCharDescCheckbox?.addEventListener('change', handleSettingsChange);
    injectUserPersonaCheckbox?.addEventListener('change', handleSettingsChange);
    injectScenarioCheckbox?.addEventListener('change', handleSettingsChange);

    // World info injection
    const injectWorldInfoCheckbox = document.getElementById(
      UI_ELEMENT_IDS.INJECT_WORLD_INFO
    ) as HTMLInputElement;
    injectWorldInfoCheckbox?.addEventListener('change', handleSettingsChange);

    // Content filter tags
    const contentFilterTagsTextarea = document.getElementById(
      UI_ELEMENT_IDS.CONTENT_FILTER_TAGS
    ) as HTMLTextAreaElement;
    const contentFilterTagsResetButton = document.getElementById(
      UI_ELEMENT_IDS.CONTENT_FILTER_TAGS_RESET
    );
    contentFilterTagsTextarea?.addEventListener('change', handleSettingsChange);
    contentFilterTagsResetButton?.addEventListener('click', () => {
      if (contentFilterTagsTextarea) {
        contentFilterTagsTextarea.value =
          DEFAULT_CONTENT_FILTER_TAGS.join('\n');
        handleSettingsChange();
      }
    });

    independentLlmTestConnectionButton?.addEventListener(
      'click',
      handleTestIndependentLlmConnection
    );

    // Independent LLM preset management
    const ilmPresetSelect = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SELECT
    );
    const ilmPresetEditButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_EDIT
    );
    const ilmPresetSaveButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SAVE
    );
    const ilmPresetSaveAsButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SAVE_AS
    );
    const ilmPresetDeleteButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_DELETE
    );
    const ilmPresetCancelButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_CANCEL
    );
    ilmPresetSelect?.addEventListener(
      'change',
      handleIndependentLlmPresetChange
    );
    ilmPresetEditButton?.addEventListener(
      'click',
      handleIndependentLlmPresetEdit
    );
    ilmPresetSaveButton?.addEventListener(
      'click',
      handleIndependentLlmPresetSave
    );
    ilmPresetSaveAsButton?.addEventListener(
      'click',
      handleIndependentLlmPresetSaveAs
    );
    ilmPresetDeleteButton?.addEventListener(
      'click',
      handleIndependentLlmPresetDelete
    );
    ilmPresetCancelButton?.addEventListener(
      'click',
      handleIndependentLlmPresetCancel
    );

    const independentLlmViewLastRequestButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_VIEW_LAST_REQUEST
    );
    independentLlmViewLastRequestButton?.addEventListener(
      'click',
      handleViewLastRequest
    );

    // API Profile management
    const apiProfileSelect = document.getElementById(
      UI_ELEMENT_IDS.API_PROFILE_SELECT
    );
    const apiProfileSaveButton = document.getElementById(
      UI_ELEMENT_IDS.API_PROFILE_SAVE
    );
    const apiProfileDeleteButton = document.getElementById(
      UI_ELEMENT_IDS.API_PROFILE_DELETE
    );
    apiProfileSelect?.addEventListener('change', handleApiProfileChange);
    apiProfileSaveButton?.addEventListener('click', handleApiProfileSave);
    apiProfileDeleteButton?.addEventListener('click', handleApiProfileDelete);

    // Image display width slider
    const imageDisplayWidthInput = document.getElementById(
      UI_ELEMENT_IDS.IMAGE_DISPLAY_WIDTH
    ) as HTMLInputElement;
    // Use 'input' event for live updates while dragging slider
    imageDisplayWidthInput?.addEventListener('input', handleSettingsChange);
    // Also listen to 'change' for compatibility
    imageDisplayWidthInput?.addEventListener('change', handleSettingsChange);

    resetButton?.addEventListener('click', handleResetSettings);

    // Image subfolder label (per-chat, saved to chat metadata)
    const imageSubfolderLabelInput = document.getElementById(
      UI_ELEMENT_IDS.IMAGE_SUBFOLDER_LABEL
    ) as HTMLInputElement;
    imageSubfolderLabelInput?.addEventListener('change', () => {
      const label = imageSubfolderLabelInput.value.trim();
      try {
        const metadata = getMetadata();
        metadata.imageSubfolderLabel = label || undefined;
        saveMetadata();
        setImageSubfolderLabel(label || null);
        logger.info(`Image subfolder label updated: "${label || '(default)'}"`);
      } catch (error) {
        logger.warn('Could not save subfolder label (no active chat?):', error);
      }
    });

    // Update UI with loaded settings
    updateUI();

    // Check for updates (non-blocking)
    checkForUpdates().catch(error => {
      logger.debug('Update check failed:', error);
    });
    checkServerPluginStatus().catch(error => {
      logger.debug('Server plugin status check failed:', error);
    });

    // Register world info event listeners and initialize panel (non-blocking)
    registerWorldInfoEventListeners();
    initializeWorldInfoPanel().catch(error => {
      logger.warn('World info panel initialization failed:', error);
    });

    // Initialize character fixed tags panel
    initializeCharacterTagsPanel(settings, () =>
      saveSettings(settings, context)
    );

    // Initialize standalone generation panel
    try {
      const standaloneMetadata = getMetadata();
      initializeStandaloneGeneration(context, settings, standaloneMetadata);
    } catch {
      // No active chat - initialize without metadata
      initializeStandaloneGeneration(context, settings, undefined);
    }

    // Initialize prompt library panel
    initializePromptLibrary(context, settings);

    // Initialize prompt personalization panels
    initializeTagCatalog(settings, () => saveSettings(settings, context));
    initializeRegexSanitizerPanel(context);
    initializePresetImport(
      context,
      settings,
      () => saveSettings(settings, context),
      updateUI
    );

    // Mount the floating panel after all source controls and submodules are ready.
    initializeFloatingPanel();
    setFloatingPanelLauncherVisible(settings.showFloatingPanelLauncher);
  }

  logger.info('Extension initialized successfully');

  // Note: CHAT_CHANGED is now handled by chat_changed_handler module
  // which orchestrates all chat change operations in the correct order

  // Add click handlers to existing images
  addImageClickHandlers(settings);
  extensionInitialized = true;

  // Run startup cleanup for expired images
  try {
    const metadata = getMetadata();
    runStartupCleanup(context, metadata, settings);
  } catch (error) {
    logger.warn('Startup cleanup skipped (metadata not ready):', error);
  }
}

// Initialize when extension loads
initialize();

// Expose gallery toggle function globally for easy access
// Users can call window.toggleImageGallery() from console
(window as any).toggleImageGallery = () => {
  const gallery = getGalleryWidget();
  if (gallery) {
    gallery.toggleVisibility();
    logger.info('Gallery visibility toggled via global function');
  } else {
    logger.warn('Gallery widget not initialized');
  }
};

// Expose gallery show function
(window as any).showImageGallery = () => {
  const gallery = getGalleryWidget();
  if (gallery) {
    gallery.show();
    logger.info('Gallery shown via global function');
  } else {
    logger.warn('Gallery widget not initialized');
  }
};

// Expose gallery hide function
(window as any).hideImageGallery = () => {
  const gallery = getGalleryWidget();
  if (gallery) {
    gallery.hide();
    logger.info('Gallery hidden via global function');
  } else {
    logger.warn('Gallery widget not initialized');
  }
};
