/**
 * Constants Module
 * Centralized configuration values, defaults, and validation ranges
 *
 * This module provides a single source of truth for all settings-related
 * constants to avoid magic numbers scattered throughout the codebase.
 */
import type { CharacterFixedTagEntry, CharacterFixedTagInjectionMode, CharacterFixedTagScopes } from './types';
import type { StyleTagPosition } from './types';
import type { GenerationStylePreset, PromptLibraryEntry, TagCatalogEntry, VibeLibraryItem, VibeTransferCombination, VibeTransferPreset, VibeTransferReferenceImage } from './types';
/**
 * Extension identifier used for settings storage
 */
export declare const EXTENSION_NAME = "auto_illustrator_conso";
/**
 * Extension version (single source of truth)
 */
export declare const EXTENSION_VERSION = "1.16.0";
/**
 * GitHub repository for update checks
 */
export declare const GITHUB_REPO = "Asobi-123/sillytavern-conso-illustrator";
/**
 * URL to the quickstart tutorial on GitHub
 */
export declare const TUTORIAL_URL = "https://github.com/Asobi-123/sillytavern-conso-illustrator/blob/main/docs/QUICKSTART_CN.md";
/**
 * Streaming poll interval configuration (milliseconds)
 * Controls how frequently the extension checks for new prompts during streaming
 */
export declare const STREAMING_POLL_INTERVAL: {
    readonly DEFAULT: 300;
    readonly MIN: 10;
    readonly MAX: 1000;
    readonly STEP: 10;
};
/**
 * Max concurrent generations configuration
 * Controls how many images can be generated simultaneously
 */
export declare const MAX_CONCURRENT_GENERATIONS: {
    readonly DEFAULT: 1;
    readonly MIN: 1;
    readonly MAX: 5;
    readonly STEP: 1;
};
/**
 * Log level options
 */
export declare const LOG_LEVELS: {
    readonly TRACE: "trace";
    readonly DEBUG: "debug";
    readonly INFO: "info";
    readonly WARN: "warn";
    readonly ERROR: "error";
    readonly SILENT: "silent";
};
/**
 * Default log level
 */
export declare const DEFAULT_LOG_LEVEL: "info";
/**
 * Preset ID constants
 */
export declare const PRESET_IDS: {
    readonly DEFAULT: "default";
    readonly NAI_45_FULL: "nai-4.5-full";
    readonly NAI_V5: "nai-v5";
};
/**
 * Manual generation mode configuration
 * Controls whether to replace existing images or append new ones
 */
export declare const MANUAL_GENERATION_MODE: {
    readonly REPLACE: "replace";
    readonly APPEND: "append";
    readonly DEFAULT: "append";
};
/**
 * Minimum generation interval configuration (milliseconds)
 * Enforces a minimum time delay between consecutive image generation requests
 * to prevent rate limiting or overwhelming the image generation API
 */
export declare const MIN_GENERATION_INTERVAL: {
    readonly DEFAULT: 0;
    readonly MIN: 0;
    readonly MAX: 10000;
    readonly STEP: 100;
};
/**
 * Prompt generation mode configuration
 * Controls how image prompts are generated
 */
export declare const PROMPT_GENERATION_MODE: {
    readonly SHARED_API: "shared-api";
    readonly INDEPENDENT_API: "independent-api";
    readonly REGEX: "shared-api";
    readonly LLM_POST: "independent-api";
    readonly DEFAULT: "shared-api";
};
/**
 * Max prompts per message configuration
 * Controls cost when using LLM-based prompt generation
 */
export declare const MAX_PROMPTS_PER_MESSAGE: {
    readonly DEFAULT: 5;
    readonly MIN: 1;
    readonly MAX: 30;
    readonly STEP: 1;
};
/**
 * Context message count configuration
 * Controls how many previous messages are included as context for LLM prompt generation
 */
export declare const CONTEXT_MESSAGE_COUNT: {
    readonly DEFAULT: 10;
    readonly MIN: 0;
    readonly MAX: 50;
    readonly STEP: 1;
};
/**
 * Meta prompt depth configuration
 * Controls where the meta prompt is inserted in chat history for shared API mode
 * depth=0: last message (default), depth=1: one before last, etc.
 */
export declare const META_PROMPT_DEPTH: {
    readonly DEFAULT: 0;
    readonly MIN: 0;
    readonly MAX: 20;
    readonly STEP: 1;
};
/**
 * Final reconciliation delay configuration (milliseconds)
 * Controls how long to wait after GENERATION_ENDED before running final reconciliation
 * This helps recover images removed by other extensions that run async handlers
 */
export declare const FINAL_RECONCILIATION_DELAY: {
    readonly DEFAULT: 5000;
    readonly MIN: 0;
    readonly MAX: 30000;
    readonly STEP: 1000;
};
/**
 * Image display width configuration (percentage)
 * Controls the display width of generated images in chat messages
 */
export declare const IMAGE_DISPLAY_WIDTH: {
    readonly DEFAULT: 100;
    readonly MIN: 10;
    readonly MAX: 100;
    readonly STEP: 5;
};
/**
 * Image retention period configuration (days)
 * Controls how long generated images are kept before cleanup
 */
export declare const IMAGE_RETENTION_DAYS: {
    readonly DEFAULT: 1;
    readonly MIN: 1;
    readonly MAX: 7;
    readonly STEP: 1;
};
/**
 * Default frequency guidelines for LLM prompt generation
 * Tells the LLM when to generate image prompts
 */
