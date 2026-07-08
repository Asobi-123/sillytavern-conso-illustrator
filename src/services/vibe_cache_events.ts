export const VIBE_CACHE_UPDATED_EVENT = 'auto-illustrator:vibe-cache-updated';

export function notifyVibeCacheUpdated(): void {
  document.dispatchEvent(new CustomEvent(VIBE_CACHE_UPDATED_EVENT));
}
