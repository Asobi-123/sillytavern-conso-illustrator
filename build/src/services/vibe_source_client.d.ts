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
/** Thrown-free result marker: backend route is absent (old / uninstalled plugin). */
export declare class VibeSourceBackendUnavailableError extends Error {
    constructor(message?: string);
}
/**
 * Uploads source images (base64 or data URLs) to the backend store and returns
 * their content hashes, one per input, in order.
 *
 * @throws {VibeSourceBackendUnavailableError} when the backend route is missing
 */
export declare function storeVibeSources(images: string[]): Promise<string[]>;
/**
 * Uploads a single source image and returns its content hash.
 * @throws {VibeSourceBackendUnavailableError} when the backend route is missing
 */
export declare function storeVibeSource(image: string): Promise<string>;
/**
 * Returns the subset of `hashes` that currently exist on the backend disk.
 * Returns an empty array (not an error) when the backend is unavailable, so
 * callers treat every source as "needs re-upload" and keep working.
 */
export declare function checkVibeSources(hashes: string[]): Promise<Set<string>>;
/**
 * Builds the URL a browser `<img>` can load to render a stored source image.
 */
export declare function getVibeSourceUrl(hash: string): string;
/** Loads a stored source back into a data URL for standards-compatible export. */
export declare function fetchVibeSourceDataUrl(hash: string): Promise<string>;
/**
 * Deletes backend sources not present in `keepHashes`. Best-effort: never
 * throws, returns the number removed (0 when unavailable or on error).
 */
export declare function pruneVibeSources(keepHashes: Iterable<string>): Promise<number>;