export declare const DEFAULT_LLM_FREQUENCY_GUIDELINES = "Find 0-5 key visual moments in the message that are worth illustrating\n   - Aim for approximately one prompt every 250 words or at major scene changes\n   - Focus on scenes with clear visual descriptions\n   - Prioritize major scene transitions, character introductions, or significant moments\n   - Skip if the message has no visual content (pure dialogue, abstract concepts)";
/**
 * Default prompt writing guidelines for LLM prompt generation
 * Tells the LLM how to structure image generation prompts
 * Loaded from: src/presets/prompt_writing_guidelines.md
 */
export declare const DEFAULT_LLM_PROMPT_WRITING_GUIDELINES: string;
/**
 * Independent LLM API configuration defaults
 */
export declare const INDEPENDENT_LLM_API: {
    readonly DEFAULT_URL: "https://api.openai.com/v1";
    readonly DEFAULT_MODEL: "gpt-4o-mini";
};
/**
 * Independent LLM max tokens configuration
 */
export declare const INDEPENDENT_LLM_MAX_TOKENS: {
    readonly DEFAULT: 4096;
    readonly MIN: 256;
    readonly MAX: 32000;
    readonly STEP: 256;
};
/**
 * Default HTML tags to filter from message text before sending to LLM
 */
export declare const DEFAULT_CONTENT_FILTER_TAGS: string[];
/**
 * Default prompt detection patterns
 * Supports multiple tag formats for backward compatibility:
 * - HTML comment format (primary, invisible, passes through DOMPurify)
 * - Underscore format (legacy, from old chats)
 */
export declare const DEFAULT_PROMPT_DETECTION_PATTERNS: string[];
/**
 * Standalone prompt count configuration
 */
export declare const STANDALONE_PROMPT_COUNT: {
    readonly DEFAULT: 3;
    readonly MIN: 1;
    readonly MAX: 10;
    readonly STEP: 1;
};
/**
 * Prompt library max entries configuration
 */
export declare const PROMPT_LIBRARY_MAX_ENTRIES: {
    readonly DEFAULT: 500;
    readonly MIN: 10;
    readonly MAX: 2000;
    readonly STEP: 10;
};
/**
 * Prompt library thumbnail configuration
 */
export declare const PROMPT_LIBRARY_THUMBNAIL: {
    readonly MAX_SIZE: 200;
    readonly QUALITY: 0.6;
};
export declare const TAG_CATALOG_CATEGORIES: readonly ["subject", "hair", "eyes", "expression", "pose_action", "clothing", "scene", "camera", "lighting_style", "undesired_content", "general"];
export declare const TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS: Record<string, number>;
export declare const TAG_CATALOG_CANDIDATE_LIMIT: {
    readonly MIN: 0;
    readonly MAX: 50;
};
export declare const TAG_CATALOG_PAGE_SIZE: {
    readonly DEFAULT: 500;
    readonly ALL: 0;
    readonly OPTIONS: readonly [200, 500, 1000, 2000, 0];
};
/**
 * Companion server plugin fingerprint.
 * Bump VERSION whenever server-plugin/auto-illustrator-nai-advanced changes.
 */
export declare const SERVER_PLUGIN: {
    readonly ID: "auto-illustrator-nai-advanced";
    readonly VERSION: "2026-08-21-nai-v5-v1";
    readonly STATUS_ROUTE: "/api/plugins/auto-illustrator-nai-advanced/status";
};
/**
 * Backend routes for the content-addressed Vibe source image store. Source
 * images live on disk under the user's data directory, keyed by content hash,
 * instead of inline base64 in settings.json.
 */
export declare const VIBE_SOURCE_ROUTES: {
    /** POST { images: string[] } -> { hashes: string[] } */
    readonly STORE: "/api/plugins/auto-illustrator-nai-advanced/vibe-source";
    /** GET :hash -> raw image bytes */
    readonly FETCH_BASE: "/api/plugins/auto-illustrator-nai-advanced/vibe-source";
    /** POST { hashes: string[] } -> { present: string[] } */
    readonly CHECK: "/api/plugins/auto-illustrator-nai-advanced/vibe-source/check";
    /** POST { keep: string[] } -> { removed, remaining } */
    readonly PRUNE: "/api/plugins/auto-illustrator-nai-advanced/vibe-source/prune";
};
/**
 * NovelAI Vibe Transfer configuration.
 */
export declare const VIBE_TRANSFER: {
    readonly DEFAULT_ENABLED: false;
    readonly DEFAULT_REFERENCE_STRENGTH: 0.6;
    readonly DEFAULT_INFORMATION_EXTRACTED: 1;
    readonly MIN: 0;
    readonly MAX: 1;
    readonly STEP: 0.05;
    readonly MAX_ACTIVE_REFERENCES: 16;
    readonly MAX_IMPORT_ITEMS: 256;
    readonly MAX_IMPORT_FILE_SIZE_BYTES: number;
    readonly MAX_GROUP_NAME_LENGTH: 80;
    readonly MAX_ENCODED_CACHE_PER_REFERENCE: 8;
    readonly MAX_PRESETS: 30;
    readonly MAX_SOURCE_IMAGE_SIZE: 768;
    readonly SOURCE_IMAGE_MIME_TYPE: "image/jpeg";
    readonly SOURCE_IMAGE_QUALITY: 0.86;
    readonly THUMBNAIL_MAX_SIZE: 256;
    readonly THUMBNAIL_MIME_TYPE: "image/jpeg";
    readonly THUMBNAIL_QUALITY: 0.7;
    readonly ADVANCED_ROUTE: "/api/plugins/auto-illustrator-nai-advanced/generate-image";
    readonly STATUS_ROUTE: "/api/plugins/auto-illustrator-nai-advanced/status";
};
/**
 * NovelAI Inpainting configuration.
 */
