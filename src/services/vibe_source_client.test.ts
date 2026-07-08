import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  checkVibeSources,
  getVibeSourceUrl,
  pruneVibeSources,
  storeVibeSource,
  storeVibeSources,
  VibeSourceBackendUnavailableError,
} from './vibe_source_client';
import {VIBE_SOURCE_ROUTES} from '../constants';
import {clearCsrfTokenCache} from '../utils/api';

vi.mock('../logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
    handler(url, init)
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

describe('vibe_source_client', () => {
  beforeEach(() => {
    clearCsrfTokenCache();
    // /csrf-token is fetched lazily by getInternalRequestHeaders.
    mockFetch(url => {
      if (url === '/csrf-token') {
        return jsonResponse({token: 'test-csrf'});
      }
      throw new Error(`unexpected url ${url}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCsrfTokenCache();
  });

  it('uploads images and returns their content hashes in order', async () => {
    mockFetch(url => {
      if (url === '/csrf-token') return jsonResponse({token: 'test-csrf'});
      if (url === VIBE_SOURCE_ROUTES.STORE) {
        return jsonResponse({hashes: ['hash-a', 'hash-b']});
      }
      throw new Error(`unexpected url ${url}`);
    });

    const hashes = await storeVibeSources(['imgA', 'imgB']);
    expect(hashes).toEqual(['hash-a', 'hash-b']);
  });

  it('returns an empty array without calling the backend for no images', async () => {
    const fetchMock = mockFetch(() => jsonResponse({hashes: []}));
    const hashes = await storeVibeSources([]);
    expect(hashes).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws VibeSourceBackendUnavailableError on 404 (old/absent plugin)', async () => {
    mockFetch(url => {
      if (url === '/csrf-token') return jsonResponse({token: 'test-csrf'});
      if (url === VIBE_SOURCE_ROUTES.STORE) {
        return new Response('not found', {status: 404});
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(storeVibeSources(['imgA'])).rejects.toBeInstanceOf(
      VibeSourceBackendUnavailableError
    );
  });

  it('storeVibeSource returns the single hash', async () => {
    mockFetch(url => {
      if (url === '/csrf-token') return jsonResponse({token: 'test-csrf'});
      if (url === VIBE_SOURCE_ROUTES.STORE) {
        return jsonResponse({hashes: ['only-hash']});
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(storeVibeSource('imgA')).resolves.toBe('only-hash');
  });

  it('checkVibeSources returns the present subset', async () => {
    mockFetch(url => {
      if (url === '/csrf-token') return jsonResponse({token: 'test-csrf'});
      if (url === VIBE_SOURCE_ROUTES.CHECK) {
        return jsonResponse({present: ['h1', 'h3']});
      }
      throw new Error(`unexpected url ${url}`);
    });

    const present = await checkVibeSources(['h1', 'h2', 'h3']);
    expect(present.has('h1')).toBe(true);
    expect(present.has('h2')).toBe(false);
    expect(present.has('h3')).toBe(true);
  });

  it('checkVibeSources degrades to empty set when backend errors', async () => {
    mockFetch(url => {
      if (url === '/csrf-token') return jsonResponse({token: 'test-csrf'});
      if (url === VIBE_SOURCE_ROUTES.CHECK) {
        return new Response('boom', {status: 500});
      }
      throw new Error(`unexpected url ${url}`);
    });

    const present = await checkVibeSources(['h1']);
    expect(present.size).toBe(0);
  });

  it('pruneVibeSources returns removed count and never throws', async () => {
    mockFetch(url => {
      if (url === '/csrf-token') return jsonResponse({token: 'test-csrf'});
      if (url === VIBE_SOURCE_ROUTES.PRUNE) {
        return jsonResponse({removed: 3, remaining: 9});
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(pruneVibeSources(['keep1', 'keep2'])).resolves.toBe(3);
  });

  it('pruneVibeSources returns 0 on network failure', async () => {
    mockFetch(url => {
      if (url === '/csrf-token') return jsonResponse({token: 'test-csrf'});
      throw new Error('network down');
    });

    await expect(pruneVibeSources(['keep1'])).resolves.toBe(0);
  });

  it('getVibeSourceUrl builds an encoded backend URL', () => {
    expect(getVibeSourceUrl('abc123')).toBe(
      `${VIBE_SOURCE_ROUTES.FETCH_BASE}/abc123`
    );
  });
});
