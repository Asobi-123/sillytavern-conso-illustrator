/**
 * Prompt Library UI Module
 * Provides a library for storing, searching, and managing prompts
 * extracted from NovelAI PNG images.
 */

import {
  UI_ELEMENT_IDS,
  EXTENSION_NAME,
  PROMPT_LIBRARY_MAX_ENTRIES,
} from './constants';
import {t} from './i18n';
import {createLogger} from './logger';
import {htmlEncode} from './utils/dom_utils';
import {
  parsePngMetadata,
  generateThumbnail,
} from './services/png_metadata_parser';
import type {PromptLibraryEntry, NovelAiParameters} from './types';

const logger = createLogger('PromptLibrary');
let promptLibraryInitialized = false;

/** Current editing entry id, null if not editing */
let editingEntryId: string | null = null;

// ===========================================================================
// Settings access helpers
// ===========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedContext: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getContext(): any {
  if (!cachedContext) {
    throw new Error('PromptLibrary not initialized');
  }
  return cachedContext;
}

function getEntries(): PromptLibraryEntry[] {
  const ctx = getContext();
  const settings = ctx.extensionSettings[EXTENSION_NAME] as Record<
    string,
    unknown
  >;
  return (settings?.promptLibraryEntries as PromptLibraryEntry[]) ?? [];
}

function setEntries(entries: PromptLibraryEntry[]): void {
  const ctx = getContext();
  const settings = ctx.extensionSettings[EXTENSION_NAME] as Record<
    string,
    unknown
  >;
  if (settings) {
    settings.promptLibraryEntries = entries;
    ctx.saveSettingsDebounced();
  }
}

function getMaxEntries(): number {
  const ctx = getContext();
  const settings = ctx.extensionSettings[EXTENSION_NAME] as Record<
    string,
    unknown
  >;
  return (
    (settings?.promptLibraryMaxEntries as number) ??
    PROMPT_LIBRARY_MAX_ENTRIES.DEFAULT
  );
}

function getSaveThumbnail(): boolean {
  const ctx = getContext();
  const settings = ctx.extensionSettings[EXTENSION_NAME] as Record<
    string,
    unknown
  >;
  return (settings?.promptLibrarySaveThumbnail as boolean) ?? true;
}

// ===========================================================================
// Toast helper (lightweight, uses SillyTavern's toastr if available)
// ===========================================================================

function showToast(
  message: string,
  type: 'info' | 'success' | 'error' | 'warning' = 'info'
): void {
  const toastr = (window as unknown as Record<string, unknown>)['toastr'] as
    | Record<string, (msg: string) => void>
    | undefined;
  if (toastr && typeof toastr[type] === 'function') {
    toastr[type](message);
  } else {
    logger.info(`[Toast/${type}] ${message}`);
  }
}

// ===========================================================================
// HTML Content
// ===========================================================================

/**
 * Creates the HTML content for the prompt library panel.
 */
