/**
 * World Info Service
 * Fetches world book data from SillyTavern's internal API.
 */
import type { WorldInfoEntry } from '../types';
/**
 * Fetches all world book names from SillyTavern settings.
 * @returns Array of world book names
 */
export declare function fetchAllWorldBookNames(): Promise<string[]>;
/**
 * Fetches entries for a specific world book.
 * Results are cached for CACHE_TTL_MS.
 *
 * @param name - World book name
 * @param forceRefresh - Bypass cache
 * @returns Array of WorldInfoEntry
 */
export declare function fetchWorldBookEntries(name: string, forceRefresh?: boolean): Promise<WorldInfoEntry[]>;
/**
 * Gets the world book name bound to the current character.
 * @returns World book name or null if none bound
 */
export declare function getCharacterWorldBookName(): string | null;
/**
 * Clears all cached world book data.
 * Call on chat switch or manual refresh.
 */
export declare function clearWorldBookCache(): void;
