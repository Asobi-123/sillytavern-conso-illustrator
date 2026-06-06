/**
 * Built-in + user tag catalog browser.
 *
 * Runtime never fetches network resources. Built-in entries ship with the
 * extension; user entries are stored in extension settings and merged locally.
 */

import rawCatalog from './data/tag_catalog.json';
import rawBridgeReport from './data/tag_bridge_report.json';
import rawZhBridge from './data/zh_tag_bridge.generated.json';
import {
  TAG_CATALOG_CANDIDATE_LIMIT,
  TAG_CATALOG_CATEGORIES,
  TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS,
  TAG_CATALOG_PAGE_SIZE,
  UI_ELEMENT_IDS,
} from './constants';
import {t} from './i18n';
import {createLogger} from './logger';
import type {
  TagBridgeReport,
  TagCatalog,
  TagCatalogEntry,
  ZhTagBridge,
} from './types';
import {htmlEncode} from './utils/dom_utils';
import {parseCommonTags, deduplicateTags} from './services/prompt_tags';
import {getLastTagCatalogCandidateSnapshot} from './services/tag_catalog_prompt';

const logger = createLogger('TagCatalog');
const catalog = rawCatalog as TagCatalog;
const zhBridge = rawZhBridge as ZhTagBridge;
const bridgeReport = rawBridgeReport as TagBridgeReport;
const selectedTags = new Set<string>();
const validCategories = new Set<string>(TAG_CATALOG_CATEGORIES);
const bridgeEntryByTag = new Map(
  zhBridge.entries.map(entry => [entry.tag, entry])
);

let settingsRef: AutoIllustratorSettings | null = null;
let saveSettingsFn: (() => void) | null = null;
let initialized = false;
let currentPage = 1;
let currentPageSize: number = TAG_CATALOG_PAGE_SIZE.DEFAULT;

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  subject: 'tagCatalog.category.subject',
  hair: 'tagCatalog.category.hair',
  eyes: 'tagCatalog.category.eyes',
  expression: 'tagCatalog.category.expression',
  pose_action: 'tagCatalog.category.poseAction',
  clothing: 'tagCatalog.category.clothing',
  scene: 'tagCatalog.category.scene',
  camera: 'tagCatalog.category.camera',
  lighting_style: 'tagCatalog.category.lightingStyle',
  undesired_content: 'tagCatalog.category.undesiredContent',
  general: 'tagCatalog.category.general',
};

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

function categoryLabel(category: string): string {
  return t(CATEGORY_LABEL_KEYS[category] || 'tagCatalog.category.general');
}

function normalizeTagValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseTriggerList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,，;；]+/)
        .map(trigger => trigger.trim())
        .filter(Boolean)
    ),
  ];
}

function triggerGroupsForTags(raw: string, count: number): string[][] {
  if (!raw.trim()) return Array.from({length: count}, () => []);
  if (count <= 1) return [parseTriggerList(raw)];

  const lineGroups = raw
    .split(/\n+/)
    .map(group => group.trim())
    .filter(Boolean);
  if (lineGroups.length === count) {
    return lineGroups.map(parseTriggerList);
  }

  const semicolonGroups = raw
    .split(/[;；]+/)
    .map(group => group.trim())
    .filter(Boolean);
  if (semicolonGroups.length === count) {
    return semicolonGroups.map(parseTriggerList);
  }

  const flatTriggers = parseTriggerList(raw);
  if (flatTriggers.length === count) {
    return flatTriggers.map(trigger => [trigger]);
  }

  return Array.from({length: count}, () => []);
}

function customTriggerOverrides(): Record<string, string[]> {
  return settingsRef?.customTagBridgeTriggers ?? {};
}

function entryTriggers(entry: TagCatalogEntry): string[] {
  return [
    ...new Set([
      ...(bridgeEntryByTag.get(entry.tag)?.triggers ?? []),
      ...(entry.triggers ?? []),
      ...(customTriggerOverrides()[entry.tag] ?? []),
    ]),
  ];
}

function renderTriggerChips(triggers: string[]): string {
  if (triggers.length === 0) {
    return `<span class="tag-catalog-trigger-empty">${t('tagCatalog.noTriggers')}</span>`;
  }
  return triggers
    .map(trigger => `<span>${htmlEncode(trigger)}</span>`)
    .join('');
}

function hasUserTrigger(entry: TagCatalogEntry): boolean {
  return (
    (entry.triggers?.length ?? 0) > 0 ||
    (customTriggerOverrides()[entry.tag]?.length ?? 0) > 0
  );
}

function hasBridgeTrigger(entry: TagCatalogEntry): boolean {
  return entryTriggers(entry).length > 0;
}

function findEntryByTag(tag: string): TagCatalogEntry | null {
  return mergedEntries().find(entry => entry.tag === tag) ?? null;
}

