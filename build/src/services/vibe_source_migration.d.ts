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
import type { VibeLibraryItem } from '../types';
/** Whether any entry still carries inline base64 that could be migrated. */
export declare function needsVibeSourceMigration(settings: AutoIllustratorSettings): boolean;
/**
 * Moves newly imported library-item sources to the backend before settings are
 * saved. On failure, returns the original inline items so source data is never
 * discarded merely because the companion plugin is absent or unavailable.
 */
export declare function migrateVibeLibraryItemsToBackend(items: VibeLibraryItem[]): Promise<{
    items: VibeLibraryItem[];
    migrated: number;
    skipped: boolean;
}>;
/**
 * Runs the migration. Non-blocking-friendly: callers should not await this on
 * the critical startup path. Returns a summary for logging/telemetry.
 */
export declare function migrateVibeSourcesToBackend(settings: AutoIllustratorSettings, context: SillyTavernContext): Promise<{
    migrated: number;
    skipped: boolean;
}>;
