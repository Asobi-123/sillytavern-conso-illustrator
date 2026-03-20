/**
 * Character Fixed Tags UI Module
 * Renders the character tag management panel and handles interactions.
 *
 * Visibility rules:
 * - Auto-detected participants (name1, name2) → always shown
 * - Manually added NPCs → stored in per-chat metadata, shown only for that chat
 * - All other saved entries → hidden (but persist in global settings)
 */

import {createLogger} from './logger';
import {UI_ELEMENT_IDS} from './constants';
import {t} from './i18n';
import {getCurrentParticipants} from './services/character_fixed_tags_service';
import type {CharacterFixedTagEntry} from './types';
import {htmlEncode} from './utils/dom_utils';
import {getMetadata, saveMetadata} from './metadata';

const logger = createLogger('CharacterTagsUI');

/** Reference to settings (set during initialization) */
let settingsRef: AutoIllustratorSettings | null = null;
let saveSettingsFn: (() => void) | null = null;

/**
 * Gets manual character keys from current chat metadata.
 */
function getManualKeys(): string[] {
  try {
    const metadata = getMetadata();
    return metadata.manualCharacterTagKeys || [];
  } catch {
    return [];
  }
}

/**
 * Saves manual character keys to current chat metadata.
 */
function setManualKeys(keys: string[]): void {
  try {
    const metadata = getMetadata();
    metadata.manualCharacterTagKeys = keys;
    saveMetadata();
  } catch {
    logger.warn('Could not save manual character keys (no active chat?)');
  }
}

/**
 * Initializes the character tags panel.
 * @param settings - Extension settings reference
 * @param saveFn - Function to call when settings change
 */
export function initializeCharacterTagsPanel(
  settings: AutoIllustratorSettings,
  saveFn: () => void
): void {
  settingsRef = settings;
  saveSettingsFn = saveFn;
  registerCharacterTagEventListeners();
  renderCharacterTagList();
}

/**
 * Reloads the character tag list for the current chat.
 * Call on CHAT_CHANGED.
 * Uses a short delay because SillyTavern may not have updated
 * name1 (persona) yet when CHAT_CHANGED fires.
 */
export function reloadCharacterTagsForChat(): void {
  // Immediate render with whatever is available now
  renderCharacterTagList();
  // Deferred re-render to pick up persona (name1) once ST finishes loading
  setTimeout(() => renderCharacterTagList(), 500);
}

/**
 * Gets the current search filter value.
 */
function getSearchFilter(): string | undefined {
  const input = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_TAG_SEARCH
  ) as HTMLInputElement | null;
  return input?.value?.trim() || undefined;
}

/**
 * Renders the character tag list.
 * Only shows: auto-detected participants + manually added for this chat.
 */
