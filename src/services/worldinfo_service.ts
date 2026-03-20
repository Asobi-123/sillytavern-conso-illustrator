/**
 * World Info Service
 * Fetches world book data from SillyTavern's internal API.
 */

import {createLogger} from '../logger';
import type {WorldInfoEntry} from '../types';

const logger = createLogger('WorldInfoService');

/** Cached CSRF token */
let csrfToken: string | null = null;

/** World book entries cache: bookName -> { entries, expiry } */
const entryCache = new Map<
  string,
  {entries: WorldInfoEntry[]; expiry: number}
>();

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetches the CSRF token from SillyTavern (lazy, cached).
 */
async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const response = await fetch('/csrf-token');
  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF token: ${response.status}`);
  }
  const data = await response.json();
  csrfToken = data.token as string;
  logger.debug('CSRF token acquired');
  return csrfToken;
}

/**
 * Returns headers required for SillyTavern internal API calls.
 */
async function getInternalRequestHeaders(): Promise<Record<string, string>> {
  const token = await fetchCsrfToken();
  return {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
  };
}

/**
 * Fetches all world book names from SillyTavern settings.
 * @returns Array of world book names
 */
export async function fetchAllWorldBookNames(): Promise<string[]> {
  logger.debug('Fetching world book names');

  const response = await fetch('/api/settings/get', {
    method: 'POST',
    headers: await getInternalRequestHeaders(),
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch settings: ${response.status}`);
  }

  const data = await response.json();
  const names: string[] = data?.world_names ?? [];
  logger.debug(`Found ${names.length} world books`);
  return names;
}

/**
 * Fetches entries for a specific world book.
 * Results are cached for CACHE_TTL_MS.
 *
 * @param name - World book name
 * @param forceRefresh - Bypass cache
 * @returns Array of WorldInfoEntry
 */
export async function fetchWorldBookEntries(
  name: string,
  forceRefresh = false
): Promise<WorldInfoEntry[]> {
  // Check cache
  if (!forceRefresh) {
    const cached = entryCache.get(name);
    if (cached && Date.now() < cached.expiry) {
      logger.trace(`Cache hit for world book "${name}"`);
      return cached.entries;
    }
  }

  logger.debug(`Fetching entries for world book "${name}"`);

  const response = await fetch('/api/worldinfo/get', {
    method: 'POST',
    headers: await getInternalRequestHeaders(),
    body: JSON.stringify({name}),
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch world book "${name}": ${response.status}`);
  }

  const data = await response.json();
  // SillyTavern returns { entries: { 0: {...}, 1: {...}, ... } }
  const rawEntries = data?.entries ?? {};
  const entries: WorldInfoEntry[] = [];

  for (const value of Object.values(rawEntries)) {
    const entry = value as Record<string, unknown>;
    entries.push({
      uid: (entry.uid as number) ?? 0,
      comment: String(entry.comment ?? ''),
      content: String(entry.content ?? ''),
      key: Array.isArray(entry.key) ? (entry.key as string[]) : [],
      disable: Boolean(entry.disable),
      constant: Boolean(entry.constant),
    });
  }

  // Sort by uid for stable ordering
  entries.sort((a, b) => a.uid - b.uid);

  // Cache the result
  entryCache.set(name, {entries, expiry: Date.now() + CACHE_TTL_MS});
  logger.debug(`Cached ${entries.length} entries for world book "${name}"`);

  return entries;
}

/**
 * Gets the world book name bound to the current character.
 * @returns World book name or null if none bound
 */
export function getCharacterWorldBookName(): string | null {
  try {
    const context = SillyTavern.getContext();
    const charId = context.characterId;
    const character = context.characters?.[charId];
    const worldName = character?.data?.extensions?.world;
    return typeof worldName === 'string' && worldName.length > 0
      ? worldName
      : null;
  } catch {
    logger.debug('Could not get character world book name');
    return null;
  }
}

/**
 * Clears all cached world book data.
 * Call on chat switch or manual refresh.
 */
export function clearWorldBookCache(): void {
  entryCache.clear();
  // Also reset CSRF token so it refreshes on next call
  csrfToken = null;
  logger.debug('World book cache cleared');
}
