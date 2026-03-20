/**
 * Constants Module
 * Centralized configuration values, defaults, and validation ranges
 *
 * This module provides a single source of truth for all settings-related
 * constants to avoid magic numbers scattered throughout the codebase.
 */

import promptWritingGuidelinesSfw from './presets/prompt_writing_guidelines.md';
import type {CharacterFixedTagEntry} from './types';

/**
 * Extension identifier used for settings storage
 */
export const EXTENSION_NAME = 'auto_illustrator_conso';

/**
 * Extension version (single source of truth)
 */
export const EXTENSION_VERSION = '1.4.0';

/**
 * GitHub repository for update checks
 */
export const GITHUB_REPO = 'Asobi-123/sillytavern-conso-illustrator';

/**
 * Streaming poll interval configuration (milliseconds)
 * Controls how frequently the extension checks for new prompts during streaming
 */
export const STREAMING_POLL_INTERVAL = {
  DEFAULT: 300,
  MIN: 10,
  MAX: 1000,
  STEP: 10,
} as const;

/**
 * Max concurrent generations configuration
 * Controls how many images can be generated simultaneously
 */
export const MAX_CONCURRENT_GENERATIONS = {
  DEFAULT: 1,
  MIN: 1,
  MAX: 5,
  STEP: 1,
} as const;

/**
 * Log level options
 */
export const LOG_LEVELS = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  SILENT: 'silent',
} as const;

/**
 * Default log level
 */
export const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;

/**
 * Preset ID constants
 */
export const PRESET_IDS = {
  DEFAULT: 'default',
  NAI_45_FULL: 'nai-4.5-full',
} as const;

/**
 * Manual generation mode configuration
 * Controls whether to replace existing images or append new ones
 */
export const MANUAL_GENERATION_MODE = {
  REPLACE: 'replace',
  APPEND: 'append',
  DEFAULT: 'append',
} as const;

/**
 * Minimum generation interval configuration (milliseconds)
 * Enforces a minimum time delay between consecutive image generation requests
 * to prevent rate limiting or overwhelming the image generation API
 */
export const MIN_GENERATION_INTERVAL = {
  DEFAULT: 0,
  MIN: 0,
  MAX: 10000,
  STEP: 100,
} as const;

/**
 * Prompt generation mode configuration
 * Controls how image prompts are generated
 */
export const PROMPT_GENERATION_MODE = {
  SHARED_API: 'shared-api', // AI embeds prompts in main response (default)
  INDEPENDENT_API: 'independent-api', // Separate API call after response
  // Legacy aliases for backward compatibility
  REGEX: 'shared-api',
  LLM_POST: 'independent-api',
  DEFAULT: 'shared-api',
} as const;

/**
 * Max prompts per message configuration
 * Controls cost when using LLM-based prompt generation
 */
export const MAX_PROMPTS_PER_MESSAGE = {
  DEFAULT: 5,
  MIN: 1,
  MAX: 30,
  STEP: 1,
} as const;

/**
 * Context message count configuration
 * Controls how many previous messages are included as context for LLM prompt generation
 */
export const CONTEXT_MESSAGE_COUNT = {
  DEFAULT: 10,
  MIN: 0,
  MAX: 50,
  STEP: 1,
} as const;

/**
 * Meta prompt depth configuration
 * Controls where the meta prompt is inserted in chat history for shared API mode
 * depth=0: last message (default), depth=1: one before last, etc.
 */
export const META_PROMPT_DEPTH = {
  DEFAULT: 0,
  MIN: 0,
  MAX: 20,
  STEP: 1,
} as const;

/**
 * Final reconciliation delay configuration (milliseconds)
 * Controls how long to wait after GENERATION_ENDED before running final reconciliation
 * This helps recover images removed by other extensions that run async handlers
 */
export const FINAL_RECONCILIATION_DELAY = {
  DEFAULT: 5000,
  MIN: 0,
  MAX: 30000,
  STEP: 1000,
} as const;

/**
 * Image display width configuration (percentage)
 * Controls the display width of generated images in chat messages
 */
export const IMAGE_DISPLAY_WIDTH = {
  DEFAULT: 100,
  MIN: 10,
  MAX: 100,
  STEP: 5,
} as const;

/**
 * Image retention period configuration (days)
 * Controls how long generated images are kept before cleanup
 */
