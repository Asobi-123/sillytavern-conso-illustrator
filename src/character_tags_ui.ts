/**
 * Character Fixed Tags UI Module
 * Renders owner-scoped card, persona, chat-NPC, and legacy tag profiles.
 */

import {createLogger} from './logger';
import {UI_ELEMENT_IDS} from './constants';
import {t} from './i18n';
import {
  getCurrentParticipants,
  resolveActiveCharacterFixedTags,
} from './services/character_fixed_tags_service';
import type {CharacterFixedTagEntry, CharacterFixedTagScopes} from './types';
import {htmlEncode} from './utils/dom_utils';
import {getMetadata, saveMetadata} from './metadata';

const logger = createLogger('CharacterTagsUI');

type TagOwner = 'character' | 'persona' | 'chat' | 'legacy';

interface VisibleTagEntry {
  owner: TagOwner;
  key: string;
  label: string;
  entry: CharacterFixedTagEntry;
  isAuto: boolean;
  isLegacy: boolean;
}

let settingsRef: AutoIllustratorSettings | null = null;
let saveSettingsFn: (() => void) | null = null;
let pendingReloadTimers: Array<ReturnType<typeof setTimeout>> = [];
let characterTagListenersRegistered = false;

function getCurrentContext(): SillyTavernContext | null {
  try {
    return SillyTavern.getContext?.() || null;
  } catch {
    return null;
  }
}

function ensureScopes(): CharacterFixedTagScopes {
  if (!settingsRef) {
    throw new Error('Character tags settings are not initialized');
  }

  if (!settingsRef.characterFixedTagScopes) {
    settingsRef.characterFixedTagScopes = {
      schemaVersion: 2,
      characters: {},
      personas: {},
      legacy: {},
    };
  }

  const scopes = settingsRef.characterFixedTagScopes;
  scopes.characters ||= {};
  scopes.personas ||= {};
  scopes.legacy ||= {};
  scopes.schemaVersion = 2;
  return scopes;
}

/**
 * Converts the old chat-local key list to chat-local records. The key list
 * was an explicit user action, so this migration is safe and non-global.
 */
function getManualTags(): Record<string, CharacterFixedTagEntry> {
  try {
    const metadata = getMetadata();
    if (!metadata.manualCharacterTags) {
      metadata.manualCharacterTags = {};
    }

    let migrated = false;
    for (const key of metadata.manualCharacterTagKeys || []) {
      if (metadata.manualCharacterTags[key]) continue;
      const legacyEntry = settingsRef?.characterFixedTags?.[key];
      metadata.manualCharacterTags[key] = legacyEntry
        ? {
            names: [...legacyEntry.names],
            tags: legacyEntry.tags,
            enabled: legacyEntry.enabled,
          }
        : {names: [key], tags: '', enabled: false};
      migrated = true;
    }
    if (migrated) saveMetadata();

    return metadata.manualCharacterTags;
  } catch {
    return {};
  }
}

function saveManualTags(tags: Record<string, CharacterFixedTagEntry>): void {
  try {
    const metadata = getMetadata();
    metadata.manualCharacterTags = tags;
    metadata.manualCharacterTagKeys = Object.keys(tags);
    saveMetadata();
  } catch {
    logger.warn('Could not save chat-local character tags');
  }
}

function getCurrentScope(): ReturnType<typeof resolveActiveCharacterFixedTags> {
  const context = getCurrentContext();
  return resolveActiveCharacterFixedTags(
    settingsRef?.characterFixedTagScopes,
    context
  );
}

function getScopedRecords(
  owner: 'character' | 'persona' | 'legacy'
): Record<string, CharacterFixedTagEntry> {
  const scopes = ensureScopes();
  if (owner === 'character') return scopes.characters;
  if (owner === 'persona') return scopes.personas;
  return scopes.legacy;
}

function getEntry(
  owner: TagOwner,
  key: string
): CharacterFixedTagEntry | undefined {
  if (owner === 'chat') return getManualTags()[key];
  return getScopedRecords(owner)[key];
}

function setEntry(
  owner: TagOwner,
  key: string,
  entry: CharacterFixedTagEntry
): void {
  if (owner === 'chat') {
    const tags = getManualTags();
    tags[key] = entry;
    saveManualTags(tags);
    return;
  }

  getScopedRecords(owner)[key] = entry;
  saveSettingsFn?.();
}

function deleteEntry(owner: TagOwner, key: string): void {
  if (owner === 'chat') {
    const tags = getManualTags();
    delete tags[key];
    saveManualTags(tags);
    return;
  }

  if (owner === 'legacy') {
    delete settingsRef?.characterFixedTags?.[key];
  }
  delete getScopedRecords(owner)[key];
  saveSettingsFn?.();
}

