/**
 * One-shot migration that moves inline Vibe source image base64 out of
 * settings.json and into the content-addressed backend store.
 *
 * Historically the compressed reference thumbnail was stored as base64 in three
 * places per image: `VibeTransferReferenceImage.dataUrl`,
 * `VibeLibraryItem.source.dataUrl` and `VibeLibraryItem.previewImage`. With a
 * dozen references that inflated settings.json to tens of megabytes and slowed
 * every settings read/write. This migration uploads each distinct image to the
 * backend once (deduplicated by content hash there) and replaces the inline
 * base64 with a short `hash` / `sourceHash` reference plus the mime type.
 *
 * Safety: the migration is best-effort and reversible in spirit. If the backend
 * plugin is missing or too old, nothing is changed and the inline data is kept,
 * so an out-of-date server plugin never loses images or breaks generation. The
 * `source.fingerprint` used for encode-cache matching is preserved untouched, so
 * moving the bytes never invalidates an existing encoded vibe.
 */

import type {VibeLibraryItem, VibeTransferReferenceImage} from '../types';
import {createLogger} from '../logger';
import {saveSettings} from '../settings';
import {
  storeVibeSources,
  VibeSourceBackendUnavailableError,
} from './vibe_source_client';

const logger = createLogger('VibeSourceMigration');