export function createPromptLibraryContent(): string {
  return `
    <div class="prompt-library-container">
      <div class="prompt-library-upload-zone" id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_UPLOAD}">
        <i class="fa-solid fa-cloud-arrow-up" style="font-size: 1.5rem; opacity: 0.5;"></i>
        <span>${t('promptLibrary.uploadHint')}</span>
        <input id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_UPLOAD_INPUT}" type="file" accept=".png" multiple style="display:none;" />
      </div>

      <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
        <input id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_SEARCH}" class="text_pole" type="search"
               placeholder="${t('promptLibrary.searchPlaceholder')}" style="flex: 1;" />
        <span id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_COUNT}" style="font-size: 0.8rem; opacity: 0.6; white-space: nowrap;"></span>
      </div>

      <div id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_LIST}" class="prompt-library-list"></div>

      <div id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_OVERLAY}" class="prompt-library-edit-overlay" style="display:none;">
        <div class="prompt-library-edit-panel">
          <div class="prompt-library-edit-header">
            <strong>${t('promptLibrary.editTitle')}</strong>
            <button id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_CANCEL}" class="ai-floating-panel-icon-btn">&times;</button>
          </div>
          <label>
            <span>${t('promptLibrary.name')}</span>
            <input id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_NAME}" class="text_pole" type="text"
                   placeholder="${t('promptLibrary.namePlaceholder')}" />
          </label>
          <label>
            <span>${t('promptLibrary.positivePrompt')}</span>
            <textarea id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_POSITIVE}" class="text_pole textarea_compact" rows="6"></textarea>
          </label>
          <label>
            <span>${t('promptLibrary.negativePrompt')}</span>
            <textarea id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_NEGATIVE}" class="text_pole textarea_compact" rows="4"></textarea>
          </label>
          <label>
            <span>${t('promptLibrary.characterPrompt')}</span>
            <textarea id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_CHARACTER}" class="text_pole textarea_compact" rows="3"
                      placeholder="${t('promptLibrary.characterPromptPlaceholder')}"></textarea>
          </label>
          <label>
            <span>${t('promptLibrary.tags')}</span>
            <input id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_TAGS}" class="text_pole" type="text"
                   placeholder="${t('promptLibrary.tagsPlaceholder')}" />
          </label>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem;">
            <button id="${UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_SAVE}" class="menu_button">
              <i class="fa-solid fa-check"></i> ${t('promptLibrary.save')}
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

// ===========================================================================
// Rendering
// ===========================================================================

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

function formatParamBadges(params: NovelAiParameters): string {
  const badges: string[] = [];
  if (params.width && params.height) {
    badges.push(`${params.width}×${params.height}`);
  }
  if (params.steps) badges.push(`${params.steps} steps`);
  if (params.sampler) badges.push(String(params.sampler));
  if (params.scale) badges.push(`CFG ${params.scale}`);
  if (params.seed !== undefined && params.seed !== null)
    badges.push(`seed: ${params.seed}`);
  return badges
    .map(
      b => `<span class="prompt-library-param-badge">${htmlEncode(b)}</span>`
    )
    .join('');
}

function renderEntryCard(entry: PromptLibraryEntry): string {
  const thumbHtml = entry.thumbnail
    ? `<img class="prompt-library-card-thumb" src="${entry.thumbnail}" alt="" loading="lazy" />`
    : '<div class="prompt-library-card-thumb-placeholder"><i class="fa-regular fa-image"></i></div>';

  const tagsHtml = entry.tags.length
    ? `<div class="prompt-library-card-tags">${entry.tags.map(tag => `<span class="prompt-library-tag" data-tag="${htmlEncode(tag)}">${htmlEncode(tag)}</span>`).join('')}</div>`
    : '';

  return `
    <div class="prompt-library-card" data-entry-id="${entry.id}">
      <div class="prompt-library-card-top">
        <div class="prompt-library-card-left">
          ${thumbHtml}
        </div>
        <div class="prompt-library-card-body">
          <div class="prompt-library-card-title">${htmlEncode(entry.name)}</div>
          <div class="prompt-library-card-preview">${htmlEncode(truncate(entry.positivePrompt, 120))}</div>
          ${tagsHtml}
          <div class="prompt-library-card-params">${formatParamBadges(entry.parameters)}</div>
        </div>
      </div>
      <div class="prompt-library-card-actions">
        <button class="menu_button menu_button_icon" data-action="copy-positive" title="${t('promptLibrary.copyPositive')}">
          <i class="fa-regular fa-copy"></i><small>+</small>
        </button>
        <button class="menu_button menu_button_icon" data-action="copy-negative" title="${t('promptLibrary.copyNegative')}">
          <i class="fa-regular fa-copy"></i><small>&minus;</small>
        </button>
        <button class="menu_button menu_button_icon" data-action="copy-character" title="${t('promptLibrary.copyCharacter')}">
          <i class="fa-regular fa-copy"></i><small>C</small>
        </button>
        <button class="menu_button menu_button_icon" data-action="send-standalone" title="${t('promptLibrary.sendToStandalone')}">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
        <button class="menu_button menu_button_icon" data-action="edit" title="${t('promptLibrary.edit')}">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="menu_button menu_button_icon" data-action="delete" title="${t('promptLibrary.delete')}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`;
}