function getCustomEntries(): TagCatalogEntry[] {
  return (settingsRef?.customTagCatalogEntries ?? []).map(entry => ({
    ...entry,
    source: 'user',
  }));
}

function mergedEntries(): TagCatalogEntry[] {
  const entries = new Map<string, TagCatalogEntry>();
  for (const entry of catalog.entries) {
    entries.set(entry.tag, {...entry, source: entry.source ?? 'built-in'});
  }
  for (const entry of getCustomEntries()) {
    entries.set(entry.tag, entry);
  }
  return [...entries.values()];
}

function categoryOptions(includeAll: boolean): string {
  const options = includeAll
    ? [`<option value="">${t('tagCatalog.allCategories')}</option>`]
    : [];
  options.push(
    ...TAG_CATALOG_CATEGORIES.map(
      category =>
        `<option value="${htmlEncode(category)}">${htmlEncode(categoryLabel(category))}</option>`
    )
  );
  return options.join('');
}

function sourceOptions(): string {
  return [
    `<option value="">${t('tagCatalog.allSources')}</option>`,
    `<option value="built-in">${t('tagCatalog.sourceBuiltIn')}</option>`,
    `<option value="user">${t('tagCatalog.sourceCustom')}</option>`,
    `<option value="unbridged">${t('tagCatalog.sourceUnbridged')}</option>`,
    `<option value="user-trigger">${t('tagCatalog.sourceUserTriggers')}</option>`,
  ].join('');
}

function pageSizeOptions(): string {
  return TAG_CATALOG_PAGE_SIZE.OPTIONS.map(size => {
    const selected = size === currentPageSize ? ' selected' : '';
    const label =
      size === TAG_CATALOG_PAGE_SIZE.ALL
        ? t('tagCatalog.pageSizeAll')
        : String(size);
    return `<option value="${size}"${selected}>${htmlEncode(label)}</option>`;
  }).join('');
}

function candidateLimitInputs(): string {
  return Object.keys(TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS)
    .map(category => {
      const value =
        settingsRef?.tagCatalogCandidateLimits?.[category] ??
        TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS[category];
      return `
        <label class="tag-catalog-limit-item">
          <span>${htmlEncode(categoryLabel(category))}</span>
          <input class="text_pole tag-catalog-limit-input" data-category="${htmlEncode(category)}"
                 type="number" min="${TAG_CATALOG_CANDIDATE_LIMIT.MIN}" max="${TAG_CATALOG_CANDIDATE_LIMIT.MAX}"
                 step="1" value="${value}" />
        </label>
      `;
    })
    .join('');
}

