/**
 * Type extensions for Auto Illustrator settings
 */

declare global {
  interface AutoIllustratorSettings {
    /** Image retention period in days (1-7) */
    imageRetentionDays?: number;
    /** Prompt library entries stored in extension settings */
    promptLibraryEntries?: import('./types').PromptLibraryEntry[];
    /** Prompt library max entries limit */
    promptLibraryMaxEntries?: number;
    /** Whether prompt library should store thumbnails */
    promptLibrarySaveThumbnail?: boolean;
    /** User-added tag catalog entries */
    customTagCatalogEntries?: import('./types').TagCatalogEntry[];
    /** User-maintained Chinese trigger words for built-in or custom catalog tags */
    customTagBridgeTriggers?: Record<string, string[]>;
    /** Per-category max candidate counts sent to the LLM catalog aid */
    tagCatalogCandidateLimits?: Record<string, number>;
    /** Built-in NovelAI quality tag preset selected for image generation. */
    novelAiQualityPresetId?: import('./services/novelai_presets').NovelAiQualityPresetId;
    /** Built-in NovelAI undesired-content preset selected for image generation. */
    novelAiUcPresetId?: import('./services/novelai_presets').NovelAiUcPresetId;
  }
}

export {};