function getDefaultEntry(item: {
  owner: TagOwner;
  key: string;
  label: string;
}): CharacterFixedTagEntry {
  return (
    getEntry(item.owner, item.key) || {
      names: [item.label],
      tags: '',
      enabled: false,
    }
  );
}

function getSearchFilter(): string | undefined {
  const input = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_TAG_SEARCH
  ) as HTMLInputElement | null;
  return input?.value?.trim() || undefined;
}

function buildVisibleEntries(): VisibleTagEntry[] {
  if (!settingsRef) return [];

  const scope = getCurrentScope();
  const participants = getCurrentParticipants();
  const entries: VisibleTagEntry[] = [];
  const character = participants.find(item => item.type === 'character');
  const persona = participants.find(item => item.type === 'persona');

  if (scope.characterKey) {
    entries.push({
      owner: 'character',
      key: scope.characterKey,
      label: character?.name || scope.characterKey,
      entry: getDefaultEntry({
        owner: 'character',
        key: scope.characterKey,
        label: character?.name || scope.characterKey,
      }),
      isAuto: true,
      isLegacy: false,
    });
  }

  if (scope.personaKey) {
    entries.push({
      owner: 'persona',
      key: scope.personaKey,
      label: persona?.name || scope.personaKey,
      entry: getDefaultEntry({
        owner: 'persona',
        key: scope.personaKey,
        label: persona?.name || scope.personaKey,
      }),
      isAuto: true,
      isLegacy: false,
    });
  }

  for (const [key, entry] of Object.entries(scope.chatTags)) {
    entries.push({
      owner: 'chat',
      key,
      label: entry.names[0] || key,
      entry,
      isAuto: false,
      isLegacy: false,
    });
  }

  for (const [key, entry] of Object.entries(ensureScopes().legacy)) {
    entries.push({
      owner: 'legacy',
      key,
      label: entry.names[0] || key,
      entry,
      isAuto: false,
      isLegacy: true,
    });
  }

  return entries;
}

function renderCharacterTagList(filter?: string): void {
  const listContainer = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_FIXED_TAGS_LIST
  );
  if (!listContainer || !settingsRef) return;

  const filterLower = filter?.toLowerCase();
  const visibleEntries = buildVisibleEntries().filter(item => {
    if (!filterLower) return true;
    return (
      item.label.toLowerCase().includes(filterLower) ||
      item.key.toLowerCase().includes(filterLower) ||
      item.entry.names.some(name => name.toLowerCase().includes(filterLower))
    );
  });

  if (visibleEntries.length === 0) {
    listContainer.innerHTML = filter
      ? `<div class="character-tag-empty">${t('settings.characterFixedTags.noMatch')}</div>`
      : '';
    return;
  }

  let html = '';
  for (const item of visibleEntries) {
    const itemId = `${item.owner}:${item.key}`;
    const badgeText = item.isLegacy
      ? t('settings.characterFixedTags.unassigned')
      : item.owner === 'character'
        ? t('settings.characterFixedTags.cardScope')
        : item.owner === 'persona'
          ? t('settings.characterFixedTags.personaScope')
          : t('settings.characterFixedTags.chatScope');
    const allNames =
      item.entry.names.length > 0 ? item.entry.names : [item.label];
    const aliasChipsHtml = allNames
      .map(
        alias => `<span class="alias-chip" data-alias="${htmlEncode(alias)}">
          ${htmlEncode(alias)}
          <span class="alias-remove" data-action="remove-alias" data-owner="${item.owner}" data-key="${htmlEncode(item.key)}" data-alias="${htmlEncode(alias)}">&times;</span>
        </span>`
      )
      .join('');

    const legacyActions = item.isLegacy
      ? `<button class="menu_button" data-action="assign-legacy" data-owner="legacy" data-key="${htmlEncode(item.key)}" data-target="character"><i class="fa-solid fa-id-card"></i> ${t('settings.characterFixedTags.assignCard')}</button>
         <button class="menu_button" data-action="assign-legacy" data-owner="legacy" data-key="${htmlEncode(item.key)}" data-target="persona"><i class="fa-solid fa-user"></i> ${t('settings.characterFixedTags.assignPersona')}</button>
         <button class="menu_button" data-action="assign-legacy" data-owner="legacy" data-key="${htmlEncode(item.key)}" data-target="chat"><i class="fa-solid fa-comments"></i> ${t('settings.characterFixedTags.assignChat')}</button>`
      : '';

    html += `
      <div class="character-tag-item" data-tag-id="${htmlEncode(itemId)}">
        <div class="character-tag-header">
          <span class="character-tag-name">${htmlEncode(item.label)}</span>
          <span class="character-tag-badge">${badgeText}</span>
          <label class="checkbox_label" style="flex-shrink:0; margin:0;">
            <input type="checkbox" data-action="toggle-enabled" data-owner="${item.owner}" data-key="${htmlEncode(item.key)}" ${item.entry.enabled ? 'checked' : ''} />
            <span style="font-size:0.85em;">${t('settings.characterFixedTags.enabled')}</span>
          </label>
        </div>
        <div class="character-tag-aliases">
          <small style="opacity:0.7; margin-right:4px;">${t('settings.characterFixedTags.names')}:</small>
          ${aliasChipsHtml}
          <input type="text" class="alias-add-input" data-action="add-alias-input" data-owner="${item.owner}" data-key="${htmlEncode(item.key)}"
                 placeholder="${t('settings.characterFixedTags.namesPlaceholder')}" />
        </div>
        <div class="character-tag-tags-row">
          <textarea class="text_pole textarea_compact" rows="2"
                    data-action="tags-input" data-owner="${item.owner}" data-key="${htmlEncode(item.key)}"
                    placeholder="${t('settings.characterFixedTags.tagsPlaceholder')}">${htmlEncode(item.entry.tags)}</textarea>
        </div>
        <div class="character-tag-actions">
          <button class="menu_button" data-action="save-tags" data-owner="${item.owner}" data-key="${htmlEncode(item.key)}"><i class="fa-solid fa-save"></i> ${t('settings.characterFixedTags.save')}</button>
          ${legacyActions}
          ${
            !item.isAuto || item.isLegacy
              ? `<button class="menu_button" data-action="delete-character" data-owner="${item.owner}" data-key="${htmlEncode(item.key)}"><i class="fa-solid fa-trash"></i> ${t('settings.characterFixedTags.delete')}</button>`
              : ''
          }
        </div>
      </div>
    `;
  }

  listContainer.innerHTML = html;
}

