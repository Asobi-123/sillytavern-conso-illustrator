/**
 * Tests for World Info Service
 */

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  fetchAllWorldBookNames,
  fetchWorldBookEntries,
  getCharacterWorldBookName,
  clearWorldBookCache,
} from './worldinfo_service';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock SillyTavern global
vi.stubGlobal('SillyTavern', {
  getContext: vi.fn().mockReturnValue({
    characterId: 0,
    characters: [
      {
        name: 'TestChar',
        data: {extensions: {world: 'TestCharWorld'}},
      },
    ],
  }),
});

describe('worldinfo_service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWorldBookCache();

    // Default: CSRF token fetch succeeds
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/csrf-token') {
        return {
          ok: true,
          json: async () => ({token: 'test-csrf-token'}),
        };
      }
      return {ok: false, status: 404};
    });
  });

  afterEach(() => {
    clearWorldBookCache();
  });

  describe('fetchAllWorldBookNames', () => {
    it('should return world book names from settings API', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/csrf-token') {
          return {ok: true, json: async () => ({token: 'tk'})};
        }
        if (url === '/api/settings/get') {
          return {
            ok: true,
            json: async () => ({world_names: ['BookA', 'BookB', 'BookC']}),
          };
        }
        return {ok: false, status: 404};
      });

      const names = await fetchAllWorldBookNames();
      expect(names).toEqual(['BookA', 'BookB', 'BookC']);
    });

    it('should return empty array if no world_names', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/csrf-token') {
          return {ok: true, json: async () => ({token: 'tk'})};
        }
        if (url === '/api/settings/get') {
          return {ok: true, json: async () => ({})};
        }
        return {ok: false, status: 404};
      });

      const names = await fetchAllWorldBookNames();
      expect(names).toEqual([]);
    });

    it('should throw on API failure', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/csrf-token') {
          return {ok: true, json: async () => ({token: 'tk'})};
        }
        return {ok: false, status: 500};
      });

      await expect(fetchAllWorldBookNames()).rejects.toThrow(
        'Failed to fetch settings: 500'
      );
    });
  });

  describe('fetchWorldBookEntries', () => {
    const mockEntries = {
      entries: {
        0: {
          uid: 1,
          comment: 'Entry1',
          content: 'Content1',
          key: ['k1'],
          disable: false,
          constant: false,
        },
        1: {
          uid: 2,
          comment: 'Entry2',
          content: 'Content2',
          key: ['k2', 'k3'],
          disable: true,
          constant: true,
        },
      },
    };

    it('should parse and return world book entries', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/csrf-token') {
          return {ok: true, json: async () => ({token: 'tk'})};
        }
        if (url === '/api/worldinfo/get') {
          return {ok: true, json: async () => mockEntries};
        }
        return {ok: false, status: 404};
      });

      const entries = await fetchWorldBookEntries('TestBook');
      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({
        uid: 1,
        comment: 'Entry1',
        content: 'Content1',
        key: ['k1'],
        disable: false,
        constant: false,
      });
      expect(entries[1]).toEqual({
        uid: 2,
        comment: 'Entry2',
        content: 'Content2',
        key: ['k2', 'k3'],
        disable: true,
        constant: true,
      });
    });

    it('should use cache on second call', async () => {
      let fetchCount = 0;
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/csrf-token') {
          return {ok: true, json: async () => ({token: 'tk'})};
        }
        if (url === '/api/worldinfo/get') {
          fetchCount++;
          return {ok: true, json: async () => mockEntries};
        }
        return {ok: false, status: 404};
      });

      await fetchWorldBookEntries('CachedBook');
      await fetchWorldBookEntries('CachedBook');

      // /api/worldinfo/get should only be called once (cached second time)
      expect(fetchCount).toBe(1);
    });

    it('should bypass cache with forceRefresh', async () => {
      let fetchCount = 0;
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/csrf-token') {
          return {ok: true, json: async () => ({token: 'tk'})};
        }
        if (url === '/api/worldinfo/get') {
          fetchCount++;
          return {ok: true, json: async () => mockEntries};
        }
        return {ok: false, status: 404};
      });

      await fetchWorldBookEntries('FreshBook');
      await fetchWorldBookEntries('FreshBook', true);

      expect(fetchCount).toBe(2);
    });

    it('should handle empty entries', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/csrf-token') {
          return {ok: true, json: async () => ({token: 'tk'})};
        }
        if (url === '/api/worldinfo/get') {
          return {ok: true, json: async () => ({entries: {}})};
        }
        return {ok: false, status: 404};
      });

      const entries = await fetchWorldBookEntries('EmptyBook');
      expect(entries).toEqual([]);
    });
  });

  describe('getCharacterWorldBookName', () => {
    it('should return character world book name', () => {
      const name = getCharacterWorldBookName();
      expect(name).toBe('TestCharWorld');
    });

    it('should return null if no world book bound', () => {
      vi.mocked(SillyTavern.getContext).mockReturnValueOnce({
        characterId: 0,
        characters: [{name: 'NoWorld', data: {extensions: {}}}],
      } as unknown as SillyTavernContext);

      const name = getCharacterWorldBookName();
      expect(name).toBeNull();
    });
  });

  describe('clearWorldBookCache', () => {
    it('should clear cache so next fetch hits API', async () => {
      let fetchCount = 0;
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/csrf-token') {
          return {ok: true, json: async () => ({token: 'tk'})};
        }
        if (url === '/api/worldinfo/get') {
          fetchCount++;
          return {ok: true, json: async () => ({entries: {}})};
        }
        return {ok: false, status: 404};
      });

      await fetchWorldBookEntries('ClearTest');
      expect(fetchCount).toBe(1);

      clearWorldBookCache();
      await fetchWorldBookEntries('ClearTest');
      expect(fetchCount).toBe(2);
    });
  });
});