export declare const NAI_IMAGE_EDIT: {
    readonly DEFAULT_INPAINTING_STRENGTH: 0.45;
    readonly MIN_STRENGTH: 0;
    readonly MAX_STRENGTH: 1;
    readonly STRENGTH_STEP: 0.05;
    readonly MAX_INPAINTING_STEPS: 24;
    readonly FOCUSED_CONTEXT_PX: 192;
    readonly FOCUSED_MIN_SIZE: 512;
    readonly FOCUSED_DIMENSION_STEP: 64;
    readonly FOCUSED_MAX_FULL_CANVAS_RATIO: 0.85;
    readonly DEFAULT_MASK_PADDING_PX: 24;
    readonly MIN_MASK_PADDING_PX: 0;
    readonly MAX_MASK_PADDING_PX: 128;
    readonly DEFAULT_MASK_FEATHER_PX: 24;
    readonly MIN_MASK_FEATHER_PX: 0;
    readonly MAX_MASK_FEATHER_PX: 80;
    readonly MASK_FEATHER_STEP: 1;
    readonly DEFAULT_MASK_EDGE_GUARD_PX: 4;
    readonly MIN_MASK_EDGE_GUARD_PX: 0;
    readonly MAX_MASK_EDGE_GUARD_PX: 32;
    readonly MIN_ZOOM_PERCENT: 25;
    readonly MAX_ZOOM_PERCENT: 300;
    readonly ZOOM_STEP_PERCENT: 25;
    readonly INPAINT_ROUTE: "/api/plugins/auto-illustrator-nai-advanced/generate-inpaint-image";
};
/**
 * Default settings for the extension
 * These values are used when no saved settings exist or when resetting
 */
export declare const DEFAULT_SETTINGS: {
    enabled: boolean;
    streamingPollInterval: 300;
    monitorPollingInterval: 300;
    maxConcurrentGenerations: 1;
    minGenerationInterval: 0;
    logLevel: "info";
    currentPresetId: "default";
    customPresets: MetaPromptPreset[];
    manualGenerationMode: "append";
    promptDetectionPatterns: string[];
    commonStyleTags: string;
    commonStyleTagsPosition: StyleTagPosition;
    showGalleryWidget: boolean;
    showProgressWidget: boolean;
    showStreamingPreviewWidget: boolean;
    showFloatingPanelLauncher: boolean;
    enableClickToRegenerate: boolean;
    promptGenerationMode: "shared-api";
    metaPromptDepth: 0;
    maxPromptsPerMessage: 5;
    contextMessageCount: 10;
    llmFrequencyGuidelines: string;
    llmPromptWritingGuidelines: string;
    currentIndependentLlmPresetId: string;
    customIndependentLlmPresets: IndependentLlmGuidelinesPreset[];
    finalReconciliationDelayMs: 5000;
    imageDisplayWidth: 100;
    imageRetentionDays: 1;
    useIndependentLlmApi: boolean;
    independentLlmApiUrl: "https://api.openai.com/v1";
    independentLlmApiKey: string;
    independentLlmModel: "gpt-4o-mini";
    independentLlmMaxTokens: 4096;
    injectCharacterDescription: boolean;
    injectUserPersona: boolean;
    injectScenario: boolean;
    contentFilterTags: string[];
    injectWorldInfo: boolean;
    apiProfiles: ApiProfile[];
    currentApiProfileId: string;
    characterFixedTags: Record<string, CharacterFixedTagEntry>;
    characterFixedTagScopes: CharacterFixedTagScopes;
    characterFixedTagInjectionMode: CharacterFixedTagInjectionMode;
    standalonePromptCount: 3;
    promptLibraryEntries: PromptLibraryEntry[];
    promptLibraryMaxEntries: 500;
    promptLibrarySaveThumbnail: boolean;
    customTagCatalogEntries: TagCatalogEntry[];
    customTagBridgeTriggers: Record<string, string[]>;
    tagCatalogCandidateLimits: {
        [x: string]: number;
    };
    generationStyleMode: "off" | "fixed" | "random";
    generationStylePresets: GenerationStylePreset[];
    currentGenerationStylePresetId: string;
    fixedSdStyleName: string;
    fixedVibeCombinationId: string;
    randomizeSdStylePerGeneration: boolean;
    sdStylePoolWhitelist: string[];
    restoreSdStyleAfter: boolean;
    randomizeVibeCombinationPerGeneration: boolean;
    vibeCombinationPoolWhitelist: string[];
    vibeTransferEnabled: false;
    vibeTransferExportIncludeSourceImages: boolean;
    vibeTransferLibraryItems: VibeLibraryItem[];
    vibeTransferCombinations: VibeTransferCombination[];
    currentVibeTransferCombinationId: string;
    vibeTransferManagerEditMode: boolean;
    vibeTransferManagerView: "all" | "pending";
    vibeTransferReferenceImages: VibeTransferReferenceImage[];
    vibeTransferPresets: VibeTransferPreset[];
    currentVibeTransferPresetId: string;
    vibeTransferReferenceStrength: 0.6;
    vibeTransferInformationExtracted: 1;
};
/**
 * UI element IDs for settings controls
 */