function renderEntries(filter?: string): void {
  const listEl = document.getElementById(UI_ELEMENT_IDS.PROMPT_LIBRARY_LIST);
  const countEl = document.getElementById(UI_ELEMENT_IDS.PROMPT_LIBRARY_COUNT);
  if (!listEl) return;

  const entries = getEntries();
  const maxEntries = getMaxEntries();

  // Update count
  if (countEl) {
    countEl.textContent = t('promptLibrary.entryCount', {
      count: entries.length,
      max: maxEntries,
    });
  }

  if (entries.length === 0) {
    listEl.innerHTML = `<div class="prompt-library-empty">${t('promptLibrary.noEntries')}</div>`;
    return;
  }

  // Filter
  let filtered = entries;
  if (filter) {
    const lower = filter.toLowerCase();
    filtered = entries.filter(
      e =>
        e.name.toLowerCase().includes(lower) ||
        e.positivePrompt.toLowerCase().includes(lower) ||
        e.negativePrompt.toLowerCase().includes(lower) ||
        e.tags.some(tag => tag.toLowerCase().includes(lower))
    );
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="prompt-library-empty">${t('promptLibrary.noMatch')}</div>`;
    return;
  }

  // Sort newest first
  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
  listEl.innerHTML = sorted.map(renderEntryCard).join('');
}

// ===========================================================================
// File upload handling
// ===========================================================================

async function handleFiles(files: FileList | File[]): Promise<void> {
  const entries = getEntries();
  const maxEntries = getMaxEntries();
  const saveThumbnail = getSaveThumbnail();
  let importCount = 0;

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/png') && !file.name.endsWith('.png')) {
      showToast(t('toast.promptLibraryNotPng'), 'warning');
      continue;
    }

    if (entries.length + importCount >= maxEntries) {
      showToast(t('toast.promptLibraryFull', {max: maxEntries}), 'warning');
      break;
    }

    try {
      const result = await parsePngMetadata(file);
      if (!result.found) {
        showToast(t('toast.promptLibraryNoMetadata'), 'warning');
        continue;
      }

      let thumbnail: string | undefined;
      if (saveThumbnail) {
        try {
          thumbnail = await generateThumbnail(file);
        } catch (err) {
          logger.warn('Failed to generate thumbnail:', err);
        }
      }

      const now = Date.now();
      const entry: PromptLibraryEntry = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.png$/i, ''),
        positivePrompt: result.positivePrompt,
        negativePrompt: result.negativePrompt,
        parameters: result.parameters,
        thumbnail,
        tags: [],
        characterPrompt: '',
        createdAt: now,
        updatedAt: now,
      };

      entries.push(entry);
      importCount++;
    } catch (err) {
      logger.error('Failed to parse PNG:', err);
      showToast(t('toast.promptLibraryNoMetadata'), 'error');
    }
  }

  if (importCount > 0) {
    setEntries(entries);
    showToast(
      t('toast.promptLibraryImported', {count: importCount}),
      'success'
    );
    renderEntries(getSearchFilter());
  }
}

// ===========================================================================
// Clipboard
// ===========================================================================

async function copyToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    showToast(t('toast.promptLibraryCopied'), 'success');
  } catch {
    showToast(t('toast.promptLibraryCopyFailed'), 'error');
  }
}

// ===========================================================================
// Send to standalone
// ===========================================================================

function sendToStandalone(prompt: string): void {
  const manualInput = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_MANUAL_PROMPT_INPUT
  ) as HTMLTextAreaElement | null;
  const manualRadio = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_MODE_MANUAL
  ) as HTMLInputElement | null;

  // Switch to manual mode
  if (manualRadio && !manualRadio.checked) {
    manualRadio.checked = true;
    manualRadio.dispatchEvent(new Event('change', {bubbles: true}));
  }

  // Fill the input
  if (manualInput) {
    manualInput.value = prompt;
    manualInput.dispatchEvent(new Event('input', {bubbles: true}));
  }

  showToast(t('toast.promptLibrarySentToStandalone'), 'success');

  // Switch to standalone tab
  const standaloneTab = document.querySelector<HTMLButtonElement>(
    '.ai-floating-panel-tab[data-panel-tab="standalone"]'
  );
  if (standaloneTab) {
    standaloneTab.click();
  }
}

// ===========================================================================
// Edit overlay
// ===========================================================================

function openEditOverlay(entryId: string): void {
  const entries = getEntries();
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return;

  editingEntryId = entryId;

  const overlay = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_OVERLAY
  );
  const nameInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_NAME
  ) as HTMLInputElement | null;
  const positiveInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_POSITIVE
  ) as HTMLTextAreaElement | null;
  const negativeInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_NEGATIVE
  ) as HTMLTextAreaElement | null;
  const tagsInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_TAGS
  ) as HTMLInputElement | null;
  const characterInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_CHARACTER
  ) as HTMLTextAreaElement | null;

  if (nameInput) nameInput.value = entry.name;
  if (positiveInput) positiveInput.value = entry.positivePrompt;
  if (negativeInput) negativeInput.value = entry.negativePrompt;
  if (characterInput) characterInput.value = entry.characterPrompt || '';
  if (tagsInput) tagsInput.value = entry.tags.join(', ');
  if (overlay) overlay.style.display = 'flex';
}

function closeEditOverlay(): void {
  editingEntryId = null;
  const overlay = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_OVERLAY
  );
  if (overlay) overlay.style.display = 'none';
}

function saveEdit(): void {
  if (!editingEntryId) return;

  const entries = getEntries();
  const entry = entries.find(e => e.id === editingEntryId);
  if (!entry) return;

  const nameInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_NAME
  ) as HTMLInputElement | null;
  const positiveInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_POSITIVE
  ) as HTMLTextAreaElement | null;
  const negativeInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_NEGATIVE
  ) as HTMLTextAreaElement | null;
  const tagsInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_TAGS
  ) as HTMLInputElement | null;
  const characterInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_CHARACTER
  ) as HTMLTextAreaElement | null;

  if (nameInput) entry.name = nameInput.value.trim() || entry.name;
  if (positiveInput) entry.positivePrompt = positiveInput.value;
  if (negativeInput) entry.negativePrompt = negativeInput.value;
  if (characterInput) entry.characterPrompt = characterInput.value;
  if (tagsInput) {
    entry.tags = tagsInput.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  entry.updatedAt = Date.now();

  setEntries(entries);
  closeEditOverlay();
  showToast(t('toast.promptLibrarySaved'), 'success');
  renderEntries(getSearchFilter());
}

// ===========================================================================
// Delete
// ===========================================================================

function deleteEntry(entryId: string): void {
  const entries = getEntries();
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return;

  const confirmed = confirm(
    t('promptLibrary.deleteConfirm', {name: entry.name})
  );
  if (!confirmed) return;

  const filtered = entries.filter(e => e.id !== entryId);
  setEntries(filtered);
  showToast(t('toast.promptLibraryDeleted'), 'success');
  renderEntries(getSearchFilter());
}

// ===========================================================================
// Search
// ===========================================================================

function getSearchFilter(): string | undefined {
  const input = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_SEARCH
  ) as HTMLInputElement | null;
  return input?.value?.trim() || undefined;
}

// ===========================================================================
// Event delegation
// ===========================================================================

function handleListClick(e: Event): void {
  const target = e.target as HTMLElement;

  // Find the closest action button
  const actionBtn = target.closest<HTMLButtonElement>('[data-action]');
  if (!actionBtn) return;

  // Find the card this button belongs to
  const card = actionBtn.closest<HTMLElement>('[data-entry-id]');
  if (!card) return;

  const entryId = card.dataset.entryId!;
  const action = actionBtn.dataset.action;
  const entries = getEntries();
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return;

  switch (action) {
    case 'copy-positive':
      copyToClipboard(entry.positivePrompt);
      break;
    case 'copy-negative':
      copyToClipboard(entry.negativePrompt);
      break;
    case 'copy-character':
      copyToClipboard(entry.characterPrompt || '');
      break;
    case 'send-standalone':
      sendToStandalone(entry.positivePrompt);
      break;
    case 'edit':
      openEditOverlay(entryId);
      break;
    case 'delete':
      deleteEntry(entryId);
      break;
  }
}

function handleTagClick(e: Event): void {
  const target = e.target as HTMLElement;
  const tagEl = target.closest<HTMLElement>('.prompt-library-tag');
  if (!tagEl) return;

  const tag = tagEl.dataset.tag;
  if (!tag) return;

  const searchInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_SEARCH
  ) as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = tag;
    searchInput.dispatchEvent(new Event('input', {bubbles: true}));
  }
}

// ===========================================================================
// Initialization
// ===========================================================================

/**
 * Initializes the prompt library event listeners and renders initial state.
 */
export function initializePromptLibrary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _settings: any
): void {
  if (promptLibraryInitialized) {
    logger.debug('Prompt library already initialized, skipping');
    return;
  }

  cachedContext = context;

  // Upload zone: click to open file picker
  const uploadZone = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_UPLOAD
  );
  const uploadInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_UPLOAD_INPUT
  ) as HTMLInputElement | null;

  if (uploadZone && uploadInput) {
    uploadZone.addEventListener('click', e => {
      // Don't trigger if clicking the input itself
      if (e.target === uploadInput) return;
      uploadInput.click();
    });

    uploadInput.addEventListener('change', () => {
      if (uploadInput.files && uploadInput.files.length > 0) {
        handleFiles(uploadInput.files);
        uploadInput.value = ''; // Reset for re-upload
      }
    });

    // Drag and drop — stopPropagation prevents SillyTavern's global
    // drop handler from trying to import the PNG as a character card.
    uploadZone.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', e => {
      e.stopPropagation();
      uploadZone.classList.remove('drag-over');
    });
    uploadZone.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.remove('drag-over');
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    });
  }

  // Search
  const searchInput = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_SEARCH
  ) as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderEntries(searchInput.value.trim() || undefined);
    });
  }

  // List event delegation (actions + tag clicks)
  const listEl = document.getElementById(UI_ELEMENT_IDS.PROMPT_LIBRARY_LIST);
  if (listEl) {
    listEl.addEventListener('click', handleListClick);
    listEl.addEventListener('click', handleTagClick);
  }

  // Edit overlay: save + cancel
  const editSave = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_SAVE
  );
  const editCancel = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_LIBRARY_EDIT_CANCEL
  );
  if (editSave) editSave.addEventListener('click', saveEdit);
  if (editCancel) editCancel.addEventListener('click', closeEditOverlay);

  // Initial render
  renderEntries();

  logger.info('Prompt library initialized');
  promptLibraryInitialized = true;
}
