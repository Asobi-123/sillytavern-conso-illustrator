/**
 * World Info UI Module
 * Renders the world book selection panel and handles interactions.
 */

import {createLogger} from './logger';
import {UI_ELEMENT_IDS} from './constants';
import {t} from './i18n';
import {getMetadata, saveMetadata} from './metadata';
import {
  fetchAllWorldBookNames,
  fetchWorldBookEntries,
  getCharacterWorldBookName,
  clearWorldBookCache,
} from './services/worldinfo_service';
import type {PluginWorldInfoConfig} from './types';

const logger = createLogger('WorldInfoUI');

/** All available world book names */
let allWorldBookNames: string[] = [];

/** Currently expanded book (only one at a time) */
let expandedBookName: string | null = null;
let worldInfoEventListenersRegistered = false;

/**
 * Gets or creates worldInfoConfig from current chat metadata.
 */
function getOrCreateConfig(): PluginWorldInfoConfig {
  const metadata = getMetadata();
  if (!metadata.worldInfoConfig) {
    metadata.worldInfoConfig = {
      selectedWorldBooks: [],
      worldBookOverrides: {},
    };
  }
  return metadata.worldInfoConfig;
}

/**
 * Counts enabled entries for a given book.
 */
function countEnabledEntries(
  config: PluginWorldInfoConfig,
  bookName: string
): number {
  const overrides = config.worldBookOverrides[bookName]?.entryOverrides ?? {};
  return Object.values(overrides).filter(v => v === true).length;
}

/**
 * Performs auto-initialization: adds the character's bound world book
 * if not already initialized for this chat.
 */
function autoInitialize(config: PluginWorldInfoConfig): boolean {
  if (config.initialized) return false;

  config.initialized = true;
  const charBook = getCharacterWorldBookName();
  if (charBook && !config.selectedWorldBooks.includes(charBook)) {
    config.selectedWorldBooks.push(charBook);
    config.worldBookOverrides[charBook] = {entryOverrides: {}};
    logger.info(`Auto-added character world book: "${charBook}"`);
    return true;
  }
  return false;
}

/**
 * Initializes the world info panel by fetching the book list.
 * Call after settings UI is mounted.
 */
export async function initializeWorldInfoPanel(): Promise<void> {
  try {
    allWorldBookNames = await fetchAllWorldBookNames();
    logger.info(`Loaded ${allWorldBookNames.length} world book names`);

    // Auto-initialize for current chat
    try {
      const config = getOrCreateConfig();
      if (autoInitialize(config)) {
        saveMetadata();
      }
    } catch {
      // No active chat yet — skip auto-init
    }

    renderWorldBookList();
  } catch (error) {
    logger.error('Failed to initialize world info panel:', error);
    const listContainer = document.getElementById(
      UI_ELEMENT_IDS.WORLD_INFO_BOOK_LIST
    );
    if (listContainer) {
      listContainer.innerHTML = `<div class="world-info-empty">${t('toast.worldInfoFetchFailed', {error: String(error)})}</div>`;
    }
  }
}

/**
 * Renders the world book list with optional search filter.
 */