export declare const UI_ELEMENT_IDS: {
    readonly ENABLED: "auto_illustrator_conso_enabled";
    readonly META_PROMPT: "auto_illustrator_conso_meta_prompt";
    readonly META_PROMPT_DEPTH: "auto_illustrator_conso_meta_prompt_depth";
    readonly META_PROMPT_PRESET_SELECT: "auto_illustrator_conso_preset_select";
    readonly META_PROMPT_PRESET_EDIT: "auto_illustrator_conso_preset_edit";
    readonly META_PROMPT_PRESET_SAVE: "auto_illustrator_conso_preset_save";
    readonly META_PROMPT_PRESET_SAVE_AS: "auto_illustrator_conso_preset_save_as";
    readonly META_PROMPT_PRESET_DELETE: "auto_illustrator_conso_preset_delete";
    readonly META_PROMPT_PRESET_CANCEL: "auto_illustrator_conso_preset_cancel";
    readonly PRESET_EDITOR: "auto_illustrator_conso_preset_editor";
    readonly PRESET_VIEWER: "auto_illustrator_conso_preset_viewer";
    readonly PRESET_PREVIEW: "auto_illustrator_conso_preset_preview";
    readonly STREAMING_POLL_INTERVAL: "auto_illustrator_conso_streaming_poll_interval";
    readonly MAX_CONCURRENT: "auto_illustrator_conso_max_concurrent";
    readonly MIN_GENERATION_INTERVAL: "auto_illustrator_conso_min_generation_interval";
    readonly LOG_LEVEL: "auto_illustrator_conso_log_level";
    readonly MANUAL_GEN_MODE: "auto_illustrator_conso_manual_gen_mode";
    readonly PROMPT_PATTERNS: "auto_illustrator_conso_prompt_patterns";
    readonly PROMPT_PATTERNS_RESET: "auto_illustrator_conso_prompt_patterns_reset";
    readonly PATTERN_VALIDATION_STATUS: "auto_illustrator_conso_pattern_validation_status";
    readonly COMMON_STYLE_TAGS: "auto_illustrator_conso_common_style_tags";
    readonly COMMON_STYLE_TAGS_POSITION: "auto_illustrator_conso_common_style_tags_position";
    readonly SHOW_GALLERY_WIDGET: "auto_illustrator_conso_show_gallery_widget";
    readonly SHOW_PROGRESS_WIDGET: "auto_illustrator_conso_show_progress_widget";
    readonly SHOW_STREAMING_PREVIEW_WIDGET: "auto_illustrator_conso_show_streaming_preview_widget";
    readonly SHOW_FLOATING_PANEL_LAUNCHER: "auto_illustrator_conso_show_floating_panel_launcher";
    readonly OPEN_FLOATING_PANEL: "auto_illustrator_conso_open_floating_panel";
    readonly PROMPT_GENERATION_MODE_SHARED: "auto_illustrator_conso_prompt_gen_mode_shared";
    readonly PROMPT_GENERATION_MODE_INDEPENDENT: "auto_illustrator_conso_prompt_gen_mode_independent";
    readonly INDEPENDENT_API_SETTINGS_CONTAINER: "auto_illustrator_conso_independent_api_settings_container";
    readonly MAX_PROMPTS_PER_MESSAGE: "auto_illustrator_conso_max_prompts_per_message";
    readonly CONTEXT_MESSAGE_COUNT: "auto_illustrator_conso_context_message_count";
    readonly LLM_FREQUENCY_GUIDELINES: "auto_illustrator_conso_llm_frequency_guidelines";
    readonly LLM_FREQUENCY_GUIDELINES_RESET: "auto_illustrator_conso_llm_frequency_guidelines_reset";
    readonly LLM_PROMPT_WRITING_GUIDELINES: "auto_illustrator_conso_llm_prompt_writing_guidelines";
    readonly LLM_PROMPT_WRITING_GUIDELINES_RESET: "auto_illustrator_conso_llm_prompt_writing_guidelines_reset";
    readonly IMAGE_DISPLAY_WIDTH: "auto_illustrator_conso_image_display_width";
    readonly IMAGE_DISPLAY_WIDTH_VALUE: "auto_illustrator_conso_image_display_width_value";
    readonly IMAGE_RETENTION_DAYS: "auto_illustrator_conso_image_retention_days";
    readonly USE_INDEPENDENT_LLM_API: "auto_illustrator_conso_use_independent_llm_api";
    readonly INDEPENDENT_LLM_API_URL: "auto_illustrator_conso_independent_llm_api_url";
    readonly INDEPENDENT_LLM_API_KEY: "auto_illustrator_conso_independent_llm_api_key";
    readonly INDEPENDENT_LLM_MODEL: "auto_illustrator_conso_independent_llm_model";
    readonly INDEPENDENT_LLM_MODEL_SELECT: "auto_illustrator_conso_independent_llm_model_select";
    readonly INDEPENDENT_LLM_FETCH_MODELS: "auto_illustrator_conso_independent_llm_fetch_models";
    readonly INDEPENDENT_LLM_MAX_TOKENS: "auto_illustrator_conso_independent_llm_max_tokens";
    readonly INDEPENDENT_LLM_TEST_CONNECTION: "auto_illustrator_conso_independent_llm_test_connection";
    readonly INDEPENDENT_LLM_SETTINGS_CONTAINER: "auto_illustrator_conso_independent_llm_settings_container";
    readonly INDEPENDENT_LLM_VIEW_LAST_REQUEST: "auto_illustrator_conso_independent_llm_view_last_request";
    readonly IMAGE_SUBFOLDER_LABEL: "auto_illustrator_conso_image_subfolder_label";
    readonly INJECT_CHARACTER_DESCRIPTION: "auto_illustrator_conso_inject_character_description";
    readonly INJECT_USER_PERSONA: "auto_illustrator_conso_inject_user_persona";
    readonly INJECT_SCENARIO: "auto_illustrator_conso_inject_scenario";
    readonly CONTENT_FILTER_TAGS: "auto_illustrator_conso_content_filter_tags";
    readonly CONTENT_FILTER_TAGS_RESET: "auto_illustrator_conso_content_filter_tags_reset";
    readonly INDEPENDENT_LLM_PRESET_SELECT: "auto_illustrator_conso_independent_llm_preset_select";
    readonly INDEPENDENT_LLM_PRESET_EDIT: "auto_illustrator_conso_independent_llm_preset_edit";
    readonly INDEPENDENT_LLM_PRESET_SAVE: "auto_illustrator_conso_independent_llm_preset_save";
    readonly INDEPENDENT_LLM_PRESET_SAVE_AS: "auto_illustrator_conso_independent_llm_preset_save_as";
    readonly INDEPENDENT_LLM_PRESET_DELETE: "auto_illustrator_conso_independent_llm_preset_delete";
    readonly INDEPENDENT_LLM_PRESET_CANCEL: "auto_illustrator_conso_independent_llm_preset_cancel";
    readonly INDEPENDENT_LLM_PRESET_EDITOR: "auto_illustrator_conso_independent_llm_preset_editor";
    readonly RESET_BUTTON: "auto_illustrator_conso_reset";
    readonly INJECT_WORLD_INFO: "auto_illustrator_conso_inject_world_info";
    readonly WORLD_INFO_PANEL: "auto_illustrator_conso_world_info_panel";
    readonly WORLD_INFO_SEARCH: "auto_illustrator_conso_world_info_search";
    readonly WORLD_INFO_REFRESH: "auto_illustrator_conso_world_info_refresh";
    readonly WORLD_INFO_BOOK_LIST: "auto_illustrator_conso_world_info_book_list";
    readonly WORLD_INFO_ENTRY_PANEL: "auto_illustrator_conso_world_info_entry_panel";
    readonly API_PROFILE_SELECT: "auto_illustrator_conso_api_profile_select";
    readonly API_PROFILE_SAVE: "auto_illustrator_conso_api_profile_save";
    readonly API_PROFILE_DELETE: "auto_illustrator_conso_api_profile_delete";
    readonly VERSION_DISPLAY: "auto_illustrator_conso_version_display";
    readonly VERSION_STATUS: "auto_illustrator_conso_version_status";
    readonly UPDATE_NOTICE: "auto_illustrator_conso_update_notice";
    readonly UPDATE_NOTICE_TITLE: "auto_illustrator_conso_update_notice_title";
    readonly UPDATE_NOTICE_LIST: "auto_illustrator_conso_update_notice_list";
    readonly UPDATE_NOTICE_MORE: "auto_illustrator_conso_update_notice_more";
    readonly UPDATE_NOTICE_LINK: "auto_illustrator_conso_update_notice_link";
    readonly SERVER_PLUGIN_STATUS: "auto_illustrator_conso_server_plugin_status";
    readonly SERVER_PLUGIN_INSTALL_HELP: "auto_illustrator_conso_server_plugin_install_help";
    readonly TUTORIAL_LINK: "auto_illustrator_conso_tutorial_link";
    readonly CHARACTER_FIXED_TAGS_LIST: "auto_illustrator_conso_character_fixed_tags_list";
    readonly CHARACTER_TAG_SEARCH: "auto_illustrator_conso_character_tag_search";
    readonly CHARACTER_TAG_ADD_NAME: "auto_illustrator_conso_character_tag_add_name";
    readonly CHARACTER_TAG_ADD_BTN: "auto_illustrator_conso_character_tag_add_btn";
    readonly CHARACTER_TAG_RESET_ALL: "auto_illustrator_conso_character_tag_reset_all";
    readonly CHARACTER_TAG_INJECTION_MODE: "auto_illustrator_conso_character_tag_injection_mode";
    readonly STANDALONE_MODE_AI: "auto_illustrator_conso_standalone_mode_ai";
    readonly STANDALONE_MODE_MANUAL: "auto_illustrator_conso_standalone_mode_manual";
    readonly STANDALONE_SCENE_INPUT: "auto_illustrator_conso_standalone_scene_input";
    readonly STANDALONE_PROMPT_COUNT: "auto_illustrator_conso_standalone_prompt_count";
    readonly STANDALONE_INCLUDE_CHAR_INFO: "auto_illustrator_conso_standalone_include_char_info";
    readonly STANDALONE_INCLUDE_WORLD_INFO: "auto_illustrator_conso_standalone_include_world_info";
    readonly STANDALONE_GENERATE_PROMPTS_BTN: "auto_illustrator_conso_standalone_generate_prompts";
    readonly STANDALONE_AUTO_BTN: "auto_illustrator_conso_standalone_auto";
    readonly STANDALONE_RESULTS: "auto_illustrator_conso_standalone_results";
    readonly STANDALONE_GENERATE_ALL_BTN: "auto_illustrator_conso_standalone_generate_all";
    readonly STANDALONE_CLEAR_BTN: "auto_illustrator_conso_standalone_clear";
    readonly STANDALONE_MANUAL_PROMPT_INPUT: "auto_illustrator_conso_standalone_manual_prompt";
    readonly STANDALONE_MANUAL_GENERATE_BTN: "auto_illustrator_conso_standalone_manual_generate";
    readonly STANDALONE_MANUAL_IMAGE: "auto_illustrator_conso_standalone_manual_image";
    readonly STANDALONE_SUBFOLDER_LABEL: "auto_illustrator_conso_standalone_subfolder_label";
    readonly PROMPT_LIBRARY_UPLOAD: "auto_illustrator_conso_prompt_library_upload";
    readonly PROMPT_LIBRARY_UPLOAD_INPUT: "auto_illustrator_conso_prompt_library_upload_input";
    readonly PROMPT_LIBRARY_SEARCH: "auto_illustrator_conso_prompt_library_search";
    readonly PROMPT_LIBRARY_LIST: "auto_illustrator_conso_prompt_library_list";
    readonly PROMPT_LIBRARY_COUNT: "auto_illustrator_conso_prompt_library_count";
    readonly PROMPT_LIBRARY_EDIT_OVERLAY: "auto_illustrator_conso_prompt_library_edit_overlay";
    readonly PROMPT_LIBRARY_EDIT_NAME: "auto_illustrator_conso_prompt_library_edit_name";
    readonly PROMPT_LIBRARY_EDIT_POSITIVE: "auto_illustrator_conso_prompt_library_edit_positive";
    readonly PROMPT_LIBRARY_EDIT_NEGATIVE: "auto_illustrator_conso_prompt_library_edit_negative";
    readonly PROMPT_LIBRARY_EDIT_TAGS: "auto_illustrator_conso_prompt_library_edit_tags";
    readonly PROMPT_LIBRARY_EDIT_CHARACTER: "auto_illustrator_conso_prompt_library_edit_character";
    readonly PROMPT_LIBRARY_EDIT_SAVE: "auto_illustrator_conso_prompt_library_edit_save";
    readonly PROMPT_LIBRARY_EDIT_CANCEL: "auto_illustrator_conso_prompt_library_edit_cancel";
    readonly TAG_CATALOG_SEARCH: "auto_illustrator_conso_tag_catalog_search";
    readonly TAG_CATALOG_CATEGORY: "auto_illustrator_conso_tag_catalog_category";
    readonly TAG_CATALOG_SOURCE_FILTER: "auto_illustrator_conso_tag_catalog_source_filter";
    readonly TAG_CATALOG_LIST: "auto_illustrator_conso_tag_catalog_list";
    readonly TAG_CATALOG_TOTAL: "auto_illustrator_conso_tag_catalog_total";
    readonly TAG_CATALOG_COUNT: "auto_illustrator_conso_tag_catalog_count";
    readonly TAG_CATALOG_SELECTED: "auto_illustrator_conso_tag_catalog_selected";
    readonly TAG_CATALOG_COPY_SELECTED: "auto_illustrator_conso_tag_catalog_copy_selected";
    readonly TAG_CATALOG_CLEAR_SELECTED: "auto_illustrator_conso_tag_catalog_clear_selected";
    readonly TAG_CATALOG_ADD_COMMON: "auto_illustrator_conso_tag_catalog_add_common";
    readonly TAG_CATALOG_DELETE_CUSTOM_SELECTED: "auto_illustrator_conso_tag_catalog_delete_custom_selected";
    readonly TAG_CATALOG_PAGE_SIZE: "auto_illustrator_conso_tag_catalog_page_size";
    readonly TAG_CATALOG_PAGE_PREV: "auto_illustrator_conso_tag_catalog_page_prev";
    readonly TAG_CATALOG_PAGE_NEXT: "auto_illustrator_conso_tag_catalog_page_next";
    readonly TAG_CATALOG_PAGE_STATUS: "auto_illustrator_conso_tag_catalog_page_status";
    readonly TAG_CATALOG_CANDIDATE_LIMITS: "auto_illustrator_conso_tag_catalog_candidate_limits";
    readonly TAG_CATALOG_LAST_CANDIDATES: "auto_illustrator_conso_tag_catalog_last_candidates";
    readonly TAG_CATALOG_REFRESH_LAST_CANDIDATES: "auto_illustrator_conso_tag_catalog_refresh_last_candidates";
    readonly TAG_CATALOG_RESET_CANDIDATE_LIMITS: "auto_illustrator_conso_tag_catalog_reset_candidate_limits";
    readonly TAG_CATALOG_CUSTOM_TAG: "auto_illustrator_conso_tag_catalog_custom_tag";
    readonly TAG_CATALOG_CUSTOM_LABEL: "auto_illustrator_conso_tag_catalog_custom_label";
    readonly TAG_CATALOG_CUSTOM_TRIGGERS: "auto_illustrator_conso_tag_catalog_custom_triggers";
    readonly TAG_CATALOG_CUSTOM_CATEGORY: "auto_illustrator_conso_tag_catalog_custom_category";
    readonly TAG_CATALOG_ADD_CUSTOM: "auto_illustrator_conso_tag_catalog_add_custom";
    readonly TAG_CATALOG_BRIDGE_SUMMARY: "auto_illustrator_conso_tag_catalog_bridge_summary";
    readonly TAG_CATALOG_BRIDGE_TAG: "auto_illustrator_conso_tag_catalog_bridge_tag";
    readonly TAG_CATALOG_BRIDGE_EXISTING: "auto_illustrator_conso_tag_catalog_bridge_existing";
    readonly TAG_CATALOG_BRIDGE_TRIGGERS: "auto_illustrator_conso_tag_catalog_bridge_triggers";
    readonly TAG_CATALOG_SAVE_BRIDGE_TRIGGERS: "auto_illustrator_conso_tag_catalog_save_bridge_triggers";
    readonly REGEX_MASTER: "auto_illustrator_conso_regex_master";
    readonly REGEX_IMG_PROMPT: "auto_illustrator_conso_regex_img_prompt";
    readonly REGEX_AUTO_ILLUSTRATOR: "auto_illustrator_conso_regex_auto_illustrator";
    readonly REGEX_IMG_TAG: "auto_illustrator_conso_regex_img_tag";
    readonly REGEX_SYNC: "auto_illustrator_conso_regex_sync";
    readonly REGEX_STATUS: "auto_illustrator_conso_regex_status";
    readonly PRESET_IMPORT_JSON: "auto_illustrator_conso_preset_import_json";
    readonly PRESET_IMPORT_FILE: "auto_illustrator_conso_preset_import_file";
    readonly PRESET_IMPORT_REQUIREMENT: "auto_illustrator_conso_preset_import_requirement";
    readonly PRESET_IMPORT_TARGET: "auto_illustrator_conso_preset_import_target";
    readonly PRESET_IMPORT_ANALYZE: "auto_illustrator_conso_preset_import_analyze";
    readonly PRESET_IMPORT_GENERATE: "auto_illustrator_conso_preset_import_generate";
    readonly PRESET_IMPORT_SAVE: "auto_illustrator_conso_preset_import_save";
    readonly PRESET_IMPORT_RESULT: "auto_illustrator_conso_preset_import_result";
    readonly PRESET_IMPORT_NAME: "auto_illustrator_conso_preset_import_name";
    readonly RANDOMIZE_SD_STYLE: "auto_illustrator_conso_randomize_sd_style";
    readonly GENERATION_STYLE_MODE: "auto_illustrator_conso_generation_style_mode";
    readonly FIXED_STYLE_PANEL: "auto_illustrator_conso_fixed_style_panel";
    readonly RANDOM_STYLE_PANEL: "auto_illustrator_conso_random_style_panel";
    readonly GENERATION_STYLE_PRESET_SELECT: "auto_illustrator_conso_generation_style_preset_select";
    readonly GENERATION_STYLE_PRESET_NAME: "auto_illustrator_conso_generation_style_preset_name";
    readonly GENERATION_STYLE_PRESET_SAVE: "auto_illustrator_conso_generation_style_preset_save";
    readonly GENERATION_STYLE_PRESET_OVERWRITE: "auto_illustrator_conso_generation_style_preset_overwrite";
    readonly GENERATION_STYLE_PRESET_DELETE: "auto_illustrator_conso_generation_style_preset_delete";
    readonly FIXED_SD_STYLE_SELECT: "auto_illustrator_conso_fixed_sd_style_select";
    readonly FIXED_VIBE_COMBINATION_SELECT: "auto_illustrator_conso_fixed_vibe_combination_select";
    readonly RESTORE_SD_STYLE_AFTER: "auto_illustrator_conso_restore_sd_style_after";
    readonly SD_STYLE_POOL_SUMMARY: "auto_illustrator_conso_sd_style_pool_summary";
    readonly SD_STYLE_POOL_LIST: "auto_illustrator_conso_sd_style_pool_list";
    readonly SD_STYLE_POOL_SEARCH: "auto_illustrator_conso_sd_style_pool_search";
    readonly SD_STYLE_POOL_REFRESH: "auto_illustrator_conso_sd_style_pool_refresh";
    readonly RANDOMIZE_VIBE_COMBINATION: "auto_illustrator_conso_randomize_vibe_combination";
    readonly VIBE_COMBINATION_POOL_SUMMARY: "auto_illustrator_conso_vibe_combination_pool_summary";
    readonly VIBE_COMBINATION_POOL_LIST: "auto_illustrator_conso_vibe_combination_pool_list";
    readonly VIBE_COMBINATION_POOL_SEARCH: "auto_illustrator_conso_vibe_combination_pool_search";
    readonly VIBE_TRANSFER_ENABLED: "auto_illustrator_conso_vibe_transfer_enabled";
    readonly VIBE_TRANSFER_UPLOAD: "auto_illustrator_conso_vibe_transfer_upload";
    readonly VIBE_TRANSFER_UPLOAD_INPUT: "auto_illustrator_conso_vibe_transfer_upload_input";
    readonly VIBE_TRANSFER_MANAGER_OPEN: "auto_illustrator_conso_vibe_transfer_manager_open";
    readonly VIBE_TRANSFER_MANAGER_EDIT_MODE: "auto_illustrator_conso_vibe_transfer_manager_edit_mode";
    readonly VIBE_TRANSFER_MANAGER_SEARCH: "auto_illustrator_conso_vibe_transfer_manager_search";
    readonly VIBE_TRANSFER_MANAGER_LIST: "auto_illustrator_conso_vibe_transfer_manager_list";
    readonly VIBE_TRANSFER_MANAGER_STATUS: "auto_illustrator_conso_vibe_transfer_manager_status";
    readonly VIBE_TRANSFER_BUNDLE_IMPORT: "auto_illustrator_conso_vibe_transfer_bundle_import";
    readonly VIBE_TRANSFER_BUNDLE_IMPORT_INPUT: "auto_illustrator_conso_vibe_transfer_bundle_import_input";
    readonly VIBE_TRANSFER_BUNDLE_EXPORT: "auto_illustrator_conso_vibe_transfer_bundle_export";
    readonly VIBE_TRANSFER_EXPORT_INCLUDE_SOURCE_IMAGES: "auto_illustrator_conso_vibe_transfer_export_include_source_images";
    readonly VIBE_TRANSFER_PRESET_OVERWRITE: "auto_illustrator_conso_vibe_transfer_preset_overwrite";
    readonly VIBE_TRANSFER_PRESET_RENAME: "auto_illustrator_conso_vibe_transfer_preset_rename";
    readonly VIBE_TRANSFER_REFERENCE_LIST: "auto_illustrator_conso_vibe_transfer_reference_list";
    readonly VIBE_TRANSFER_REFERENCE_SEARCH: "auto_illustrator_conso_vibe_transfer_reference_search";
    readonly VIBE_TRANSFER_CLEAR: "auto_illustrator_conso_vibe_transfer_clear";
    readonly VIBE_TRANSFER_PRESET_NAME: "auto_illustrator_conso_vibe_transfer_preset_name";
    readonly VIBE_TRANSFER_PRESET_SELECT: "auto_illustrator_conso_vibe_transfer_preset_select";
    readonly VIBE_TRANSFER_PRESET_SAVE: "auto_illustrator_conso_vibe_transfer_preset_save";
    readonly VIBE_TRANSFER_PRESET_APPLY: "auto_illustrator_conso_vibe_transfer_preset_apply";
    readonly VIBE_TRANSFER_PRESET_DELETE: "auto_illustrator_conso_vibe_transfer_preset_delete";
    readonly VIBE_TRANSFER_REFERENCE_STRENGTH: "auto_illustrator_conso_vibe_transfer_reference_strength";
    readonly VIBE_TRANSFER_REFERENCE_STRENGTH_VALUE: "auto_illustrator_conso_vibe_transfer_reference_strength_value";
    readonly VIBE_TRANSFER_INFORMATION_EXTRACTED: "auto_illustrator_conso_vibe_transfer_information_extracted";
    readonly VIBE_TRANSFER_INFORMATION_EXTRACTED_VALUE: "auto_illustrator_conso_vibe_transfer_information_extracted_value";
    readonly VIBE_TRANSFER_STATUS: "auto_illustrator_conso_vibe_transfer_status";
};
/**
 * Stable DOM section IDs for the floating panel source area.
 * These are not form control IDs; they identify movable UI fragments.
 */
