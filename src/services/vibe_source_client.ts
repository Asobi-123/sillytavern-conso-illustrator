/**
 * Client for the backend content-addressed Vibe source image store.
 *
 * Source images (compressed reference thumbnails) used to live inline as base64
 * inside SillyTavern's settings.json, duplicated across
 * `vibeTransferReferenceImages` and `vibeTransferLibraryItems`. That bloated
 * settings.json to tens of megabytes and slowed every settings read/write.
 *
 * These helpers move the raw bytes to disk via the companion server plugin,
 * keyed by content hash, so settings only needs to keep a short hash reference.
 * Every call degrades gracefully: when the server plugin is missing or too old
 * (returns 404), callers keep the inline base64 they already have.
 */

import {VIBE_SOURCE_ROUTES} from '../constants';
import {createLogger} from '../logger';
import {getInternalRequestHeaders} from '../utils/api';

const logger = createLogger('VibeSourceClient');

/** Thrown-free result marker: backend route is absent (old / uninstalled plugin). */
export class VibeSourceBackendUnavailableError extends Error {
  constructor(message = 'Vibe source backend route is unavailable') {
    super(message);
    this.name = 'VibeSourceBackendUnavailableError';
  }
}

function isNotFound(status: number): boolean {
  return status === 404;
}

/**
 * Uploads source images (base64 or data URLs) to the backend store and returns
 * their content hashes, one per input, in order.
 *
 * @throws {VibeSourceBackendUnavailableError} when the backend route is missing
 */
export async function storeVibeSources(images: string[]): Promise<string[]> {
  if (images.length === 0) return [];
  const response = await fetch(VIBE_SOURCE_ROUTES.STORE, {
    method: 'POST',
    headers: await getInternalRequestHeaders(),
    body: JSON.stringify({images}),
  });

  if (isNotFound(response.status)) {
    throw new VibeSourceBackendUnavailableError();
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Vibe source store failed: ${response.status} ${detail || ''}`.trim()
    );
  }

  const data = (await response.json()) as {hashes?: unknown};
  if (
    !Array.isArray(data.hashes) ||
    !data.hashes.every((hash): hash is string => typeof hash === 'string')
  ) {
    throw new Error('Vibe source store returned an invalid response');
  }
  return data.hashes;
}

/**
 * Uploads a single source image and returns its content hash.
 * @throws {VibeSourceBackendUnavailableError} when the backend route is missing
 */
export async function storeVibeSource(image: string): Promise<string> {
  const [hash] = await storeVibeSources([image]);
  if (typeof hash !== 'string' || hash.length === 0) {
    throw new Error('Vibe source store returned no hash');
  }
  return hash;
}

/**
 * Returns the subset of `hashes` that currently exist on the backend disk.
 * Returns an empty array (not an error) when the backend is unavailable, so
 * callers treat every source as "needs re-upload" and keep working.
 */
export async function checkVibeSources(hashes: string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  try {
    const response = await fetch(VIBE_SOURCE_ROUTES.CHECK, {
      method: 'POST',
      headers: await getInternalRequestHeaders(),
      body: JSON.stringify({hashes}),
    });
    if (!response.ok) {
      return new Set();
    }
    const data = (await response.json()) as {present?: unknown};
    if (!Array.isArray(data.present)) return new Set();
    return new Set(
      data.present.filter((hash): hash is string => typeof hash === 'string')
    );
  } catch (error) {
    logger.debug('checkVibeSources failed, treating all as absent:', error);
    return new Set();
  }
}

/**
 * Builds the URL a browser `<img>` can load to render a stored source image.
 */
export function getVibeSourceUrl(hash: string): string {
  return `${VIBE_SOURCE_ROUTES.FETCH_BASE}/${encodeURIComponent(hash)}`;
}

/**
 * Deletes backend sources not present in `keepHashes`. Best-effort: never
 * throws, returns the number removed (0 when unavailable or on error).
 */
export async function pruneVibeSources(
  keepHashes: Iterable<string>
): Promise<number> {
  const keep = [...new Set(keepHashes)].filter(
    hash => typeof hash === 'string' && hash.length > 0
  );
  try {
    const response = await fetch(VIBE_SOURCE_ROUTES.PRUNE, {
      method: 'POST',
      headers: await getInternalRequestHeaders(),
      body: JSON.stringify({keep}),
    });
    if (!response.ok) return 0;
    const data = (await response.json()) as {removed?: unknown};
    return typeof data.removed === 'number' ? data.removed : 0;
  } catch (error) {
    logger.debug('pruneVibeSources failed:', error);
    return 0;
  }
}