export function createTagCatalogContent(): string {
  return `
    <div class="tag-catalog-container">
      <div class="tag-catalog-meta">
        ${t('tagCatalog.meta', {version: catalog.metadata.version})}
      </div>
      <div class="tag-catalog-total" id="${UI_ELEMENT_IDS.TAG_CATALOG_TOTAL}"></div>
      <div class="tag-catalog-toolbar">
        <input id="${UI_ELEMENT_IDS.TAG_CATALOG_SEARCH}" class="text_pole" type="search"
               placeholder="${t('tagCatalog.searchPlaceholder')}" />
        <select id="${UI_ELEMENT_IDS.TAG_CATALOG_CATEGORY}" class="text_pole">
          ${categoryOptions(true)}
        </select>
        <select id="${UI_ELEMENT_IDS.TAG_CATALOG_SOURCE_FILTER}" class="text_pole">
          ${sourceOptions()}
        </select>
      </div>

      <details class="tag-catalog-settings">
        <summary>${t('tagCatalog.candidateSettings')}</summary>
        <div class="tag-catalog-candidate-summary" id="${UI_ELEMENT_IDS.TAG_CATALOG_CANDIDATE_LIMITS}"></div>
        <div class="tag-catalog-candidate-rules">
          ${t('tagCatalog.candidateRules')}
        </div>
        <div class="tag-catalog-limit-grid">
          ${candidateLimitInputs()}
        </div>
        <button id="${UI_ELEMENT_IDS.TAG_CATALOG_RESET_CANDIDATE_LIMITS}" class="menu_button" type="button">
          <i class="fa-solid fa-rotate-left"></i> ${t('tagCatalog.resetCandidateLimits')}
        </button>
      </details>

      <details class="tag-catalog-settings">
        <summary>${t('tagCatalog.lastCandidatesTitle')}</summary>
        <div id="${UI_ELEMENT_IDS.TAG_CATALOG_LAST_CANDIDATES}" class="tag-catalog-last-candidates"></div>
        <button id="${UI_ELEMENT_IDS.TAG_CATALOG_REFRESH_LAST_CANDIDATES}" class="menu_button" type="button">
          <i class="fa-solid fa-rotate"></i> ${t('tagCatalog.refreshLastCandidates')}
        </button>
      </details>

      <details class="tag-catalog-settings" id="auto_illustrator_conso_tag_catalog_bridge_panel">
        <summary>${t('tagCatalog.bridgeSettings')}</summary>
        <div class="tag-catalog-bridge-summary" id="${UI_ELEMENT_IDS.TAG_CATALOG_BRIDGE_SUMMARY}"></div>
        <div class="tag-catalog-candidate-rules">
          ${t('tagCatalog.bridgeRules')}
        </div>
        <div class="tag-catalog-bridge-form">
          <input id="${UI_ELEMENT_IDS.TAG_CATALOG_BRIDGE_TAG}" class="text_pole" type="text"
                 placeholder="${t('tagCatalog.bridgeTagPlaceholder')}" />
          <div id="${UI_ELEMENT_IDS.TAG_CATALOG_BRIDGE_EXISTING}" class="tag-catalog-bridge-existing"></div>
          <textarea id="${UI_ELEMENT_IDS.TAG_CATALOG_BRIDGE_TRIGGERS}" class="text_pole textarea_compact"
                    rows="2" placeholder="${t('tagCatalog.bridgeTriggersPlaceholder')}"></textarea>
          <button id="${UI_ELEMENT_IDS.TAG_CATALOG_SAVE_BRIDGE_TRIGGERS}" class="menu_button" type="button">
            <i class="fa-solid fa-link"></i> ${t('tagCatalog.saveBridgeTriggers')}
          </button>
        </div>
      </details>

      <details class="tag-catalog-settings">
        <summary>${t('tagCatalog.customTitle')}</summary>
        <div class="tag-catalog-custom-form">
          <textarea id="${UI_ELEMENT_IDS.TAG_CATALOG_CUSTOM_TAG}" class="text_pole textarea_compact"
                    rows="2" placeholder="${t('tagCatalog.customTagPlaceholder')}"></textarea>
          <input id="${UI_ELEMENT_IDS.TAG_CATALOG_CUSTOM_LABEL}" class="text_pole" type="text"
                 placeholder="${t('tagCatalog.customLabelPlaceholder')}" />
          <textarea id="${UI_ELEMENT_IDS.TAG_CATALOG_CUSTOM_TRIGGERS}" class="text_pole textarea_compact"
                    rows="2" placeholder="${t('tagCatalog.customTriggersPlaceholder')}"></textarea>
          <select id="${UI_ELEMENT_IDS.TAG_CATALOG_CUSTOM_CATEGORY}" class="text_pole">
            ${categoryOptions(false)}
          </select>
          <button id="${UI_ELEMENT_IDS.TAG_CATALOG_ADD_CUSTOM}" class="menu_button" type="button">
            <i class="fa-solid fa-plus"></i> ${t('tagCatalog.addCustom')}
          </button>
        </div>
      </details>

      <div class="tag-catalog-selected-row">
        <div class="tag-catalog-selected-hint">${t('tagCatalog.selectedHint')}</div>
        <div id="${UI_ELEMENT_IDS.TAG_CATALOG_SELECTED}" class="tag-catalog-selected"></div>
        <div class="tag-catalog-actions">
          <button id="${UI_ELEMENT_IDS.TAG_CATALOG_COPY_SELECTED}" class="menu_button" type="button">
            <i class="fa-regular fa-copy"></i> ${t('tagCatalog.copySelected')}
          </button>
          <button id="${UI_ELEMENT_IDS.TAG_CATALOG_ADD_COMMON}" class="menu_button" type="button">
            <i class="fa-solid fa-plus"></i> ${t('tagCatalog.addToCommon')}
          </button>
          <button id="${UI_ELEMENT_IDS.TAG_CATALOG_DELETE_CUSTOM_SELECTED}" class="menu_button" type="button">
            <i class="fa-regular fa-trash-can"></i> ${t('tagCatalog.deleteCustomSelected')}
          </button>
          <button id="${UI_ELEMENT_IDS.TAG_CATALOG_CLEAR_SELECTED}" class="menu_button" type="button">
            <i class="fa-solid fa-xmark"></i> ${t('tagCatalog.clear')}
          </button>
        </div>
      </div>

      <div class="tag-catalog-page-row">
        <div id="${UI_ELEMENT_IDS.TAG_CATALOG_COUNT}" class="tag-catalog-count"></div>
        <div class="tag-catalog-page-controls">
          <select id="${UI_ELEMENT_IDS.TAG_CATALOG_PAGE_SIZE}" class="text_pole">
            ${pageSizeOptions()}
          </select>
          <button id="${UI_ELEMENT_IDS.TAG_CATALOG_PAGE_PREV}" class="menu_button" type="button">
            <i class="fa-solid fa-chevron-left"></i> ${t('tagCatalog.prevPage')}
          </button>
          <span id="${UI_ELEMENT_IDS.TAG_CATALOG_PAGE_STATUS}" class="tag-catalog-page-status"></span>
          <button id="${UI_ELEMENT_IDS.TAG_CATALOG_PAGE_NEXT}" class="menu_button" type="button">
            ${t('tagCatalog.nextPage')} <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>
      <div class="tag-catalog-list-wrap">
        <div id="${UI_ELEMENT_IDS.TAG_CATALOG_LIST}" class="tag-catalog-list"></div>
      </div>
    </div>
  `;
}