function getItemElement(owner: TagOwner, key: string): HTMLElement | null {
  const itemId = `${owner}:${key}`;
  return (
    Array.from(document.querySelectorAll<HTMLElement>('[data-tag-id]')).find(
      item => item.dataset.tagId === itemId
    ) || null
  );
}

function getItemLabel(owner: TagOwner, key: string): string {
  const item = buildVisibleEntries().find(
    entry => entry.owner === owner && entry.key === key
  );
  return item?.label || key;
}

function handleSaveTags(owner: TagOwner, key: string): void {
  const item = getItemElement(owner, key);
  if (!item) return;
  const tagsInput = item.querySelector(
    '[data-action="tags-input"]'
  ) as HTMLTextAreaElement | null;
  const enabledInput = item.querySelector(
    '[data-action="toggle-enabled"]'
  ) as HTMLInputElement | null;
  const existing = getEntry(owner, key) || {
    names: [getItemLabel(owner, key)],
    tags: '',
    enabled: false,
  };
  setEntry(owner, key, {
    names: existing.names,
    tags: tagsInput?.value || '',
    enabled: enabledInput?.checked ?? existing.enabled,
  });
  renderCharacterTagList(getSearchFilter());
}

function handleToggleEnabled(
  owner: TagOwner,
  key: string,
  enabled: boolean
): void {
  const existing = getEntry(owner, key) || {
    names: [getItemLabel(owner, key)],
    tags: '',
    enabled: false,
  };
  setEntry(owner, key, {...existing, enabled});
}

function handleAddAlias(owner: TagOwner, key: string, alias: string): void {
  const existing = getEntry(owner, key) || {
    names: [getItemLabel(owner, key)],
    tags: '',
    enabled: false,
  };
  if (existing.names.includes(alias)) return;
  setEntry(owner, key, {...existing, names: [...existing.names, alias]});
  renderCharacterTagList(getSearchFilter());
}

function handleRemoveAlias(owner: TagOwner, key: string, alias: string): void {
  const existing = getEntry(owner, key);
  if (!existing) return;
  const names = existing.names.filter(name => name !== alias);
  setEntry(owner, key, {
    ...existing,
    names: names.length > 0 ? names : [getItemLabel(owner, key)],
  });
  renderCharacterTagList(getSearchFilter());
}

function handleDeleteCharacter(owner: TagOwner, key: string): void {
  deleteEntry(owner, key);
  renderCharacterTagList(getSearchFilter());
}

function handleAssignLegacy(
  key: string,
  target: 'character' | 'persona' | 'chat'
): void {
  const entry = getEntry('legacy', key);
  if (!entry) return;

  if (target === 'chat') {
    const tags = getManualTags();
    tags[key] = entry;
    saveManualTags(tags);
  } else {
    const scope = getCurrentScope();
    const targetKey =
      target === 'character' ? scope.characterKey : scope.personaKey;
    if (!targetKey) return;
    setEntry(target, targetKey, entry);
  }

  // Once the user assigns an ambiguous legacy record, remove the old flat
  // copy so the compatibility migration cannot recreate it on next load.
  delete settingsRef?.characterFixedTags?.[key];
  deleteEntry('legacy', key);
  renderCharacterTagList(getSearchFilter());
}