function renderCharacterTagList(filter?: string): void {
  const listContainer = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_FIXED_TAGS_LIST
  );
  if (!listContainer || !settingsRef) return;

  if (!settingsRef.characterFixedTags) {
    settingsRef.characterFixedTags = {};
  }

  const savedTags = settingsRef.characterFixedTags;
  const participants = getCurrentParticipants();
  const participantNames = new Set(participants.map(p => p.name));
  const manualKeys = getManualKeys();

  // Build visible entries: auto-detected + manual (per-chat)
  const visibleEntries: Array<{
    key: string;
    entry: CharacterFixedTagEntry;
    isAuto: boolean;
  }> = [];

  // Auto-detected participants first
  for (const p of participants) {
    const existing = savedTags[p.name];
    visibleEntries.push({
      key: p.name,
      entry: existing || {names: [p.name], tags: '', enabled: false},
      isAuto: true,
    });
  }

  // Manually added for this chat (from metadata, not already auto-detected)
  for (const name of manualKeys) {
    if (participantNames.has(name)) continue;
    const existing = savedTags[name];
    visibleEntries.push({
      key: name,
      entry: existing || {names: [name], tags: '', enabled: false},
      isAuto: false,
    });
  }

  // Apply search filter
  const filterLower = filter?.toLowerCase();
  const filteredEntries = filterLower
    ? visibleEntries.filter(({key, entry}) => {
        if (key.toLowerCase().includes(filterLower)) return true;
        return entry.names.some(n => n.toLowerCase().includes(filterLower));
      })
    : visibleEntries;

  if (filteredEntries.length === 0) {
    listContainer.innerHTML = filter
      ? `<div class="character-tag-empty">${t('settings.characterFixedTags.noMatch')}</div>`
      : '';
    return;
  }

  let html = '';
  for (const {key, entry, isAuto} of filteredEntries) {
    const badgeText = isAuto
      ? t('settings.characterFixedTags.autoDetected')
      : t('settings.characterFixedTags.manual');

    // Build alias chips
    const allNames = entry.names.length > 0 ? entry.names : [key];
    let aliasChipsHtml = '';
    for (const alias of allNames) {
      aliasChipsHtml += `<span class="alias-chip" data-alias="${htmlEncode(alias)}">
        ${htmlEncode(alias)}
        <span class="alias-remove" data-action="remove-alias" data-key="${htmlEncode(key)}" data-alias="${htmlEncode(alias)}">&times;</span>
      </span>`;
    }

    html += `
      <div class="character-tag-item" data-character-key="${htmlEncode(key)}">
        <div class="character-tag-header">
          <span class="character-tag-name">${htmlEncode(key)}</span>
          <span class="character-tag-badge">${badgeText}</span>
          <label class="checkbox_label" style="flex-shrink:0; margin:0;">
            <input type="checkbox" data-action="toggle-enabled" data-key="${htmlEncode(key)}" ${entry.enabled ? 'checked' : ''} />
            <span style="font-size:0.85em;">${t('settings.characterFixedTags.enabled')}</span>
          </label>
        </div>
        <div class="character-tag-aliases">
          <small style="opacity:0.7; margin-right:4px;">${t('settings.characterFixedTags.names')}:</small>
          ${aliasChipsHtml}
          <input type="text" class="alias-add-input" data-action="add-alias-input" data-key="${htmlEncode(key)}"
                 placeholder="${t('settings.characterFixedTags.namesPlaceholder')}" />
        </div>
        <div class="character-tag-tags-row">
          <textarea class="text_pole textarea_compact" rows="2"
                    data-action="tags-input" data-key="${htmlEncode(key)}"
                    placeholder="${t('settings.characterFixedTags.tagsPlaceholder')}">${htmlEncode(entry.tags)}</textarea>
        </div>
        <div class="character-tag-actions">
          <button class="menu_button" data-action="save-tags" data-key="${htmlEncode(key)}">
            <i class="fa-solid fa-save"></i> ${t('settings.characterFixedTags.save')}
          </button>
          ${
            !isAuto
              ? `<button class="menu_button" data-action="delete-character" data-key="${htmlEncode(key)}">
                   <i class="fa-solid fa-trash"></i> ${t('settings.characterFixedTags.delete')}
                 </button>`
              : ''
          }
        </div>
      </div>
    `;
  }

  listContainer.innerHTML = html;
}

/**
 * Registers event delegation on the character tags panel.
 */
function registerCharacterTagEventListeners(): void {
  const listContainer = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_FIXED_TAGS_LIST
  );
  if (listContainer) {
    listContainer.addEventListener('click', handleListClick);
    listContainer.addEventListener('change', handleListChange);
    listContainer.addEventListener('keydown', handleListKeydown);
  }

  // Search bar
  const searchInput = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_TAG_SEARCH
  );
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const value = (searchInput as HTMLInputElement).value.trim();
      renderCharacterTagList(value || undefined);
    });
  }

  // Add character button
  const addBtn = document.getElementById(UI_ELEMENT_IDS.CHARACTER_TAG_ADD_BTN);
  if (addBtn) {
    addBtn.addEventListener('click', handleAddCharacter);
  }

  // Reset all button
  const resetBtn = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_TAG_RESET_ALL
  );
  if (resetBtn) {
    resetBtn.addEventListener('click', handleResetAll);
  }
}

/**
 * Handles click events via delegation.
 */
function handleListClick(e: Event): void {
  const target = e.target as HTMLElement;

  const saveBtn = target.closest('[data-action="save-tags"]') as HTMLElement;
  if (saveBtn) {
    handleSaveTags(saveBtn.dataset.key!);
    return;
  }

  const deleteBtn = target.closest(
    '[data-action="delete-character"]'
  ) as HTMLElement;
  if (deleteBtn) {
    handleDeleteCharacter(deleteBtn.dataset.key!);
    return;
  }

  const removeAlias = target.closest(
    '[data-action="remove-alias"]'
  ) as HTMLElement;
  if (removeAlias) {
    handleRemoveAlias(removeAlias.dataset.key!, removeAlias.dataset.alias!);
    return;
  }
}

/**
 * Handles change events (checkboxes) via delegation.
 */
function handleListChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  if (target.dataset.action === 'toggle-enabled') {
    handleToggleEnabled(target.dataset.key!, target.checked);
  }
}

/**
 * Handles keydown events (Enter in alias input).
 */
function handleListKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLInputElement;
  if (target.dataset.action === 'add-alias-input' && e.key === 'Enter') {
    e.preventDefault();
    const key = target.dataset.key!;
    const alias = target.value.trim();
    if (alias) {
      handleAddAlias(key, alias);
      target.value = '';
    }
  }
}