function getFilters(): {query: string; category: string; source: string} {
  const search = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_SEARCH
  ) as HTMLInputElement | null;
  const category = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_CATEGORY
  ) as HTMLSelectElement | null;
  const source = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_SOURCE_FILTER
  ) as HTMLSelectElement | null;
  return {
    query: search?.value.trim().toLowerCase() || '',
    category: category?.value || '',
    source: source?.value || '',
  };
}

function filteredEntries(): TagCatalogEntry[] {
  const {query, category, source} = getFilters();
  return mergedEntries()
    .filter(entry => !category || entry.category === category)
    .filter(entry => {
      if (!source) return true;
      if (source === 'unbridged') return !hasBridgeTrigger(entry);
      if (source === 'user-trigger') return hasUserTrigger(entry);
      return entry.source === source;
    })
    .filter(entry => {
      if (!query) return true;
      return (
        entry.tag.toLowerCase().includes(query) ||
        entry.label.toLowerCase().includes(query) ||
        entryTriggers(entry).some(trigger =>
          trigger.toLowerCase().includes(query)
        )
      );
    });
}

function pageEntries(entries: TagCatalogEntry[]): TagCatalogEntry[] {
  if (currentPageSize === TAG_CATALOG_PAGE_SIZE.ALL) {
    currentPage = 1;
    return entries;
  }
  const totalPages = Math.max(1, Math.ceil(entries.length / currentPageSize));
  currentPage = Math.max(1, Math.min(currentPage, totalPages));
  const start = (currentPage - 1) * currentPageSize;
  return entries.slice(start, start + currentPageSize);
}

function categoryStats(): string {
  const counts = new Map<string, number>();
  for (const entry of mergedEntries()) {
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }
  return TAG_CATALOG_CATEGORIES.map(
    category => `${categoryLabel(category)} ${counts.get(category) ?? 0}`
  ).join(' / ');
}

function candidateLimitTotal(): number {
  const limits =
    settingsRef?.tagCatalogCandidateLimits ??
    TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS;
  return Object.values(limits).reduce((sum, value) => sum + value, 0);
}

function syncCandidateLimitInputs(): void {
  document
    .querySelectorAll<HTMLInputElement>('.tag-catalog-limit-input')
    .forEach(input => {
      const category = input.dataset.category || '';
      input.value = String(
        settingsRef?.tagCatalogCandidateLimits?.[category] ??
          TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS[category] ??
          0
      );
    });
}

function renderSummary(): void {
  const total = document.getElementById(UI_ELEMENT_IDS.TAG_CATALOG_TOTAL);
  if (total) {
    total.textContent = t('tagCatalog.total', {
      total: mergedEntries().length,
      builtIn: catalog.entries.length,
      custom: getCustomEntries().length,
      stats: categoryStats(),
    });
  }

  const candidateSummary = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_CANDIDATE_LIMITS
  );
  if (candidateSummary) {
    candidateSummary.textContent = t('tagCatalog.candidateSummary', {
      total: candidateLimitTotal(),
    });
  }

  const bridgeSummary = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_BRIDGE_SUMMARY
  );
  if (bridgeSummary) {
    const userTriggerCount = Object.keys(customTriggerOverrides()).length;
    bridgeSummary.textContent = t('tagCatalog.bridgeSummary', {
      bridged: bridgeReport.summary.bridgedTags,
      total: bridgeReport.summary.candidateTags,
      unbridged: bridgeReport.summary.unbridgedTags,
      ratio: Math.round(bridgeReport.summary.bridgedRatio * 100),
      user: userTriggerCount,
    });
  }
}

function renderSelected(): void {
  const selected = document.getElementById(UI_ELEMENT_IDS.TAG_CATALOG_SELECTED);
  if (!selected) return;

  const tags = [...selectedTags];
  if (tags.length === 0) {
    selected.innerHTML = `<span class="tag-catalog-empty">${t('tagCatalog.noSelected')}</span>`;
    return;
  }

  selected.innerHTML = tags
    .map(
      tag =>
        `<button class="tag-catalog-selected-chip" data-tag="${htmlEncode(tag)}" type="button">${htmlEncode(tag)} <span>&times;</span></button>`
    )
    .join('');
}

