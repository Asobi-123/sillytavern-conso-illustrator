/**
 * Type Definitions Module
 * Centralized type definitions for the Auto Illustrator extension
 */
/**
 * State of a queued image generation prompt
 */
export type PromptState = 'DETECTED' | 'QUEUED' | 'GENERATING' | 'COMPLETED' | 'FAILED';
/**
 * A queued image generation prompt with metadata
 */
export interface QueuedPrompt {
    /** Unique identifier (hash of prompt + position) */
    id: string;
    /** The image generation prompt text */
    prompt: string;
    /** The full matched tag (e.g., '<!--img-prompt="..."-->', '<img-prompt="...">', etc.) */
    fullMatch: string;
    /** Start index in the message text */
    startIndex: number;
    /** End index in the message text */
    endIndex: number;
    /** Current state of the prompt */
    state: PromptState;
    /** Generated image URL (if completed) */
    imageUrl?: string;
    /** Error message (if failed) */
    error?: string;
    /** Number of generation attempts */
    attempts: number;
    /** Timestamp when prompt was detected */
    detectedAt: number;
    /** Timestamp when generation started */
    generationStartedAt?: number;
    /** Timestamp when completed/failed */
    completedAt?: number;
    /** Hash of message text at detection time */
    messageHash?: string;
    /** Which image to replace (URL of existing image) */
    targetImageUrl?: string;
    /** Prompt being regenerated (links to PromptNode.id from prompt_manager) */
    targetPromptId?: string;
    /** How to insert the regenerated image (default: 'replace-image') */
    insertionMode?: ImageInsertionMode;
}
/**
 * Deferred image for batch insertion after streaming completes
 */
export interface DeferredImage {
    /** The queued prompt metadata */
    prompt: QueuedPrompt;
    /** Generated image URL (or placeholder HTML if isFailed is true) */
    imageUrl: string;
    /** Links to PromptNode.id from prompt_manager for image association tracking */
    promptId: string;
    /** Prompt text preview (truncated for display) */
    promptPreview?: string;
    /** Random SD Style / Vibe picks used for this generation */
    randomization?: GenerationRandomizationMetadata;
    /** Timestamp when image was generated */
    completedAt: number;
    /** When true, imageUrl contains placeholder HTML instead of a URL (generation failed) */
    isFailed?: boolean;
}
/**
 * Match result for an image prompt extracted from text
 */
export interface ImagePromptMatch {
    /** The full matched text (e.g., '<img-prompt="...">') */
    fullMatch: string;
    /** The extracted prompt text (unescaped) */
    prompt: string;
    /** Start index of the match in the text */
    startIndex: number;
    /** End index of the match in the text */
    endIndex: number;
}
/**
 * Manual generation mode type
 */
export type ManualGenerationMode = 'replace' | 'append';
/**
 * Style tag position type
 */
export type StyleTagPosition = 'prefix' | 'suffix';
/**
 * Auto-illustrator metadata stored per-chat
 */
export interface AutoIllustratorChatMetadata {
    /** Prompt registry (from prompt_manager.ts) - primary storage for all prompt data */
    promptRegistry?: import('./prompt_manager').PromptRegistry;
    /** Random SD Style / Vibe picks used by generated images, keyed by normalized image URL */
    imageRandomizations?: Record<string, GenerationRandomizationMetadata>;
    /** Gallery widget state (per-chat) */
    galleryWidget?: GalleryWidgetState;
    /** Custom subfolder label for image storage (per-chat) */
    imageSubfolderLabel?: string;
    /** World info injection configuration (per-chat) */
    worldInfoConfig?: PluginWorldInfoConfig;
    /** Manually added character tag keys for this chat (per-chat) */
    manualCharacterTagKeys?: string[];
    /** Manually added NPC tag profiles, scoped to this chat. */
    manualCharacterTags?: Record<string, CharacterFixedTagEntry>;
}
/**
 * Gallery widget state stored in chat metadata
 */
export interface GalleryWidgetState {
    /** Whether the gallery widget is visible */
    visible: boolean;
    /** Whether the gallery is minimized to FAB */
    minimized: boolean;
    /** Array of message IDs that are expanded in the gallery */
    expandedMessages: number[];
    /** Message ordering in gallery: newest-first or oldest-first */
    messageOrder?: 'newest-first' | 'oldest-first';
}
/**
 * SillyTavern's chat metadata structure
 * Contains auto_illustrator metadata and potentially other extensions' data
 */
