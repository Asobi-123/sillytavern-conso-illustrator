/**
 * Constants Module
 * Centralized configuration values, defaults, and validation ranges
 *
 * This module provides a single source of truth for all settings-related
 * constants to avoid magic numbers scattered throughout the codebase.
 */
/**
 * Extension identifier used for settings storage
 */
export declare const EXTENSION_NAME = "auto_illustrator_conso";
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
 * Default prompt detection patterns
 * Supports multiple tag formats for backward compatibility:
 * - HTML comment format (primary, invisible, passes through DOMPurify)
 * - Underscore format (legacy, from old chats)
 */
export declare const DEFAULT_PROMPT_DETECTION_PATTERNS: string[];
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
    commonStyleTagsPosition: "prefix";
    showGalleryWidget: boolean;
    showProgressWidget: boolean;
    showStreamingPreviewWidget: boolean;
    enableClickToRegenerate: boolean;
    promptGenerationMode: "shared-api";
    metaPromptDepth: 0;
    maxPromptsPerMessage: 5;
    contextMessageCount: 10;
    llmFrequencyGuidelines: string;
    llmPromptWritingGuidelines: string;
    finalReconciliationDelayMs: 5000;
    imageDisplayWidth: 100;
    imageRetentionDays: 1;
    useIndependentLlmApi: boolean;
    independentLlmApiUrl: "https://api.openai.com/v1";
    independentLlmApiKey: string;
    independentLlmModel: "gpt-4o-mini";
    independentLlmMaxTokens: 4096;
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
    readonly RESET_BUTTON: "auto_illustrator_conso_reset";
};