function renderLastCandidates(): void {
  const container = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_LAST_CANDIDATES
  );
  if (!container) return;

  const snapshot = getLastTagCatalogCandidateSnapshot();
  if (!snapshot) {
    container.innerHTML = `<div class="tag-catalog-empty">${t('tagCatalog.lastCandidatesEmpty')}</div>`;
    return;
  }

  const time = new Date(snapshot.createdAt).toLocaleString();
  const bucketHtml =
    snapshot.buckets.length > 0
      ? snapshot.buckets
          .map(
            bucket => `
              <div class="tag-catalog-last-bucket">
                <strong>${htmlEncode(categoryLabel(bucket.category))}</strong>
                <div class="tag-catalog-last-tags">${bucket.tags
                  .map(tag => `<span>${htmlEncode(tag)}</span>`)
                  .join('')}</div>
              </div>
            `
          )
          .join('')
      : `<div class="tag-catalog-empty">${t('tagCatalog.lastCandidatesNoTags')}</div>`;

  container.innerHTML = `
    <div class="tag-catalog-last-meta">${t('tagCatalog.lastCandidatesMeta', {
      time,
      total: snapshot.total,
    })}</div>
    <div class="tag-catalog-last-source">${htmlEncode(snapshot.sourceText || '-')}</div>
    ${bucketHtml}
  `;
}

function renderCatalog(): void {
  const list = document.getElementById(UI_ELEMENT_IDS.TAG_CATALOG_LIST);
  const count = document.getElementById(UI_ELEMENT_IDS.TAG_CATALOG_COUNT);
  const pageStatus = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_PAGE_STATUS
  );
  const prev = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_PAGE_PREV
  ) as HTMLButtonElement | null;
  const next = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_PAGE_NEXT
  ) as HTMLButtonElement | null;
  if (!list) return;

  const allFiltered = filteredEntries();
  const entries = pageEntries(allFiltered);
  const totalPages =
    currentPageSize === TAG_CATALOG_PAGE_SIZE.ALL
      ? 1
      : Math.max(1, Math.ceil(allFiltered.length / currentPageSize));
  const start =
    allFiltered.length === 0
      ? 0
      : currentPageSize === TAG_CATALOG_PAGE_SIZE.ALL
        ? 1
        : (currentPage - 1) * currentPageSize + 1;
  const end = allFiltered.length === 0 ? 0 : start + entries.length - 1;

  if (count) {
    count.textContent = t('tagCatalog.count', {
      start,
      end,
      total: allFiltered.length,
      catalogTotal: mergedEntries().length,
    });
  }
  if (pageStatus) {
    pageStatus.textContent = t('tagCatalog.pageStatus', {
      page: currentPage,
      total: totalPages,
    });
  }
  if (prev) {
    prev.disabled =
      currentPageSize === TAG_CATALOG_PAGE_SIZE.ALL || currentPage <= 1;
  }
  if (next) {
    next.disabled =
      currentPageSize === TAG_CATALOG_PAGE_SIZE.ALL ||
      currentPage >= totalPages;
  }

  if (entries.length === 0) {
    list.innerHTML = `<div class="tag-catalog-empty">${t('tagCatalog.noMatch')}</div>`;
    renderSelected();
    renderSummary();
    return;
  }

  list.innerHTML = entries
    .map(entry => {
      const checked = selectedTags.has(entry.tag);
      const sourceLabel =
        entry.source === 'user'
          ? `<span class="tag-catalog-source">${t('tagCatalog.customBadge')}</span>`
          : '';
      const bridgeLabel = !hasBridgeTrigger(entry)
        ? `<span class="tag-catalog-source tag-catalog-source-warning">${t('tagCatalog.unbridgedBadge')}</span>`
        : hasUserTrigger(entry)
          ? `<span class="tag-catalog-source">${t('tagCatalog.userTriggerBadge')}</span>`
          : '';
      const deleteButton =
        entry.source === 'user'
          ? `<span class="tag-catalog-delete-custom" data-delete-custom-tag="${htmlEncode(entry.tag)}" role="button" title="${htmlEncode(t('tagCatalog.deleteCustomOne'))}"><i class="fa-regular fa-trash-can"></i></span>`
          : '';
      const bridgeButton = `<button class="tag-catalog-edit-bridge" data-edit-bridge-tag="${htmlEncode(entry.tag)}" type="button" title="${htmlEncode(t('tagCatalog.editBridgeOne'))}"><i class="fa-solid fa-link"></i><span>${t('tagCatalog.triggerButton')}</span></button>`;
      const triggers = entryTriggers(entry);
      return `
        <div class="tag-catalog-item ${checked ? 'selected' : ''}" data-tag="${htmlEncode(entry.tag)}" role="button" tabindex="0">
          <span class="tag-catalog-tag">
            <span class="tag-catalog-label">${htmlEncode(entry.label)}</span>
            <span class="tag-catalog-card-actions">${bridgeButton}${deleteButton}</span>
          </span>
          <span class="tag-catalog-category">${htmlEncode(categoryLabel(entry.category))}${sourceLabel}${bridgeLabel}</span>
          <span class="tag-catalog-triggers">
            <span class="tag-catalog-triggers-title">${t('tagCatalog.triggersLabel')}</span>
            <span class="tag-catalog-trigger-list">${renderTriggerChips(triggers)}</span>
          </span>
        </div>
      `;
    })
    .join('');
  renderSelected();
  renderSummary();
  renderLastCandidates();
}