export declare const UI_SECTION_IDS: {
    readonly FLOATING_PANEL_SOURCE: "auto_illustrator_conso_floating_panel_source";
    readonly MAIN_ENABLED: "auto_illustrator_conso_panel_main_enabled";
    readonly MAIN_IMAGE_SUBFOLDER: "auto_illustrator_conso_panel_main_image_subfolder";
    readonly MAIN_INFO: "auto_illustrator_conso_panel_main_info";
    readonly MAIN_REGEX: "auto_illustrator_conso_panel_main_regex";
    readonly PROMPT_MODE_SELECTOR: "auto_illustrator_conso_panel_prompt_mode_selector";
    readonly SHARED_META_DISPLAY: "auto_illustrator_conso_panel_shared_meta_display";
    readonly INDEPENDENT_BASE: "auto_illustrator_conso_panel_independent_base";
    readonly CONTEXT_INJECTION: "auto_illustrator_conso_panel_context_injection";
    readonly WORLD_INFO: "auto_illustrator_conso_panel_world_info";
    readonly GUIDELINES: "auto_illustrator_conso_panel_guidelines";
    readonly INDEPENDENT_LLM: "auto_illustrator_conso_panel_independent_llm";
    readonly PROMPT_STYLE: "auto_illustrator_conso_panel_prompt_style";
    readonly STANDALONE: "auto_illustrator_conso_panel_standalone";
    readonly CHARACTER_TAGS: "auto_illustrator_conso_panel_character_tags";
    readonly TAG_CATALOG: "auto_illustrator_conso_panel_tag_catalog";
    readonly PRESET_IMPORT: "auto_illustrator_conso_panel_preset_import";
    readonly PROMPT_LIBRARY: "auto_illustrator_conso_panel_prompt_library";
    readonly MAIN_RANDOM_SD_STYLE: "auto_illustrator_conso_panel_main_random_sd_style";
    readonly MAIN_VIBE_TRANSFER: "auto_illustrator_conso_panel_main_vibe_transfer";
    readonly VIBE_MANAGER: "auto_illustrator_conso_panel_vibe_manager";
};