export interface ChatMetadata {
    auto_illustrator?: AutoIllustratorChatMetadata;
    [key: string]: unknown;
}
/**
 * Session type - streaming or regeneration (mutually exclusive)
 */
export type SessionType = 'streaming' | 'regeneration';
/**
 * Image insertion modes for controlling where images are placed
 */
export type ImageInsertionMode = 'replace-image' | 'append-after-image' | 'append-after-prompt';
/**
 * Represents a generation session (streaming or regeneration) with all its components
 * Used by SessionManager to track active generation state
 */
export interface GenerationSession {
    /** Unique identifier for this session */
    readonly sessionId: string;
    /** Message ID being processed */
    readonly messageId: number;
    /** Type of session - streaming or regeneration */
    readonly type: SessionType;
    /** Queue of prompts for this session */
    readonly queue: import('./streaming_image_queue').ImageGenerationQueue;
    /** Processor that generates images */
    readonly processor: import('./queue_processor').QueueProcessor;
    /** AbortController for cancelling this session */
    readonly abortController: AbortController;
    /** Monitor that detects new prompts during streaming (streaming only) */
    readonly monitor?: import('./streaming_monitor').StreamingMonitor;
    /** Timestamp when session started */
    readonly startedAt: number;
    /** Extension settings (needed for image display width) */
    readonly settings: AutoIllustratorSettings;
}
/** World book entry (only fields the plugin needs) */
export interface WorldInfoEntry {
    uid: number;
    /** Entry name/title */
    comment: string;
    /** Entry body text */
    content: string;
    /** Keywords (display only) */
    key: string[];
    /** SillyTavern's disable state (plugin ignores this) */
    disable: boolean;
    /** Whether the entry is constant/always-active */
    constant: boolean;
}
/** Character fixed tag entry for locking visual tags per character */
export interface CharacterFixedTagEntry {
    /** All name aliases for this character (any match triggers injection) */
    names: string[];
    /** Comma-separated fixed tags */
    tags: string;
    /** Whether this entry is enabled */
    enabled: boolean;
}
/** Versioned fixed-tag profiles, partitioned by their owning runtime entity. */
export interface CharacterFixedTagScopes {
    schemaVersion: 2;
    /** Profiles keyed by the SillyTavern character card avatar filename. */
    characters: Record<string, CharacterFixedTagEntry>;
    /** Profiles keyed by the SillyTavern persona avatar filename. */
    personas: Record<string, CharacterFixedTagEntry>;
    /** Legacy global records awaiting explicit owner assignment. Never inject. */
    legacy: Record<string, CharacterFixedTagEntry>;
}
export type CharacterFixedTagInjectionMode = 'legacy' | 'structure-aware' | 'skip-unmatched-multichar';
export interface TagCatalogEntry {
    tag: string;
    label: string;
    category: string;
    postCount: number;
    source?: 'built-in' | 'user';
    triggers?: string[];
}
export interface TagCatalog {
    metadata: {
        version: string;
        source: string;
        generatedAt: string;
        sourceUrl: string;
        sourceCategory: string;
        sourcePages: number;
        minPostCount: number;
        totalFetched: number;
        includedTags: number;
    };
    categories: string[];
    entries: TagCatalogEntry[];
}
export interface ZhTagBridgeEntry {
    tag: string;
    category: string;
    triggers: string[];
    englishAliases: string[];
    coverage: 'bridged' | 'unbridged';
    tokenCoverage: number;
}
export interface ZhTagBridge {
    metadata: {
        version: string;
        generatedAt: string;
        catalogVersion: string;
        catalogHash: string;
        sourceHash: string;
        totalTags: number;
        bridgedTags: number;
        unbridgedTags: number;
    };
    entries: ZhTagBridgeEntry[];
}
export interface TagBridgeReport {
    metadata: {
        generatedAt: string;
        bridgeVersion: string;
        catalogVersion: string;
        catalogHash: string;
        sourceHash: string;
    };
    summary: {
        catalogTags: number;
        candidateTags: number;
        bridgedTags: number;
        unbridgedTags: number;
        bridgedRatio: number;
        categories: Record<string, {
            total: number;
            bridged: number;
            unbridged: number;
            ratio: number;
        }>;
        catalogCategories: Record<string, number>;
    };
    unbridgedHighFrequency: Array<{
        tag: string;
        label: string;
        category: string;
        postCount: number;
    }>;
}
export interface TagCatalogCandidateSnapshot {
    createdAt: string;
    sourceText: string;
    total: number;
    buckets: Array<{
        category: string;
        tags: string[];
    }>;
}
/** Standalone prompt generation result (no INSERT_AFTER/INSERT_BEFORE) */
export interface StandalonePromptResult {
    text: string;
    reasoning?: string;
}
/** Per-book entry override state */
export interface PluginWorldBookOverrides {
    /** uid -> enabled. Absent = off (default off) */
    entryOverrides: Record<number, boolean>;
}
/** Per-chat world info configuration */
export interface PluginWorldInfoConfig {
    selectedWorldBooks: string[];
    worldBookOverrides: Record<string, PluginWorldBookOverrides>;
    /** Whether auto-initialization has been performed (prevents re-adding character default book) */
    initialized?: boolean;
}
/** NovelAI image generation parameters extracted from PNG metadata */
export interface NovelAiParameters {
    steps?: number;
    sampler?: string;
    seed?: number;
    /** CFG scale */
    scale?: number;
    width?: number;
    height?: number;
    strength?: number;
    noise?: number;
    model?: string;
    /** Preserve any unknown parameters from the metadata */
    [key: string]: unknown;
}
/** A saved entry in the prompt library */
export interface PromptLibraryEntry {
    /** Unique identifier */
    id: string;
    /** User-defined display name */
    name: string;
    /** Positive prompt (NovelAI "prompt" field) */
    positivePrompt: string;
    /** Negative prompt (NovelAI "uc" field) */
    negativePrompt: string;
    /** Generation parameters (read-only reference) */
    parameters: NovelAiParameters;
    /** Base64 JPEG thumbnail for visual reference */
    thumbnail?: string;
    /** User-defined tags for categorization */
    tags: string[];
    /** User-defined character prompt (manually split from positive prompt) */
    characterPrompt: string;
    /** Timestamp when entry was created */
    createdAt: number;
    /** Timestamp when entry was last modified */
    updatedAt: number;
}
/** Encoded Vibe cache entry for NovelAI V4/V4.5 models. */
export interface VibeTransferEncodedCache {
    /** NovelAI model this encoding was created for */
    model: string;
    /** Information Extracted value used when encoding */
    informationExtracted: number;
    /** Fingerprint of the source image data */
    sourceFingerprint: string;
    /** Encoded vibe string returned by NovelAI */
    encoded: string;
    /** Timestamp when the cache was created */
    createdAt: number;
}
export interface VibeBundleEncodingVariant {
    /** Encoded vibe string returned by NovelAI or imported from a bundle */
    encoding: string;
    /** Parameters associated with the imported or generated encoding */
    params?: {
        information_extracted?: number;
    };
    /** Timestamp when this local encoding cache was created, when known */
    createdAt?: number;
}
export type VibeBundleEncodings = Record<string, Record<string, VibeBundleEncodingVariant>>;
export interface VibeLibrarySource {
    /**
     * Browser data URL kept locally for preview and optional re-encoding.
     * Omitted once the bytes are stored on the backend (see `hash`); the UI and
     * re-encode path then load the image from the server by content hash.
     */
    dataUrl?: string;
    /**
     * SHA-256 content hash of the raw source bytes, stored on the backend via the
     * vibe-source route. When set, the inline `dataUrl` can be dropped to keep
     * settings.json small.
     */
    hash?: string;
    /** Fingerprint of the source image data */
    fingerprint?: string;
    /** Source MIME type when known */
    mimeType?: string;
}
export interface VibeLibraryImportInfo {
    /** Model name from a standard bundle import */
    model?: string;
    /** Bundle information_extracted metadata */
    information_extracted?: number;
    /** Bundle strength metadata */
    strength?: number;
    /** Original external Vibe ID when a local collision required remapping */
    externalId?: string;
    /** File name or source label of the imported bundle */
    sourceName?: string;
    /** Import timestamp */
    importedAt?: number;
}
export interface VibeLibraryGenerationSettings {
    /** Legacy migration flag; current UI always uses the per-vibe strength value. */
    inheritGlobalStrength?: boolean;
    /** Per-vibe strength sent to NovelAI */
    strength?: number;
    /** Legacy migration flag; current UI always uses the per-vibe information value. */
    inheritGlobalInformationExtracted?: boolean;
    /** Per-vibe information_extracted used when selecting or creating encodings */
    information_extracted?: number;
}
export interface VibeLibraryItem {
    /** Stable local identifier */
    id: string;
    /** Preserved bundle/source identifier, if different from the local ID */
    externalId?: string;
    /** User-facing display name */
    name: string;
    /** Whether this vibe participates in generation */
    enabled: boolean;
    /** User-defined tags for search and grouping */
    tags: string[];
    /** Timestamp when the local item was created */
    createdAt: number;
    /** Timestamp when the local item was last modified */
    updatedAt: number;
    /** Optional local source image metadata */
    source?: VibeLibrarySource;
    /** Optional local preview image data URL */
    previewImage?: string;
    /** Bundle-compatible encoded vibe storage keyed by model and slot */
    encodings: VibeBundleEncodings;
    /** Metadata from a standard bundle import */
    importInfo?: VibeLibraryImportInfo;
    /** Per-vibe generation settings */
    generation?: VibeLibraryGenerationSettings;
    /** Legacy reference image ID used during migration and preset mapping */
    legacyReferenceId?: string;
}
export interface VibeTransferBundleImportSummary {
    imported: number;
    skipped: number;
    errors: string[];
}
/** Reference image saved for NovelAI Vibe Transfer. */
export interface VibeTransferReferenceImage {
    /** Stable local identifier */
    id: string;
    /** User-facing display name */
    name: string;
    /**
     * Browser data URL, e.g. data:image/png;base64,... May be empty once the
     * source bytes have been moved to the backend store; `sourceHash` then points
     * at the on-disk copy used for thumbnails and re-encoding.
     */
    dataUrl: string;
    /**
     * Content hash (SHA-256) of the source image bytes stored on the backend.
     * Present after migration off inline base64.
     */
    sourceHash?: string;
    /** Source MIME type, retained when the bytes move to the backend store. */
    sourceMimeType?: string;
    /** User-defined tags for search and grouping */
    tags: string[];
    /** Whether this reference participates in generation */
    enabled: boolean;
    /** Cached V4/V4.5 encoded vibes keyed by model + information extracted */
    encodedVibes?: VibeTransferEncodedCache[];
    /** Timestamp when the image was added */
    addedAt: number;
}
/** Named set of enabled Vibe Transfer reference images. */
export interface VibeTransferPreset {
    /** Stable local identifier */
    id: string;
    /** User-facing display name */
    name: string;
    /** Reference image IDs enabled by this preset */
    referenceIds: string[];
    /** Timestamp when the preset was created */
    createdAt: number;
    /** Timestamp when the preset was last modified */
    updatedAt: number;
}
/** Named Vibe item combination. */
export interface VibeTransferCombination {
    /** Stable local identifier */
    id: string;
    /** User-facing display name */
    name: string;
    /** Vibe library item IDs enabled by this combination */
    itemIds: string[];
    /** Legacy global strength saved by older versions */
    referenceStrength?: number;
    /** Legacy global information_extracted saved by older versions */
    informationExtracted?: number;
    /** Per-vibe generation settings saved with this combination */
    itemGenerations?: Record<string, VibeLibraryGenerationSettings>;
    /** Timestamp when the combination was created */
    createdAt: number;
    /** Timestamp when the combination was last modified */
    updatedAt: number;
    /** Legacy preset ID used during migration */
    legacyPresetId?: string;
}
/** Named fixed SD Style + Vibe combination used before generation. */
export interface GenerationStylePreset {
    /** Stable local identifier */
    id: string;
    /** User-facing display name */
    name: string;
    /** SD Style name from SillyTavern's SD extension */
    sdStyleName: string;
    /** Saved Vibe combination ID from Vibe Manager */
    vibeCombinationId: string;
    /** Timestamp when the preset was created */
    createdAt: number;
    /** Timestamp when the preset was last modified */
    updatedAt: number;
}
/** Runtime config derived from AutoIllustratorSettings. */
export interface VibeTransferGenerationConfig {
    enabled: boolean;
    referenceImages: VibeTransferReferenceImage[];
    libraryItems: VibeLibraryItem[];
    referenceStrength: number;
    informationExtracted: number;
}
/** Details about random picks used by one image generation. */
export interface GenerationRandomizationMetadata {
    sdStyleName?: string;
    vibeCombinationId?: string;
    vibeCombinationName?: string;
}
/** Image generation result with optional randomization metadata. */
export interface ImageGenerationResult {
    imageUrl: string | null;
    randomization: GenerationRandomizationMetadata;
}
