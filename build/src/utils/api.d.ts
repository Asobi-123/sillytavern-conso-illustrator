/**
 * Helpers for SillyTavern internal API calls.
 */
/**
 * Fetches the CSRF token from SillyTavern (lazy, cached).
 */
export declare function fetchCsrfToken(): Promise<string>;
/**
 * Returns headers required for SillyTavern internal JSON API calls.
 */
export declare function getInternalRequestHeaders(): Promise<Record<string, string>>;
/**
 * Clears the cached CSRF token. Used by tests and retry paths.
 */
export declare function clearCsrfTokenCache(): void;
