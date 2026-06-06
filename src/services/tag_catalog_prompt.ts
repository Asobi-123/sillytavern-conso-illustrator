/**
 * Builds a small prompt-writing aid from the bundled tag catalog.
 *
 * Runtime never fetches network data. The full catalog stays local; only a
 * compact, target-text-derived vocabulary subset is sent to the LLM.
 */

import rawCatalog from '../data/tag_catalog.json';
import rawZhBridge from '../data/zh_tag_bridge.generated.json';
import {TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS} from '../constants';
import type {
  TagCatalog,
  TagCatalogCandidateSnapshot,
  TagCatalogEntry,
  ZhTagBridge,
} from '../types';
import {deduplicateTags} from './prompt_tags';

const catalog = rawCatalog as TagCatalog;
const zhBridge = rawZhBridge as ZhTagBridge;
let lastCandidateSnapshot: TagCatalogCandidateSnapshot | null = null;

function normalizeUserTagEntry(entry: TagCatalogEntry): TagCatalogEntry {
  const tag = entry.tag.trim();
  return {
    ...entry,
    tag,
    label: entry.label?.trim() || tag,
    postCount: Number.isFinite(entry.postCount) ? entry.postCount : 0,
    source: 'user',
    triggers: Array.isArray(entry.triggers)
      ? [
          ...new Set(
            entry.triggers.map(trigger => trigger.trim()).filter(Boolean)
          ),
        ]
      : undefined,
  };
}

function buildEntries(settings?: AutoIllustratorSettings): TagCatalogEntry[] {
  const merged = new Map<string, TagCatalogEntry>();
  for (const entry of catalog.entries) {
    merged.set(entry.tag, {...entry, source: entry.source ?? 'built-in'});
  }
  for (const entry of settings?.customTagCatalogEntries ?? []) {
    const normalized = normalizeUserTagEntry(entry);
    if (normalized.tag) merged.set(normalized.tag, normalized);
  }
  return [...merged.values()];
}

function buildEntriesByTag(
  settings?: AutoIllustratorSettings
): Map<string, TagCatalogEntry> {
  return new Map(buildEntries(settings).map(entry => [entry.tag, entry]));
}

function candidateLimits(
  settings?: AutoIllustratorSettings
): Record<string, number> {
  return {
    ...TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS,
    ...(settings?.tagCatalogCandidateLimits ?? {}),
  };
}

const COMMON_FALLBACK_TAGS = [
  '1girl',
  '1boy',
  'solo',
  '2girls',
  '2boys',
  'multiple_girls',
  'looking_at_viewer',
  'smile',
  'standing',
  'sitting',
  'indoors',
  'outdoors',
  'night',
  'day',
  'upper_body',
  'full_body',
  'close-up',
  'from_side',
  'depth_of_field',
];

const MANUAL_NORMALIZATION_ALIASES = new Map<string, string>([
  ['hanfu', 'chinese_clothes'],
  ['ancient chinese clothing', 'chinese_clothes'],
  ['chinese clothing', 'chinese_clothes'],
  ['china dress', 'china_dress'],
]);

const CATEGORY_ORDER = [
  'subject',
  'hair',
  'eyes',
  'expression',
  'pose_action',
  'clothing',
  'scene',
  'camera',
  'lighting_style',
  'general',
];

const BUILT_IN_SINGLE_CHARACTER_ZH_TRIGGERS = new Set([
  '雨',
  '雪',
  '雾',
  '风',
  '云',
]);

interface CandidatePoolItem {
  entry: TagCatalogEntry;
  priority: number;
}