export function renderWorldBookList(filter?: string): void {
  const listContainer = document.getElementById(
    UI_ELEMENT_IDS.WORLD_INFO_BOOK_LIST
  );
  if (!listContainer) return;

  let config: PluginWorldInfoConfig;
  try {
    config = getOrCreateConfig();
  } catch {
    listContainer.innerHTML = '';
    return;
  }

  const charBook = getCharacterWorldBookName();
  const filterLower = filter?.toLowerCase().trim();

  const filteredBooks = filterLower
    ? allWorldBookNames.filter(name => name.toLowerCase().includes(filterLower))
    : allWorldBookNames;

  if (allWorldBookNames.length === 0) {
    listContainer.innerHTML = `<div class="world-info-empty">${t('settings.worldInfoNoBooks')}</div>`;
    return;
  }

  if (filteredBooks.length === 0) {
    listContainer.innerHTML = `<div class="world-info-empty">${t('settings.worldInfoNoBooksMatch')}</div>`;
    return;
  }

  // Sort: selected books first, then character book, then alphabetical
  const sorted = [...filteredBooks].sort((a, b) => {
    const aSelected = config.selectedWorldBooks.includes(a) ? 0 : 1;
    const bSelected = config.selectedWorldBooks.includes(b) ? 0 : 1;
    if (aSelected !== bSelected) return aSelected - bSelected;
    const aChar = a === charBook ? 0 : 1;
    const bChar = b === charBook ? 0 : 1;
    if (aChar !== bChar) return aChar - bChar;
    return a.localeCompare(b);
  });

  let html = '';
  for (const bookName of sorted) {
    const isSelected = config.selectedWorldBooks.includes(bookName);
    const isCharBook = bookName === charBook;
    const enabledCount = countEnabledEntries(config, bookName);
    const isExpanded = expandedBookName === bookName;

    const charBadge = isCharBook
      ? `<span class="world-info-char-badge">${t('settings.worldInfoCharBadge')}</span>`
      : '';

    html += `
      <div class="world-info-book-item${isSelected ? ' selected' : ''}" data-book-name="${escapeAttr(bookName)}">
        <div class="world-info-book-header">
          <label class="checkbox_label world-info-book-checkbox">
            <input type="checkbox" data-action="toggle-book" data-book="${escapeAttr(bookName)}" ${isSelected ? 'checked' : ''} />
            <span>${escapeHtml(bookName)}</span>
            ${charBadge}
          </label>
          <span class="world-info-entry-count" data-count-for="${escapeAttr(bookName)}">(${enabledCount}/…)</span>
          <button class="world-info-expand-btn menu_button_icon" data-action="expand-book" data-book="${escapeAttr(bookName)}" title="${isExpanded ? 'Collapse' : 'Expand'}">
            <i class="fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}"></i>
          </button>
        </div>
        <div class="world-info-entries-container" data-entries-for="${escapeAttr(bookName)}" style="display: ${isExpanded ? 'block' : 'none'};">
          ${isExpanded ? '<div class="world-info-loading">' + t('settings.worldInfoLoading') + '</div>' : ''}
        </div>
      </div>
    `;
  }

  listContainer.innerHTML = html;

  // If a book is expanded, load its entries
  if (expandedBookName) {
    loadAndRenderEntries(expandedBookName);
  }
}

/**
 * Loads entries for a book and renders them into the entries container.
 */