function toggleSelectedTag(tag: string): void {
  if (selectedTags.has(tag)) {
    selectedTags.delete(tag);
  } else {
    selectedTags.add(tag);
  }
  renderCatalog();
}

async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
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
    showToast(t('tagCatalog.copied'), 'success');
  } catch {
    showToast(t('tagCatalog.copyFailed'), 'error');
  }
}

function selectedText(): string {
  return [...selectedTags].join(', ');
}

function addSelectedToCommonTags(): void {
  if (!settingsRef) return;
  const tags = [...selectedTags];
  if (tags.length === 0) {
    showToast(t('tagCatalog.noSelectedToast'), 'warning');
    return;
  }

  const existing = parseCommonTags(settingsRef.commonStyleTags || '');
  settingsRef.commonStyleTags = deduplicateTags([...existing, ...tags]).join(
    ', '
  );

  const textarea = document.getElementById(
    UI_ELEMENT_IDS.COMMON_STYLE_TAGS
  ) as HTMLTextAreaElement | null;
  if (textarea) {
    textarea.value = settingsRef.commonStyleTags;
    textarea.dispatchEvent(new Event('change', {bubbles: true}));
  } else {
    saveSettingsFn?.();
  }

  showToast(t('tagCatalog.addedToCommon'), 'success');
}

function updateCandidateLimit(input: HTMLInputElement): void {
  if (!settingsRef) return;
  const category = input.dataset.category;
  if (!category) return;
  const numeric = Number.parseInt(input.value, 10);
  const value = Number.isFinite(numeric)
    ? Math.max(
        TAG_CATALOG_CANDIDATE_LIMIT.MIN,
        Math.min(TAG_CATALOG_CANDIDATE_LIMIT.MAX, numeric)
      )
    : TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS[category] ?? 0;
  input.value = String(value);
  settingsRef.tagCatalogCandidateLimits = {
    ...TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS,
    ...(settingsRef.tagCatalogCandidateLimits ?? {}),
    [category]: value,
  };
  saveSettingsFn?.();
  renderSummary();
}

function resetCandidateLimits(): void {
  if (!settingsRef) return;
  settingsRef.tagCatalogCandidateLimits = {
    ...TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS,
  };
  document
    .querySelectorAll<HTMLInputElement>('.tag-catalog-limit-input')
    .forEach(input => {
      const category = input.dataset.category || '';
      input.value = String(TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS[category] ?? 0);
    });
  saveSettingsFn?.();
  renderSummary();
}

function parseCustomTagInputs(value: string): string[] {
  return deduplicateTags(
    value
      .split(/[\n,，]+/)
      .map(normalizeTagValue)
      .filter(Boolean)
  );
}

function addCustomTag(): void {
  if (!settingsRef) return;
  const tagInput = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_CUSTOM_TAG
  ) as HTMLTextAreaElement | null;
  const labelInput = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_CUSTOM_LABEL
  ) as HTMLInputElement | null;
  const triggersInput = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_CUSTOM_TRIGGERS
  ) as HTMLTextAreaElement | null;
  const categoryInput = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_CUSTOM_CATEGORY
  ) as HTMLSelectElement | null;
  const tags = parseCustomTagInputs(tagInput?.value || '');
  const rawLabel = labelInput?.value.trim() || '';
  const rawTriggers = triggersInput?.value || '';
  const category = categoryInput?.value || 'general';

  if (tags.length === 0) {
    showToast(t('tagCatalog.customTagRequired'), 'warning');
    return;
  }
  if (!validCategories.has(category)) {
    showToast(t('tagCatalog.customCategoryRequired'), 'warning');
    return;
  }

  const labels = rawLabel.split(/[\n,，]+/).map(label => label.trim());
  const triggerGroups = triggerGroupsForTags(rawTriggers, tags.length);
  const existingTags = new Set(mergedEntries().map(entry => entry.tag));
  const skipped = tags.filter(tag => existingTags.has(tag));
  const entriesToAdd = tags.filter(tag => !existingTags.has(tag));

  if (entriesToAdd.length === 0) {
    showToast(
      t('tagCatalog.customDuplicateAll', {
        tags: skipped.slice(0, 8).join(', '),
      }),
      'warning'
    );
    return;
  }

  const nextEntries = [
    ...(settingsRef.customTagCatalogEntries ?? []),
    ...tags
      .map((tag, index) => ({tag, index}))
      .filter(({tag}) => !existingTags.has(tag))
      .map(({tag, index}) => ({
        tag,
        label:
          labels[index] ||
          (tags.length === 1 ? rawLabel : '') ||
          tag.replace(/_/g, ' '),
        category,
        postCount: 0,
        source: 'user' as const,
        ...(triggerGroups[index]?.length
          ? {triggers: triggerGroups[index]}
          : {}),
      })),
  ];
  settingsRef.customTagCatalogEntries = nextEntries;
  if (tagInput) tagInput.value = '';
  if (labelInput) labelInput.value = '';
  if (triggersInput) triggersInput.value = '';
  saveSettingsFn?.();
  showToast(
    skipped.length > 0
      ? t('tagCatalog.customAddedSkipped', {
          count: entriesToAdd.length,
          skipped: skipped.slice(0, 8).join(', '),
        })
      : t('tagCatalog.customAdded', {count: entriesToAdd.length}),
    skipped.length > 0 ? 'warning' : 'success'
  );
  renderCatalog();
}