/** Returns true when the string looks like inline image base64 / data URL. */
function isInlineImage(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Extracts the mime type from a data URL prefix, when present. */
function mimeFromDataUrl(value: string): string | undefined {
  return value.match(/^data:([^;,]+)/)?.[1];
}

/**
 * Collects every distinct inline base64 payload across library items and legacy
 * references, so each is uploaded exactly once regardless of how many entries
 * share it.
 */
function collectInlineImages(settings: AutoIllustratorSettings): string[] {
  const seen = new Set<string>();
  const push = (value: unknown): void => {
    if (isInlineImage(value)) seen.add(value);
  };

  const items = Array.isArray(settings.vibeTransferLibraryItems)
    ? settings.vibeTransferLibraryItems
    : [];
  collectInlineLibraryImages(items).forEach(push);

  const refs = Array.isArray(settings.vibeTransferReferenceImages)
    ? settings.vibeTransferReferenceImages
    : [];
  for (const ref of refs) {
    if (ref.sourceHash) continue; // already migrated
    push(ref.dataUrl);
  }

  return [...seen];
}

function collectInlineLibraryImages(items: VibeLibraryItem[]): string[] {
  const images = new Set<string>();
  for (const item of items) {
    if (item.source?.hash) continue;
    const inline = isInlineImage(item.source?.dataUrl)
      ? item.source.dataUrl
      : isInlineImage(item.previewImage)
        ? item.previewImage
        : undefined;
    if (inline) images.add(inline);
  }
  return [...images];
}

/** Whether any entry still carries inline base64 that could be migrated. */
export function needsVibeSourceMigration(
  settings: AutoIllustratorSettings
): boolean {
  return collectInlineImages(settings).length > 0;
}

function migrateLibraryItem(
  item: VibeLibraryItem,
  hashByImage: Map<string, string>
): {item: VibeLibraryItem; changed: boolean} {
  if (item.source?.hash) return {item, changed: false};

  const inline = isInlineImage(item.source?.dataUrl)
    ? item.source?.dataUrl
    : isInlineImage(item.previewImage)
      ? item.previewImage
      : undefined;
  if (!inline) return {item, changed: false};

  const hash = hashByImage.get(inline);
  if (!hash) return {item, changed: false};

  const mimeType =
    item.source?.mimeType ?? mimeFromDataUrl(inline) ?? 'image/jpeg';
  const nextSource = {
    ...(item.source ?? {}),
    hash,
    mimeType,
  };
  // Drop the inline base64 from both the source and the preview mirror.
  delete nextSource.dataUrl;
  const next: VibeLibraryItem = {
    ...item,
    source: nextSource,
  };
  if (next.previewImage === inline) {
    delete next.previewImage;
  }
  return {item: next, changed: true};
}

/**
 * Moves newly imported library-item sources to the backend before settings are
 * saved. On failure, returns the original inline items so source data is never
 * discarded merely because the companion plugin is absent or unavailable.
 */
export async function migrateVibeLibraryItemsToBackend(
  items: VibeLibraryItem[]
): Promise<{
  items: VibeLibraryItem[];
  migrated: number;
  skipped: boolean;
}> {
  const images = collectInlineLibraryImages(items);
  if (images.length === 0) {
    return {items, migrated: 0, skipped: false};
  }

  let hashes: string[];
  try {
    hashes = await storeVibeSources(images);
  } catch (error) {
    logger.warn('Imported Vibe source upload failed; keeping inline:', error);
    return {items, migrated: 0, skipped: true};
  }
  if (hashes.length !== images.length) {
    logger.warn(
      'Imported Vibe source upload returned a mismatched hash count.'
    );
    return {items, migrated: 0, skipped: true};
  }

  const hashByImage = new Map<string, string>();
  images.forEach((image, index) => hashByImage.set(image, hashes[index]));
  let migrated = 0;
  const migratedItems = items.map(item => {
    const result = migrateLibraryItem(item, hashByImage);
    if (result.changed) migrated += 1;
    return result.item;
  });
  return {items: migratedItems, migrated, skipped: false};
}

function migrateLegacyReference(
  ref: VibeTransferReferenceImage,
  hashByImage: Map<string, string>
): {ref: VibeTransferReferenceImage; changed: boolean} {
  if (ref.sourceHash) return {ref, changed: false};
  if (!isInlineImage(ref.dataUrl)) return {ref, changed: false};

  const hash = hashByImage.get(ref.dataUrl);
  if (!hash) return {ref, changed: false};

  return {
    ref: {
      ...ref,
      sourceHash: hash,
      sourceMimeType: ref.sourceMimeType ?? mimeFromDataUrl(ref.dataUrl),
      dataUrl: '',
    },
    changed: true,
  };
}

/**
 * Runs the migration. Non-blocking-friendly: callers should not await this on
 * the critical startup path. Returns a summary for logging/telemetry.
 */
export async function migrateVibeSourcesToBackend(
  settings: AutoIllustratorSettings,
  context: SillyTavernContext
): Promise<{migrated: number; skipped: boolean}> {
  const images = collectInlineImages(settings);
  if (images.length === 0) {
    return {migrated: 0, skipped: false};
  }

  let hashes: string[];
  try {
    hashes = await storeVibeSources(images);
  } catch (error) {
    if (error instanceof VibeSourceBackendUnavailableError) {
      logger.info(
        'Server plugin does not support vibe source store yet; keeping inline images. Update the backend plugin and restart SillyTavern to slim settings.json.'
      );
      return {migrated: 0, skipped: true};
    }
    logger.warn('Vibe source migration upload failed; keeping inline:', error);
    return {migrated: 0, skipped: true};
  }

  if (hashes.length !== images.length) {
    logger.warn('Vibe source migration got mismatched hash count; aborting.');
    return {migrated: 0, skipped: true};
  }

  const hashByImage = new Map<string, string>();
  images.forEach((image, index) => hashByImage.set(image, hashes[index]));

  let changed = 0;

  if (Array.isArray(settings.vibeTransferLibraryItems)) {
    settings.vibeTransferLibraryItems = settings.vibeTransferLibraryItems.map(
      item => {
        const result = migrateLibraryItem(item, hashByImage);
        if (result.changed) changed += 1;
        return result.item;
      }
    );
  }

  if (Array.isArray(settings.vibeTransferReferenceImages)) {
    settings.vibeTransferReferenceImages =
      settings.vibeTransferReferenceImages.map(ref => {
        const result = migrateLegacyReference(ref, hashByImage);
        if (result.changed) changed += 1;
        return result.ref;
      });
  }

  if (changed > 0) {
    saveSettings(settings, context);
    logger.info(
      `Migrated ${changed} vibe source entr${changed === 1 ? 'y' : 'ies'} to backend store (${images.length} distinct image${images.length === 1 ? '' : 's'}).`
    );
  }

  return {migrated: changed, skipped: false};
}