function handleListClick(e: Event): void {
  const target = e.target as HTMLElement;
  const action = target.closest('[data-action]') as HTMLElement | null;
  if (!action) return;
  const owner = action.dataset.owner as TagOwner | undefined;
  const key = action.dataset.key;
  if (!owner || !key) return;

  switch (action.dataset.action) {
    case 'save-tags':
      handleSaveTags(owner, key);
      break;
    case 'delete-character':
      handleDeleteCharacter(owner, key);
      break;
    case 'remove-alias':
      handleRemoveAlias(owner, key, action.dataset.alias || '');
      break;
    case 'assign-legacy':
      if (owner === 'legacy') {
        handleAssignLegacy(
          key,
          action.dataset.target as 'character' | 'persona' | 'chat'
        );
      }
      break;
  }
}

function handleListChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  if (target.dataset.action === 'toggle-enabled') {
    const owner = target.dataset.owner as TagOwner;
    const key = target.dataset.key;
    if (owner && key) handleToggleEnabled(owner, key, target.checked);
  }
}

function handleListKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLInputElement;
  if (target.dataset.action !== 'add-alias-input' || e.key !== 'Enter') return;
  e.preventDefault();
  const owner = target.dataset.owner as TagOwner;
  const key = target.dataset.key;
  const alias = target.value.trim();
  if (owner && key && alias) {
    handleAddAlias(owner, key, alias);
    target.value = '';
  }
}

function registerCharacterTagEventListeners(): void {
  const listContainer = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_FIXED_TAGS_LIST
  );
  listContainer?.addEventListener('click', handleListClick);
  listContainer?.addEventListener('change', handleListChange);
  listContainer?.addEventListener('keydown', handleListKeydown);

  const searchInput = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_TAG_SEARCH
  );
  searchInput?.addEventListener('input', () => {
    const value = (searchInput as HTMLInputElement).value.trim();
    renderCharacterTagList(value || undefined);
  });

  document
    .getElementById(UI_ELEMENT_IDS.CHARACTER_TAG_ADD_BTN)
    ?.addEventListener('click', handleAddCharacter);
  document
    .getElementById(UI_ELEMENT_IDS.CHARACTER_TAG_RESET_ALL)
    ?.addEventListener('click', handleResetAll);

  const context = getCurrentContext();
  const personaChanged = context?.eventTypes?.PERSONA_CHANGED;
  if (context?.eventSource && personaChanged) {
    context.eventSource.on(personaChanged, () => reloadCharacterTagsForChat());
  }
}

function handleAddCharacter(): void {
  const nameInput = document.getElementById(
    UI_ELEMENT_IDS.CHARACTER_TAG_ADD_NAME
  ) as HTMLInputElement | null;
  const name = nameInput?.value.trim();
  if (!name) return;

  const tags = getManualTags();
  if (!tags[name]) {
    tags[name] = {names: [name], tags: '', enabled: false};
    saveManualTags(tags);
  }
  if (nameInput) nameInput.value = '';
  renderCharacterTagList(getSearchFilter());
}

function handleResetAll(): void {
  if (!settingsRef || !confirm(t('settings.characterFixedTags.resetConfirm'))) {
    return;
  }

  const scopes = ensureScopes();
  scopes.characters = {};
  scopes.personas = {};
  scopes.legacy = {};
  settingsRef.characterFixedTags = {};
  saveSettingsFn?.();
  saveManualTags({});
  renderCharacterTagList();
}

export function initializeCharacterTagsPanel(
  settings: AutoIllustratorSettings,
  saveFn: () => void
): void {
  settingsRef = settings;
  saveSettingsFn = saveFn;
  if (!characterTagListenersRegistered) {
    registerCharacterTagEventListeners();
    characterTagListenersRegistered = true;
  }
  renderCharacterTagList();
}

export function reloadCharacterTagsForChat(): void {
  pendingReloadTimers.forEach(timer => clearTimeout(timer));
  pendingReloadTimers = [];

  renderCharacterTagList();
  const retryDelaysMs = [150, 500, 1200, 2500];
  for (const delayMs of retryDelaysMs) {
    const timer = setTimeout(() => {
      renderCharacterTagList();
      pendingReloadTimers = pendingReloadTimers.filter(item => item !== timer);
    }, delayMs);
    pendingReloadTimers.push(timer);
  }
}