function deleteCustomTag(tag: string): void {
  if (!settingsRef) return;
  const before = settingsRef.customTagCatalogEntries?.length ?? 0;
  settingsRef.customTagCatalogEntries = (
    settingsRef.customTagCatalogEntries ?? []
  ).filter(entry => entry.tag !== tag);
  if (settingsRef.customTagCatalogEntries.length === before) {
    showToast(t('tagCatalog.noCustomSelected'), 'warning');
    return;
  }
  if (settingsRef.customTagBridgeTriggers) {
    delete settingsRef.customTagBridgeTriggers[tag];
  }
  selectedTags.delete(tag);
  saveSettingsFn?.();
  showToast(t('tagCatalog.customDeleted', {count: 1}), 'success');
  renderCatalog();
}

function deleteSelectedCustomTags(): void {
  if (!settingsRef) return;
  const selected = new Set(selectedTags);
  const before = settingsRef.customTagCatalogEntries?.length ?? 0;
  settingsRef.customTagCatalogEntries = (
    settingsRef.customTagCatalogEntries ?? []
  ).filter(entry => !selected.has(entry.tag));
  const removed = before - settingsRef.customTagCatalogEntries.length;
  if (removed <= 0) {
    showToast(t('tagCatalog.noCustomSelected'), 'warning');
    return;
  }
  for (const tag of selected) selectedTags.delete(tag);
  if (settingsRef.customTagBridgeTriggers) {
    for (const tag of selected) delete settingsRef.customTagBridgeTriggers[tag];
  }
  saveSettingsFn?.();
  showToast(t('tagCatalog.customDeleted', {count: removed}), 'success');
  renderCatalog();
}

function fillBridgeForm(tag: string): void {
  const entry = findEntryByTag(tag);
  if (!entry) return;
  const tagInput = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_BRIDGE_TAG
  ) as HTMLInputElement | null;
  const triggersInput = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_BRIDGE_TRIGGERS
  ) as HTMLTextAreaElement | null;
  const existingTriggers = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_BRIDGE_EXISTING
  );
  const panel = document.getElementById(
    'auto_illustrator_conso_tag_catalog_bridge_panel'
  ) as HTMLDetailsElement | null;
  if (panel) panel.open = true;
  if (tagInput) tagInput.value = entry.tag;
  if (existingTriggers) {
    existingTriggers.innerHTML = `
      <span>${t('tagCatalog.existingTriggers')}</span>
      <div class="tag-catalog-trigger-list">${renderTriggerChips(entryTriggers(entry))}</div>
    `;
  }
  if (triggersInput) {
    triggersInput.value = (
      settingsRef?.customTagBridgeTriggers?.[entry.tag] ?? []
    ).join(', ');
    triggersInput.focus();
  }
}

function saveBridgeTriggers(): void {
  if (!settingsRef) return;
  const tagInput = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_BRIDGE_TAG
  ) as HTMLInputElement | null;
  const triggersInput = document.getElementById(
    UI_ELEMENT_IDS.TAG_CATALOG_BRIDGE_TRIGGERS
  ) as HTMLTextAreaElement | null;
  const tag = normalizeTagValue(tagInput?.value || '');
  const entry = findEntryByTag(tag);

  if (!tag) {
    showToast(t('tagCatalog.bridgeTagRequired'), 'warning');
    return;
  }
  if (!entry) {
    showToast(t('tagCatalog.bridgeTagNotFound'), 'warning');
    return;
  }

  const triggers = parseTriggerList(triggersInput?.value || '');
  settingsRef.customTagBridgeTriggers = {
    ...(settingsRef.customTagBridgeTriggers ?? {}),
  };
  if (triggers.length > 0) {
    settingsRef.customTagBridgeTriggers[tag] = triggers;
  } else {
    delete settingsRef.customTagBridgeTriggers[tag];
  }
  saveSettingsFn?.();
  showToast(t('tagCatalog.bridgeSaved', {tag}), 'success');
  renderCatalog();
  fillBridgeForm(tag);
}

