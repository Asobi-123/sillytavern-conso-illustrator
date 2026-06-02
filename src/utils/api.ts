/**
 * Helpers for SillyTavern internal API calls.
 */

/** Cached CSRF token shared by internal API callers. */
let csrfToken: string | null = null;

/**
 * Fetches the CSRF token from SillyTavern (lazy, cached).
 */
export async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const response = await fetch('/csrf-token');
  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF token: ${response.status}`);
  }
  const data = await response.json();
  csrfToken = data.token as string;
  return csrfToken;
}

/**
 * Returns headers required for SillyTavern internal JSON API calls.
 */
export async function getInternalRequestHeaders(): Promise<
  Record<string, string>
> {
  const token = await fetchCsrfToken();
  return {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
  };
}

/**
 * Clears the cached CSRF token. Used by tests and retry paths.
 */
export function clearCsrfTokenCache(): void {
  csrfToken = null;
}
