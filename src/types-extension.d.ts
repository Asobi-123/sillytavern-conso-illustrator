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
  }
}

export {};