export function initializeTagCatalog(
  settings: AutoIllustratorSettings,
  saveFn: () => void
): void {
  settingsRef = settings;
  saveSettingsFn = saveFn;

  if (initialized) {
    syncCandidateLimitInputs();
    renderCatalog();
    return;
  }
  initialized = true;

  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_SEARCH)
    ?.addEventListener('input', () => {
      currentPage = 1;
      renderCatalog();
    });
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_CATEGORY)
    ?.addEventListener('change', () => {
      currentPage = 1;
      renderCatalog();
    });
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_SOURCE_FILTER)
    ?.addEventListener('change', () => {
      currentPage = 1;
      renderCatalog();
    });
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_PAGE_SIZE)
    ?.addEventListener('change', event => {
      const target = event.target as HTMLSelectElement;
      const parsed = Number.parseInt(target.value, 10);
      currentPageSize = TAG_CATALOG_PAGE_SIZE.OPTIONS.includes(
        parsed as (typeof TAG_CATALOG_PAGE_SIZE.OPTIONS)[number]
      )
        ? parsed
        : TAG_CATALOG_PAGE_SIZE.DEFAULT;
      currentPage = 1;
      renderCatalog();
    });
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_PAGE_PREV)
    ?.addEventListener('click', () => {
      currentPage = Math.max(1, currentPage - 1);
      renderCatalog();
    });
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_PAGE_NEXT)
    ?.addEventListener('click', () => {
      currentPage += 1;
      renderCatalog();
    });
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_LIST)
    ?.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      const deleteButton = target.closest<HTMLElement>(
        '[data-delete-custom-tag]'
      );
      const deleteTag = deleteButton?.dataset.deleteCustomTag;
      if (deleteTag) {
        event.preventDefault();
        event.stopPropagation();
        deleteCustomTag(deleteTag);
        return;
      }
      const bridgeButton = target.closest<HTMLElement>(
        '[data-edit-bridge-tag]'
      );
      const bridgeTag = bridgeButton?.dataset.editBridgeTag;
      if (bridgeTag) {
        event.preventDefault();
        event.stopPropagation();
        fillBridgeForm(bridgeTag);
        return;
      }
      const item = target.closest<HTMLElement>('.tag-catalog-item');
      const tag = item?.dataset.tag;
      if (!tag) return;
      toggleSelectedTag(tag);
    });
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_LIST)
    ?.addEventListener('keydown', event => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return;
      const target = keyboardEvent.target as HTMLElement;
      const item = target.closest<HTMLElement>('.tag-catalog-item');
      const tag = item?.dataset.tag;
      if (!tag) return;
      keyboardEvent.preventDefault();
      toggleSelectedTag(tag);
    });
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_SELECTED)
    ?.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      const item = target.closest<HTMLElement>('[data-tag]');
      const tag = item?.dataset.tag;
      if (!tag) return;
      selectedTags.delete(tag);
      renderCatalog();
    });
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_COPY_SELECTED)
    ?.addEventListener('click', () => {
      if (selectedTags.size === 0) {
        showToast(t('tagCatalog.noSelectedToast'), 'warning');
        return;
      }
      copyText(selectedText());
    });
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_CLEAR_SELECTED)
    ?.addEventListener('click', () => {
      selectedTags.clear();
      renderCatalog();
    });
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_ADD_COMMON)
    ?.addEventListener('click', addSelectedToCommonTags);
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_DELETE_CUSTOM_SELECTED)
    ?.addEventListener('click', deleteSelectedCustomTags);
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_ADD_CUSTOM)
    ?.addEventListener('click', addCustomTag);
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_SAVE_BRIDGE_TRIGGERS)
    ?.addEventListener('click', saveBridgeTriggers);
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_RESET_CANDIDATE_LIMITS)
    ?.addEventListener('click', resetCandidateLimits);
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_REFRESH_LAST_CANDIDATES)
    ?.addEventListener('click', renderLastCandidates);
  document
    .getElementById(UI_ELEMENT_IDS.TAG_CATALOG_CANDIDATE_LIMITS)
    ?.closest('.tag-catalog-settings')
    ?.addEventListener('change', event => {
      const target = event.target as HTMLElement;
      if (target instanceof HTMLInputElement) updateCandidateLimit(target);
    });

  syncCandidateLimitInputs();
  renderCatalog();
}