export const IMAGE_RETENTION_DAYS = {
  DEFAULT: 1,
  MIN: 1,
  MAX: 7,
  STEP: 1,
} as const;

/**
 * Default frequency guidelines for LLM prompt generation
 * Tells the LLM when to generate image prompts
 */
export const DEFAULT_LLM_FREQUENCY_GUIDELINES = `Find 0-5 key visual moments in the message that are worth illustrating
   - Aim for approximately one prompt every 250 words or at major scene changes
   - Focus on scenes with clear visual descriptions
   - Prioritize major scene transitions, character introductions, or significant moments
   - Skip if the message has no visual content (pure dialogue, abstract concepts)`;

/**
 * Default prompt writing guidelines for LLM prompt generation
 * Tells the LLM how to structure image generation prompts
 * Loaded from: src/presets/prompt_writing_guidelines.md
 */
export const DEFAULT_LLM_PROMPT_WRITING_GUIDELINES = promptWritingGuidelinesSfw;

/**
 * Independent LLM API configuration defaults
 */
export const INDEPENDENT_LLM_API = {
  DEFAULT_URL: 'https://api.openai.com/v1',
  DEFAULT_MODEL: 'gpt-4o-mini',
} as const;

/**
 * Independent LLM max tokens configuration
 */
export const INDEPENDENT_LLM_MAX_TOKENS = {
  DEFAULT: 4096,
  MIN: 256,
  MAX: 32000,
  STEP: 256,
} as const;

/**
 * Default HTML tags to filter from message text before sending to LLM
 */
export const DEFAULT_CONTENT_FILTER_TAGS = ['style', 'script'];

/**
 * Default prompt detection patterns
 * Supports multiple tag formats for backward compatibility:
 * - HTML comment format (primary, invisible, passes through DOMPurify)
 * - Underscore format (legacy, from old chats)
 */
export const DEFAULT_PROMPT_DETECTION_PATTERNS = [
  '<!--img-prompt="([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"\\s*-->',
  '<img_prompt="([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"\\s*>',
];

/**
 * Default settings for the extension
 * These values are used when no saved settings exist or when resetting
 */
export const DEFAULT_SETTINGS = {
  enabled: true,
  streamingPollInterval: STREAMING_POLL_INTERVAL.DEFAULT,
  monitorPollingInterval: STREAMING_POLL_INTERVAL.DEFAULT,
  maxConcurrentGenerations: MAX_CONCURRENT_GENERATIONS.DEFAULT,
  minGenerationInterval: MIN_GENERATION_INTERVAL.DEFAULT,
  logLevel: DEFAULT_LOG_LEVEL,
  currentPresetId: PRESET_IDS.DEFAULT,
  customPresets: [] as MetaPromptPreset[],
  manualGenerationMode: MANUAL_GENERATION_MODE.DEFAULT,
  promptDetectionPatterns: DEFAULT_PROMPT_DETECTION_PATTERNS,
  commonStyleTags: '',
  commonStyleTagsPosition: 'prefix' as const,
  showGalleryWidget: true,
  showProgressWidget: true,
  showStreamingPreviewWidget: true,
  enableClickToRegenerate: true,
  promptGenerationMode: PROMPT_GENERATION_MODE.DEFAULT,
  metaPromptDepth: META_PROMPT_DEPTH.DEFAULT,
  maxPromptsPerMessage: MAX_PROMPTS_PER_MESSAGE.DEFAULT,
  contextMessageCount: CONTEXT_MESSAGE_COUNT.DEFAULT,
  llmFrequencyGuidelines: DEFAULT_LLM_FREQUENCY_GUIDELINES,
  llmPromptWritingGuidelines: DEFAULT_LLM_PROMPT_WRITING_GUIDELINES,
  currentIndependentLlmPresetId: 'default',
  customIndependentLlmPresets: [] as IndependentLlmGuidelinesPreset[],
  finalReconciliationDelayMs: FINAL_RECONCILIATION_DELAY.DEFAULT,
  imageDisplayWidth: IMAGE_DISPLAY_WIDTH.DEFAULT,
  imageRetentionDays: IMAGE_RETENTION_DAYS.DEFAULT,
  useIndependentLlmApi: false,
  independentLlmApiUrl: INDEPENDENT_LLM_API.DEFAULT_URL,
  independentLlmApiKey: '',
  independentLlmModel: INDEPENDENT_LLM_API.DEFAULT_MODEL,
  independentLlmMaxTokens: INDEPENDENT_LLM_MAX_TOKENS.DEFAULT,
  injectCharacterDescription: true,
  injectUserPersona: true,
  injectScenario: true,
  contentFilterTags: DEFAULT_CONTENT_FILTER_TAGS,
  injectWorldInfo: false,
  apiProfiles: [] as ApiProfile[],
  currentApiProfileId: '',
  characterFixedTags: {} as Record<string, CharacterFixedTagEntry>,
};