/**
 * Saves the tags for a character.
 */
function handleSaveTags(key: string): void {
  if (!settingsRef) return;

  const item = document.querySelector(
    `[data-character-key="${CSS.escape(key)}"]`
  );
  if (!item) return;

  const tagsInput = item.querySelector(
    '[data-action="tags-input"]'
  ) as HTMLTextAreaElement;
  const enabledInput = item.querySelector(
    '[data-action="toggle-enabled"]'
  ) as HTMLInputElement;

  if (!settingsRef.characterFixedTags) {
    settingsRef.characterFixedTags = {};
  }

  const existing = settingsRef.characterFixedTags[key];
  settingsRef.characterFixedTags[key] = {
    names: existing?.names || [key],
    tags: tagsInput?.value || '',
    enabled: enabledInput?.checked ?? false,
  };

  saveSettingsFn?.();
  logger.info(`Saved character tags for "${key}"`);
}

/**
 * Toggles character enabled state.
 */
function handleToggleEnabled(key: string, enabled: boolean): void {
  if (!settingsRef) return;

  if (!settingsRef.characterFixedTags) {
    settingsRef.characterFixedTags = {};
  }

  if (settingsRef.characterFixedTags[key]) {
    settingsRef.characterFixedTags[key].enabled = enabled;
  } else {
    settingsRef.characterFixedTags[key] = {
      names: [key],
      tags: '',
      enabled,
    };
  }

  saveSettingsFn?.();
  logger.info(`Character "${key}" ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Adds an alias to a character.
 */
function handleAddAlias(key: string, alias: string): void {
  if (!settingsRef) return;

  if (!settingsRef.characterFixedTags) {
    settingsRef.characterFixedTags = {};
  }

  if (!settingsRef.characterFixedTags[key]) {
    settingsRef.characterFixedTags[key] = {
      names: [key],
      tags: '',
      enabled: false,
    };
  }

  const entry = settingsRef.characterFixedTags[key];
  if (!entry.names.includes(alias)) {
    entry.names.push(alias);
    saveSettingsFn?.();
    renderCharacterTagList(getSearchFilter());
    logger.info(`Added alias "${alias}" to character "${key}"`);
  }
}

/**
 * Removes an alias from a character.
 */
function handleRemoveAlias(key: string, alias: string): void {
  if (!settingsRef) return;

  const entry = settingsRef.characterFixedTags?.[key];
  if (!entry) return;

  entry.names = entry.names.filter(n => n !== alias);
  if (entry.names.length === 0) {
    entry.names = [key];
  }

  saveSettingsFn?.();
  renderCharacterTagList(getSearchFilter());
  logger.info(`Removed alias "${alias}" from character "${key}"`);
}

/**
 * Deletes a manually added character.
 * Removes from both global settings and per-chat metadata.
 */
function handleDeleteCharacter(key: string): void {
  if (!settingsRef) return;

  // Remove from global settings
  delete settingsRef.characterFixedTags?.[key];
  saveSettingsFn?.();

  // Remove from per-chat metadata
  const manualKeys = getManualKeys().filter(k => k !== key);
  setManualKeys(manualKeys);

  renderCharacterTagList(getSearchFilter());
  logger.info(`Deleted character "${key}"`);
}

/**
 * Adds a new character manually.
 * Stored in per-chat metadata so it persists across sessions for this chat.
 */
function handleAddCharacter(): void {
  if (!settingsRef) return;

  const nameInput = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_TAG_ADD_NAME
  ) as HTMLInputElement;
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) return;

  if (!settingsRef.characterFixedTags) {
    settingsRef.characterFixedTags = {};
  }

  // Add to per-chat metadata
  const manualKeys = getManualKeys();
  if (!manualKeys.includes(name)) {
    manualKeys.push(name);
    setManualKeys(manualKeys);
  }

  // Create global entry if it doesn't exist (if it does, saved data is preserved)
  if (!settingsRef.characterFixedTags[name]) {
    settingsRef.characterFixedTags[name] = {
      names: [name],
      tags: '',
      enabled: false,
    };
  }

  nameInput.value = '';
  saveSettingsFn?.();
  renderCharacterTagList(getSearchFilter());
  logger.info(`Added new character "${name}" (per-chat)`);
}

/**
 * Resets all character tags after confirmation.
 */
function handleResetAll(): void {
  if (!settingsRef) return;

  if (!confirm(t('settings.characterFixedTags.resetConfirm'))) {
    return;
  }

  settingsRef.characterFixedTags = {};
  setManualKeys([]);
  saveSettingsFn?.();
  renderCharacterTagList();
  logger.info('Reset all character fixed tags');
}