async function loadAndRenderEntries(
  bookName: string,
  filter?: string
): Promise<void> {
  const container = document.querySelector(
    `[data-entries-for="${CSS.escape(bookName)}"]`
  ) as HTMLElement | null;
  if (!container) return;

  let config: PluginWorldInfoConfig;
  try {
    config = getOrCreateConfig();
  } catch {
    return;
  }

  try {
    const entries = await fetchWorldBookEntries(bookName);

    // Update the entry count display
    const enabledCount = countEnabledEntries(config, bookName);
    const countEl = document.querySelector(
      `[data-count-for="${CSS.escape(bookName)}"]`
    );
    if (countEl) {
      countEl.textContent = `(${t('settings.worldInfoEntriesCount', {enabled: String(enabledCount), total: String(entries.length)})})`;
    }

    if (entries.length === 0) {
      container.innerHTML = `<div class="world-info-empty">${t('settings.worldInfoNoEntries')}</div>`;
      return;
    }

    const filterLower = filter?.toLowerCase().trim();
    const filteredEntries = filterLower
      ? entries.filter(
          e =>
            e.comment.toLowerCase().includes(filterLower) ||
            e.content.toLowerCase().includes(filterLower) ||
            e.key.some(k => k.toLowerCase().includes(filterLower))
        )
      : entries;

    if (filteredEntries.length === 0) {
      container.innerHTML = `<div class="world-info-empty">${t('settings.worldInfoNoEntriesMatch')}</div>`;
      return;
    }

    const overrides = config.worldBookOverrides[bookName]?.entryOverrides ?? {};

    let html = `
      <div class="world-info-entry-toolbar">
        <input type="text" class="text_pole world-info-entry-search" data-action="search-entries" data-book="${escapeAttr(bookName)}" placeholder="${t('settings.worldInfoSearchEntryPlaceholder')}" />
        <button class="menu_button_icon" data-action="select-all-entries" data-book="${escapeAttr(bookName)}" title="${t('settings.worldInfoSelectAll')}">
          <i class="fa-solid fa-check-double"></i>
        </button>
        <button class="menu_button_icon" data-action="deselect-all-entries" data-book="${escapeAttr(bookName)}" title="${t('settings.worldInfoDeselectAll')}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;

    for (const entry of filteredEntries) {
      const isEnabled = overrides[entry.uid] === true;
      const title = entry.comment || `Entry #${entry.uid}`;
      const keyStr =
        entry.key.length > 0
          ? `<span class="world-info-entry-keys">[${escapeHtml(entry.key.join(', '))}]</span>`
          : '';
      const constantBadge = entry.constant
        ? '<span class="world-info-constant-badge">C</span>'
        : '';

      html += `
        <div class="world-info-entry-item${isEnabled ? ' enabled' : ''}">
          <label class="checkbox_label">
            <input type="checkbox" data-action="toggle-entry" data-book="${escapeAttr(bookName)}" data-uid="${entry.uid}" ${isEnabled ? 'checked' : ''} />
            <span>${escapeHtml(title)}</span>
            ${constantBadge}
            ${keyStr}
          </label>
        </div>
      `;
    }

    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div class="world-info-empty">${t('toast.worldInfoFetchFailed', {error: String(error)})}</div>`;
    logger.error(`Failed to load entries for "${bookName}":`, error);
  }
}

/**
 * Toggle world info panel visibility based on master toggle state.
 */
export function toggleWorldInfoPanelVisibility(enabled: boolean): void {
  const panel = document.getElementById(UI_ELEMENT_IDS.WORLD_INFO_PANEL);
  if (panel) {
    panel.style.display = enabled ? 'block' : 'none';
  }
}

/**
 * Reloads world info UI for the current chat.
 * Call on CHAT_CHANGED.
 */
export function reloadWorldInfoForChat(): void {
  expandedBookName = null;

  try {
    const config = getOrCreateConfig();
    if (autoInitialize(config)) {
      saveMetadata();
    }
  } catch {
    // No active chat
  }

  renderWorldBookList();
}

/**
 * Registers event delegation on the world info containers.
 * Call once after settings HTML is inserted.
 */
export function registerWorldInfoEventListeners(): void {
  if (worldInfoEventListenersRegistered) {
    logger.debug('World info event listeners already registered, skipping');
    return;
  }

  // Book list click delegation
  const bookList = document.getElementById(UI_ELEMENT_IDS.WORLD_INFO_BOOK_LIST);
  if (bookList) {
    bookList.addEventListener('click', handleBookListClick);
    bookList.addEventListener('change', handleBookListChange);
    bookList.addEventListener('input', handleBookListInput);
  }

  // Search box
  const searchInput = document.getElementById(UI_ELEMENT_IDS.WORLD_INFO_SEARCH);
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const value = (searchInput as HTMLInputElement).value;
      renderWorldBookList(value || undefined);
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById(UI_ELEMENT_IDS.WORLD_INFO_REFRESH);
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      clearWorldBookCache();
      try {
        allWorldBookNames = await fetchAllWorldBookNames();
        expandedBookName = null;
        renderWorldBookList();
        toastr.success(t('toast.worldInfoRefreshed'), t('extensionName'));
      } catch (error) {
        toastr.error(
          t('toast.worldInfoFetchFailed', {error: String(error)}),
          t('extensionName')
        );
      }
    });
  }

  worldInfoEventListenersRegistered = true;
}

/**
 * Handles click events via delegation on the book list.
 */
function handleBookListClick(e: Event): void {
  const target = e.target as HTMLElement;

  // Expand/collapse button
  const expandBtn = target.closest(
    '[data-action="expand-book"]'
  ) as HTMLElement;
  if (expandBtn) {
    const bookName = expandBtn.dataset.book!;
    expandedBookName = expandedBookName === bookName ? null : bookName;
    renderWorldBookList(getSearchFilter());
    return;
  }

  // Select all entries
  const selectAllBtn = target.closest(
    '[data-action="select-all-entries"]'
  ) as HTMLElement;
  if (selectAllBtn) {
    toggleAllEntries(selectAllBtn.dataset.book!, true);
    return;
  }

  // Deselect all entries
  const deselectAllBtn = target.closest(
    '[data-action="deselect-all-entries"]'
  ) as HTMLElement;
  if (deselectAllBtn) {
    toggleAllEntries(deselectAllBtn.dataset.book!, false);
    return;
  }
}

/**
 * Handles change events (checkboxes) via delegation.
 */
function handleBookListChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  if (target.type !== 'checkbox') return;

  const action = target.dataset.action;
  const bookName = target.dataset.book;

  if (action === 'toggle-book' && bookName) {
    handleToggleBook(bookName, target.checked);
  } else if (action === 'toggle-entry' && bookName) {
    const uid = parseInt(target.dataset.uid!, 10);
    handleToggleEntry(bookName, uid, target.checked);
  }
}

/**
 * Handles input events (entry search) via delegation.
 */
function handleBookListInput(e: Event): void {
  const target = e.target as HTMLInputElement;
  if (target.dataset.action === 'search-entries') {
    const bookName = target.dataset.book!;
    loadAndRenderEntries(bookName, target.value || undefined);
  }
}

/**
 * Toggles a world book selection.
 */
function handleToggleBook(bookName: string, checked: boolean): void {
  let config: PluginWorldInfoConfig;
  try {
    config = getOrCreateConfig();
  } catch {
    return;
  }

  if (checked) {
    if (!config.selectedWorldBooks.includes(bookName)) {
      config.selectedWorldBooks.push(bookName);
    }
    if (!config.worldBookOverrides[bookName]) {
      config.worldBookOverrides[bookName] = {entryOverrides: {}};
    }
  } else {
    config.selectedWorldBooks = config.selectedWorldBooks.filter(
      n => n !== bookName
    );
    delete config.worldBookOverrides[bookName];
  }

  saveMetadata();
  logger.info(
    `World book "${bookName}" ${checked ? 'selected' : 'deselected'}`
  );
}

/**
 * Toggles a single entry override.
 */
function handleToggleEntry(
  bookName: string,
  uid: number,
  checked: boolean
): void {
  let config: PluginWorldInfoConfig;
  try {
    config = getOrCreateConfig();
  } catch {
    return;
  }

  if (!config.worldBookOverrides[bookName]) {
    config.worldBookOverrides[bookName] = {entryOverrides: {}};
  }
  const overrides = config.worldBookOverrides[bookName].entryOverrides;

  if (checked) {
    overrides[uid] = true;
  } else {
    delete overrides[uid];
  }

  saveMetadata();

  // Update count display
  const enabledCount = countEnabledEntries(config, bookName);
  const countEl = document.querySelector(
    `[data-count-for="${CSS.escape(bookName)}"]`
  );
  if (countEl) {
    // Retrieve total from the entries container child count
    const container = document.querySelector(
      `[data-entries-for="${CSS.escape(bookName)}"]`
    );
    const totalItems =
      container?.querySelectorAll('.world-info-entry-item').length ?? 0;
    countEl.textContent = `(${t('settings.worldInfoEntriesCount', {enabled: String(enabledCount), total: String(totalItems)})})`;
  }
}

/**
 * Selects or deselects all entries for a book.
 */
async function toggleAllEntries(
  bookName: string,
  enable: boolean
): Promise<void> {
  let config: PluginWorldInfoConfig;
  try {
    config = getOrCreateConfig();
  } catch {
    return;
  }

  try {
    const entries = await fetchWorldBookEntries(bookName);
    if (!config.worldBookOverrides[bookName]) {
      config.worldBookOverrides[bookName] = {entryOverrides: {}};
    }
    const overrides = config.worldBookOverrides[bookName].entryOverrides;

    for (const entry of entries) {
      if (enable) {
        overrides[entry.uid] = true;
      } else {
        delete overrides[entry.uid];
      }
    }

    saveMetadata();
    // Re-render entries to update checkboxes
    loadAndRenderEntries(bookName);
  } catch (error) {
    logger.error(`Failed to toggle all entries for "${bookName}":`, error);
  }
}

/**
 * Gets the current search filter value.
 */
function getSearchFilter(): string | undefined {
  const searchInput = document.getElementById(
    UI_ELEMENT_IDS.WORLD_INFO_SEARCH
  ) as HTMLInputElement | null;
  return searchInput?.value || undefined;
}

/** Escapes a string for use in HTML attribute values. */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escapes a string for use in HTML text content. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