/**
 * UI element IDs for settings controls
 */
export const UI_ELEMENT_IDS = {
  ENABLED: 'auto_illustrator_conso_enabled',
  META_PROMPT: 'auto_illustrator_conso_meta_prompt',
  META_PROMPT_DEPTH: 'auto_illustrator_conso_meta_prompt_depth',
  META_PROMPT_PRESET_SELECT: 'auto_illustrator_conso_preset_select',
  META_PROMPT_PRESET_EDIT: 'auto_illustrator_conso_preset_edit',
  META_PROMPT_PRESET_SAVE: 'auto_illustrator_conso_preset_save',
  META_PROMPT_PRESET_SAVE_AS: 'auto_illustrator_conso_preset_save_as',
  META_PROMPT_PRESET_DELETE: 'auto_illustrator_conso_preset_delete',
  META_PROMPT_PRESET_CANCEL: 'auto_illustrator_conso_preset_cancel',
  PRESET_EDITOR: 'auto_illustrator_conso_preset_editor',
  PRESET_VIEWER: 'auto_illustrator_conso_preset_viewer',
  PRESET_PREVIEW: 'auto_illustrator_conso_preset_preview',
  STREAMING_POLL_INTERVAL: 'auto_illustrator_conso_streaming_poll_interval',
  MAX_CONCURRENT: 'auto_illustrator_conso_max_concurrent',
  MIN_GENERATION_INTERVAL: 'auto_illustrator_conso_min_generation_interval',
  LOG_LEVEL: 'auto_illustrator_conso_log_level',
  MANUAL_GEN_MODE: 'auto_illustrator_conso_manual_gen_mode',
  PROMPT_PATTERNS: 'auto_illustrator_conso_prompt_patterns',
  PROMPT_PATTERNS_RESET: 'auto_illustrator_conso_prompt_patterns_reset',
  PATTERN_VALIDATION_STATUS: 'auto_illustrator_conso_pattern_validation_status',
  COMMON_STYLE_TAGS: 'auto_illustrator_conso_common_style_tags',
  COMMON_STYLE_TAGS_POSITION:
    'auto_illustrator_conso_common_style_tags_position',
  SHOW_GALLERY_WIDGET: 'auto_illustrator_conso_show_gallery_widget',
  SHOW_PROGRESS_WIDGET: 'auto_illustrator_conso_show_progress_widget',
  SHOW_STREAMING_PREVIEW_WIDGET:
    'auto_illustrator_conso_show_streaming_preview_widget',
  PROMPT_GENERATION_MODE_SHARED:
    'auto_illustrator_conso_prompt_gen_mode_shared',
  PROMPT_GENERATION_MODE_INDEPENDENT:
    'auto_illustrator_conso_prompt_gen_mode_independent',
  INDEPENDENT_API_SETTINGS_CONTAINER:
    'auto_illustrator_conso_independent_api_settings_container',
  MAX_PROMPTS_PER_MESSAGE: 'auto_illustrator_conso_max_prompts_per_message',
  CONTEXT_MESSAGE_COUNT: 'auto_illustrator_conso_context_message_count',
  LLM_FREQUENCY_GUIDELINES: 'auto_illustrator_conso_llm_frequency_guidelines',
  LLM_FREQUENCY_GUIDELINES_RESET:
    'auto_illustrator_conso_llm_frequency_guidelines_reset',
  LLM_PROMPT_WRITING_GUIDELINES:
    'auto_illustrator_conso_llm_prompt_writing_guidelines',
  LLM_PROMPT_WRITING_GUIDELINES_RESET:
    'auto_illustrator_conso_llm_prompt_writing_guidelines_reset',
  IMAGE_DISPLAY_WIDTH: 'auto_illustrator_conso_image_display_width',
  IMAGE_DISPLAY_WIDTH_VALUE: 'auto_illustrator_conso_image_display_width_value',
  IMAGE_RETENTION_DAYS: 'auto_illustrator_conso_image_retention_days',
  USE_INDEPENDENT_LLM_API: 'auto_illustrator_conso_use_independent_llm_api',
  INDEPENDENT_LLM_API_URL: 'auto_illustrator_conso_independent_llm_api_url',
  INDEPENDENT_LLM_API_KEY: 'auto_illustrator_conso_independent_llm_api_key',
  INDEPENDENT_LLM_MODEL: 'auto_illustrator_conso_independent_llm_model',
  INDEPENDENT_LLM_MODEL_SELECT:
    'auto_illustrator_conso_independent_llm_model_select',
  INDEPENDENT_LLM_FETCH_MODELS:
    'auto_illustrator_conso_independent_llm_fetch_models',
  INDEPENDENT_LLM_MAX_TOKENS:
    'auto_illustrator_conso_independent_llm_max_tokens',
  INDEPENDENT_LLM_TEST_CONNECTION:
    'auto_illustrator_conso_independent_llm_test_connection',
  INDEPENDENT_LLM_SETTINGS_CONTAINER:
    'auto_illustrator_conso_independent_llm_settings_container',
  INDEPENDENT_LLM_VIEW_LAST_REQUEST:
    'auto_illustrator_conso_independent_llm_view_last_request',
  IMAGE_SUBFOLDER_LABEL: 'auto_illustrator_conso_image_subfolder_label',
  INJECT_CHARACTER_DESCRIPTION:
    'auto_illustrator_conso_inject_character_description',
  INJECT_USER_PERSONA: 'auto_illustrator_conso_inject_user_persona',
  INJECT_SCENARIO: 'auto_illustrator_conso_inject_scenario',
  CONTENT_FILTER_TAGS: 'auto_illustrator_conso_content_filter_tags',
  CONTENT_FILTER_TAGS_RESET: 'auto_illustrator_conso_content_filter_tags_reset',
  INDEPENDENT_LLM_PRESET_SELECT:
    'auto_illustrator_conso_independent_llm_preset_select',
  INDEPENDENT_LLM_PRESET_EDIT:
    'auto_illustrator_conso_independent_llm_preset_edit',
  INDEPENDENT_LLM_PRESET_SAVE:
    'auto_illustrator_conso_independent_llm_preset_save',
  INDEPENDENT_LLM_PRESET_SAVE_AS:
    'auto_illustrator_conso_independent_llm_preset_save_as',
  INDEPENDENT_LLM_PRESET_DELETE:
    'auto_illustrator_conso_independent_llm_preset_delete',
  INDEPENDENT_LLM_PRESET_CANCEL:
    'auto_illustrator_conso_independent_llm_preset_cancel',
  INDEPENDENT_LLM_PRESET_EDITOR:
    'auto_illustrator_conso_independent_llm_preset_editor',
  RESET_BUTTON: 'auto_illustrator_conso_reset',
  INJECT_WORLD_INFO: 'auto_illustrator_conso_inject_world_info',
  WORLD_INFO_PANEL: 'auto_illustrator_conso_world_info_panel',
  WORLD_INFO_SEARCH: 'auto_illustrator_conso_world_info_search',
  WORLD_INFO_REFRESH: 'auto_illustrator_conso_world_info_refresh',
  WORLD_INFO_BOOK_LIST: 'auto_illustrator_conso_world_info_book_list',
  WORLD_INFO_ENTRY_PANEL: 'auto_illustrator_conso_world_info_entry_panel',
  API_PROFILE_SELECT: 'auto_illustrator_conso_api_profile_select',
  API_PROFILE_SAVE: 'auto_illustrator_conso_api_profile_save',
  API_PROFILE_DELETE: 'auto_illustrator_conso_api_profile_delete',
  VERSION_DISPLAY: 'auto_illustrator_conso_version_display',
  VERSION_STATUS: 'auto_illustrator_conso_version_status',
  CHARACTER_FIXED_TAGS_LIST: 'auto_illustrator_conso_character_fixed_tags_list',
  CHARACTER_TAG_SEARCH: 'auto_illustrator_conso_character_tag_search',
  CHARACTER_TAG_ADD_NAME: 'auto_illustrator_conso_character_tag_add_name',
  CHARACTER_TAG_ADD_BTN: 'auto_illustrator_conso_character_tag_add_btn',
  CHARACTER_TAG_RESET_ALL: 'auto_illustrator_conso_character_tag_reset_all',
} as const;