function normalize(value: string): string {
  return ` ${value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function buildEntriesByNormalizedAlias(
  settings?: AutoIllustratorSettings
): Map<string, TagCatalogEntry> {
  const entriesByNormalizedAlias = new Map<string, TagCatalogEntry>();
  for (const entry of buildEntries(settings)) {
    if (entry.category === 'undesired_content') continue;
    entriesByNormalizedAlias.set(normalize(entry.tag).trim(), entry);
    entriesByNormalizedAlias.set(normalize(entry.label).trim(), entry);
  }
  return entriesByNormalizedAlias;
}

function words(value: string): string[] {
  return normalize(value)
    .trim()
    .split(' ')
    .filter(word => word.length > 2);
}

function phraseMatches(
  phrase: string,
  normalizedText: string,
  lowerText: string,
  options?: {allowSingleChinese?: boolean}
): boolean {
  const trimmed = phrase.trim();
  if (!trimmed) return false;
  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    const compact = trimmed.replace(/\s+/g, '');
    if (
      compact.length < 2 &&
      !options?.allowSingleChinese &&
      !BUILT_IN_SINGLE_CHARACTER_ZH_TRIGGERS.has(compact)
    ) {
      return false;
    }
    return lowerText.includes(compact.toLowerCase());
  }
  return normalizedText.includes(normalize(trimmed));
}

function entryMatchesText(
  entry: TagCatalogEntry,
  normalizedText: string
): boolean {
  const normalizedLabel = normalize(entry.label);
  if (normalizedLabel.trim().length <= 2) return false;
  if (normalizedText.includes(normalizedLabel)) return true;

  const labelWords = words(entry.label);
  if (labelWords.length < 2) return false;

  const distinctiveWords = labelWords.filter(word => word.length >= 4);
  if (distinctiveWords.length === 0) return false;

  return labelWords.every(word => normalizedText.includes(` ${word} `));
}

function addEntryToPool(
  pools: Map<string, CandidatePoolItem[]>,
  seen: Set<string>,
  entry: TagCatalogEntry,
  limits: Record<string, number>,
  priority = 1
): void {
  if (seen.has(entry.tag)) return;
  const limit = limits[entry.category] ?? 0;
  if (limit <= 0) return;

  const pool = pools.get(entry.category) ?? [];
  pool.push({entry, priority});
  pools.set(entry.category, pool);
  seen.add(entry.tag);
}

function sampleEntries(
  entries: TagCatalogEntry[],
  limit: number
): TagCatalogEntry[] {
  if (limit <= 0) return [];
  if (entries.length <= limit) return [...entries];

  const pool = [...entries];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, limit);
}

function sampleCandidatePool(
  entries: CandidatePoolItem[],
  limit: number
): TagCatalogEntry[] {
  const selected: TagCatalogEntry[] = [];
  const priorities = [...new Set(entries.map(item => item.priority))].sort(
    (a, b) => a - b
  );

  for (const priority of priorities) {
    const remaining = limit - selected.length;
    if (remaining <= 0) break;
    selected.push(
      ...sampleEntries(
        entries
          .filter(item => item.priority === priority)
          .map(item => item.entry),
        remaining
      )
    );
  }

  return selected;
}

function buildBridgeByTag(
  settings?: AutoIllustratorSettings
): Map<string, {triggers: string[]; englishAliases: string[]}> {
  const bridgeByTag = new Map<
    string,
    {triggers: string[]; englishAliases: string[]}
  >();

  for (const entry of zhBridge.entries) {
    bridgeByTag.set(entry.tag, {
      triggers: [...entry.triggers],
      englishAliases: [...entry.englishAliases],
    });
  }

  for (const entry of buildEntries(settings)) {
    const existing = bridgeByTag.get(entry.tag) ?? {
      triggers: [],
      englishAliases: [],
    };
    bridgeByTag.set(entry.tag, {
      triggers: [
        ...new Set(
          existing.triggers.map(trigger => trigger.trim()).filter(Boolean)
        ),
      ],
      englishAliases: [
        ...new Set(
          [
            ...existing.englishAliases,
            entry.tag,
            entry.label,
            entry.tag.replace(/_/g, ' '),
          ]
            .map(alias => alias.trim())
            .filter(Boolean)
        ),
      ],
    });
  }

  return bridgeByTag;
}

function entryMatchesBridge(
  entry: TagCatalogEntry,
  bridgeByTag: Map<string, {triggers: string[]; englishAliases: string[]}>,
  normalizedText: string,
  lowerText: string
): boolean {
  const bridge = bridgeByTag.get(entry.tag);
  if (!bridge) return false;
  return [...bridge.triggers, ...bridge.englishAliases].some(phrase =>
    phraseMatches(phrase, normalizedText, lowerText)
  );
}

function entryMatchesUserTriggers(
  entry: TagCatalogEntry,
  settings: AutoIllustratorSettings | undefined,
  normalizedText: string,
  lowerText: string
): boolean {
  return [
    ...(entry.triggers ?? []),
    ...(settings?.customTagBridgeTriggers?.[entry.tag] ?? []),
  ].some(phrase =>
    phraseMatches(phrase, normalizedText, lowerText, {
      allowSingleChinese: true,
    })
  );
}

function formatBucket(category: string, entries: TagCatalogEntry[]): string {
  return `${category}: ${entries.map(entry => entry.tag).join(', ')}`;
}

function saveCandidateSnapshot(
  sourceText: string,
  buckets: Map<string, TagCatalogEntry[]>
): void {
  const bucketEntries = CATEGORY_ORDER.map(category => {
    const entries = buckets.get(category) ?? [];
    return entries.length > 0
      ? {category, tags: entries.map(entry => entry.tag)}
      : null;
  }).filter(
    (entry): entry is {category: string; tags: string[]} => entry !== null
  );

  lastCandidateSnapshot = {
    createdAt: new Date().toISOString(),
    sourceText: sourceText.trim(),
    total: bucketEntries.reduce((sum, entry) => sum + entry.tags.length, 0),
    buckets: bucketEntries,
  };
}

export function getLastTagCatalogCandidateSnapshot(): TagCatalogCandidateSnapshot | null {
  return lastCandidateSnapshot;
}

function canonicalTagName(
  value: string,
  entriesByTag: Map<string, TagCatalogEntry>,
  entriesByNormalizedAlias: Map<string, TagCatalogEntry>
): string | null {
  const key = normalize(value).trim();
  const manualAlias = MANUAL_NORMALIZATION_ALIASES.get(key);
  if (manualAlias && entriesByTag.has(manualAlias)) return manualAlias;
  return entriesByNormalizedAlias.get(key)?.tag ?? null;
}

function normalizeWeightedTag(
  tag: string,
  entriesByTag: Map<string, TagCatalogEntry>,
  entriesByNormalizedAlias: Map<string, TagCatalogEntry>
): string {
  const numericWeight = tag.match(/^(-?\d+(?:\.\d+)?)::(.+)::$/);
  if (numericWeight) {
    const inner = canonicalTagName(
      numericWeight[2],
      entriesByTag,
      entriesByNormalizedAlias
    );
    return inner ? `${numericWeight[1]}::${inner}::` : tag;
  }

  const parenWeight = tag.match(/^\((.+):(\d+(?:\.\d+)?)\)$/);
  if (parenWeight) {
    const inner = canonicalTagName(
      parenWeight[1],
      entriesByTag,
      entriesByNormalizedAlias
    );
    return inner ? `(${inner}:${parenWeight[2]})` : tag;
  }

  return tag;
}

function normalizeEmphasisWrapper(
  tag: string,
  entriesByTag: Map<string, TagCatalogEntry>,
  entriesByNormalizedAlias: Map<string, TagCatalogEntry>
): string {
  const wrapped = tag.match(/^([{[]+)(.+?)([}\]]+)$/);
  if (!wrapped) {
    return normalizeWeightedTag(tag, entriesByTag, entriesByNormalizedAlias);
  }

  const inner = canonicalTagName(
    wrapped[2],
    entriesByTag,
    entriesByNormalizedAlias
  );
  return inner
    ? `${wrapped[1]}${inner}${wrapped[3]}`
    : normalizeWeightedTag(tag, entriesByTag, entriesByNormalizedAlias);
}

function parsePromptTagsPreservingGroups(tagsString: string): string[] {
  const tags: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of tagsString) {
    if (char === '{' || char === '[' || char === '(') depth++;
    if (char === '}' || char === ']' || char === ')') {
      depth = Math.max(0, depth - 1);
    }

    if (char === ',' && depth === 0) {
      const tag = current.trim();
      if (tag) tags.push(tag);
      current = '';
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) tags.push(trailing);
  return tags;
}

function normalizePromptSegment(
  segment: string,
  entriesByTag: Map<string, TagCatalogEntry>,
  entriesByNormalizedAlias: Map<string, TagCatalogEntry>
): string {
  const tags = parsePromptTagsPreservingGroups(segment).map(tag => {
    if (tag.includes('#')) return tag;

    const weighted = normalizeEmphasisWrapper(
      tag,
      entriesByTag,
      entriesByNormalizedAlias
    );
    if (weighted !== tag) return weighted;

    return canonicalTagName(tag, entriesByTag, entriesByNormalizedAlias) ?? tag;
  });

  return deduplicateTags(tags).join(', ');
}

function normalizePositivePromptText(
  text: string,
  entriesByTag: Map<string, TagCatalogEntry>,
  entriesByNormalizedAlias: Map<string, TagCatalogEntry>
): string {
  return text
    .split('|')
    .map(segment =>
      normalizePromptSegment(
        segment.trim(),
        entriesByTag,
        entriesByNormalizedAlias
      )
    )
    .join(' | ');
}

function normalizeStructuredPositiveLine(
  line: string,
  entriesByTag: Map<string, TagCatalogEntry>,
  entriesByNormalizedAlias: Map<string, TagCatalogEntry>
): string | null {
  const match = line.match(
    /^(\s*(?:Scene\s+Composition|Character\s+\d+\s+Prompt)\s*:\s*)(.*)$/i
  );
  if (!match) return null;

  const prefix = match[1];
  const body = match[2];
  const suffixMatch = body.match(/(\s*,?\s*;\s*)$/);
  const suffix = suffixMatch?.[1] ?? '';
  const bodyWithoutSuffix = suffix
    ? body.slice(0, body.length - suffix.length)
    : body;
  const normalized = normalizePositivePromptText(
    bodyWithoutSuffix.trim(),
    entriesByTag,
    entriesByNormalizedAlias
  );

  return `${prefix}${normalized}${suffix}`;
}

function isStructuredUcLine(line: string): boolean {
  return /^\s*Character\s+\d+\s+UC\s*:/i.test(line);
}

export function normalizePromptTagsWithCatalog(
  prompt: string,
  settings?: AutoIllustratorSettings
): string {
  if (!prompt.trim()) return prompt;
  const entriesByTag = buildEntriesByTag(settings);
  const entriesByNormalizedAlias = buildEntriesByNormalizedAlias(settings);
  if (
    prompt.includes('\n') &&
    /(?:Scene\s+Composition|Character\s+\d+\s+(?:Prompt|UC))\s*:/i.test(prompt)
  ) {
    return prompt
      .split('\n')
      .map(line => {
        if (isStructuredUcLine(line)) return line;
        return (
          normalizeStructuredPositiveLine(
            line,
            entriesByTag,
            entriesByNormalizedAlias
          ) ?? line
        );
      })
      .join('\n');
  }
  return normalizePositivePromptText(
    prompt,
    entriesByTag,
    entriesByNormalizedAlias
  );
}

export function buildTagCatalogPromptGuidance(
  sourceText: string,
  settings?: AutoIllustratorSettings
): string {
  const normalizedText = normalize(sourceText);
  const lowerText = sourceText.toLowerCase();
  const matchedPools = new Map<string, CandidatePoolItem[]>();
  const fallbackPools = new Map<string, CandidatePoolItem[]>();
  const buckets = new Map<string, TagCatalogEntry[]>();
  const matchedSeen = new Set<string>();
  const fallbackSeen = new Set<string>();
  const entriesByTag = buildEntriesByTag(settings);
  const bridgeByTag = buildBridgeByTag(settings);
  const limits = candidateLimits(settings);

  for (const entry of buildEntries(settings)) {
    if (entry.category === 'undesired_content') continue;
    const matchesUserTriggers = entryMatchesUserTriggers(
      entry,
      settings,
      normalizedText,
      lowerText
    );
    if (
      !matchesUserTriggers &&
      !entryMatchesBridge(entry, bridgeByTag, normalizedText, lowerText) &&
      !entryMatchesText(entry, normalizedText)
    ) {
      continue;
    }
    addEntryToPool(
      matchedPools,
      matchedSeen,
      entry,
      limits,
      matchesUserTriggers ? 0 : 1
    );
  }

  for (const tag of COMMON_FALLBACK_TAGS) {
    const entry = entriesByTag.get(tag);
    if (entry) addEntryToPool(fallbackPools, fallbackSeen, entry, limits, 2);
  }

  for (const category of CATEGORY_ORDER) {
    const limit = limits[category] ?? 0;
    if (limit <= 0) continue;

    const sampledMatches = sampleCandidatePool(
      matchedPools.get(category) ?? [],
      limit
    );
    const selectedTags = new Set(sampledMatches.map(entry => entry.tag));
    const remaining = limit - sampledMatches.length;
    const sampledFallbacks =
      remaining > 0
        ? sampleEntries(
            (fallbackPools.get(category) ?? [])
              .filter(item => !selectedTags.has(item.entry.tag))
              .map(item => item.entry),
            remaining
          )
        : [];
    const selected = [...sampledMatches, ...sampledFallbacks];
    if (selected.length > 0) buckets.set(category, selected);
  }

  saveCandidateSnapshot(sourceText, buckets);

  const lines = CATEGORY_ORDER.map(category => {
    const entries = buckets.get(category) ?? [];
    return entries.length > 0 ? formatBucket(category, entries) : '';
  }).filter(Boolean);

  if (lines.length === 0) return '';

  return `Built-in tag catalog aid:
- These are vocabulary candidates, not scene facts.
- Chinese text is matched through the bundled zh tag bridge and user trigger overrides; tags without a bridge are not silently assumed.
- For each ---PROMPT---, only use a candidate if it is visually supported by that prompt's own selected scene and insertion point.
- Do not borrow clothing, expression, pose, or objects from another part of the message or from previous context.
- Character identity and stable body appearance are handled by Character Fixed Tags when configured. If they are not configured, use only explicit character info, persona info, or scene text; do not invent appearance from catalog candidates.
- Prefer catalog spellings over vague free text when they describe the same confirmed visual detail.
${lines.join('\n')}`;
}
