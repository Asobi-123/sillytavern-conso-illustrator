/**
 * Constants Module
 * Centralized configuration values, defaults, and validation ranges
 *
 * This module provides a single source of truth for all settings-related
 * constants to avoid magic numbers scattered throughout the codebase.
 */

import promptWritingGuidelinesSfw from './presets/prompt_writing_guidelines.md';
import type {CharacterFixedTagEntry} from './types';
import type {CharacterFixedTagInjectionMode} from './types';
import type {StyleTagPosition} from './types';
import type {
  GenerationStylePreset,
  PromptLibraryEntry,
  TagCatalogEntry,
  VibeLibraryItem,
  VibeTransferCombination,
  VibeTransferPreset,
  VibeTransferReferenceImage,
} from './types';

/**
 * Extension identifier used for settings storage
 */
export const EXTENSION_NAME = 'auto_illustrator_conso';

/**
 * Extension version (single source of truth)
 */
export const EXTENSION_VERSION = '1.13.0';

/**
 * GitHub repository for update checks
 */
export const GITHUB_REPO = 'Asobi-123/sillytavern-conso-illustrator';

/**
 * URL to the quickstart tutorial on GitHub
 */
export const TUTORIAL_URL = `https://github.com/${GITHUB_REPO}/blob/main/docs/QUICKSTART_CN.md`;

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
 * Standalone prompt count configuration
 */
export const STANDALONE_PROMPT_COUNT = {
  DEFAULT: 3,
  MIN: 1,
  MAX: 10,
  STEP: 1,
} as const;

/**
 * Prompt library max entries configuration
 */
export const PROMPT_LIBRARY_MAX_ENTRIES = {
  DEFAULT: 500,
  MIN: 10,
  MAX: 2000,
  STEP: 10,
} as const;

/**
 * Prompt library thumbnail configuration
 */
export const PROMPT_LIBRARY_THUMBNAIL = {
  MAX_SIZE: 200,
  QUALITY: 0.6,
} as const;

export const TAG_CATALOG_CATEGORIES = [
  'subject',
  'hair',
  'eyes',
  'expression',
  'pose_action',
  'clothing',
  'scene',
  'camera',
  'lighting_style',
  'undesired_content',
  'general',
] as const;

export const TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS: Record<string, number> = {
  subject: 8,
  hair: 8,
  eyes: 6,
  expression: 8,
  pose_action: 10,
  clothing: 8,
  scene: 10,
  camera: 8,
  lighting_style: 8,
  general: 6,
};

export const TAG_CATALOG_CANDIDATE_LIMIT = {
  MIN: 0,
  MAX: 50,
} as const;

export const TAG_CATALOG_PAGE_SIZE = {
  DEFAULT: 500,
  ALL: 0,
  OPTIONS: [200, 500, 1000, 2000, 0],
} as const;

/**
 * Companion server plugin fingerprint.
 * Bump VERSION whenever server-plugin/auto-illustrator-nai-advanced changes.
 */
export const SERVER_PLUGIN = {
  ID: 'auto-illustrator-nai-advanced',
  VERSION: '2026-07-03-vibe-bundle-v2',
  STATUS_ROUTE: '/api/plugins/auto-illustrator-nai-advanced/status',
} as const;

/**
 * NovelAI Vibe Transfer configuration.
 */
export const VIBE_TRANSFER = {
  DEFAULT_ENABLED: false,
  DEFAULT_REFERENCE_STRENGTH: 0.6,
  DEFAULT_INFORMATION_EXTRACTED: 1.0,
  MIN: 0,
  MAX: 1,
  STEP: 0.05,
  MAX_REFERENCES: 16,
  MAX_ENCODED_CACHE_PER_REFERENCE: 8,
  MAX_PRESETS: 30,
  MAX_SOURCE_IMAGE_SIZE: 768,
  SOURCE_IMAGE_MIME_TYPE: 'image/jpeg',
  SOURCE_IMAGE_QUALITY: 0.86,
  ADVANCED_ROUTE: '/api/plugins/auto-illustrator-nai-advanced/generate-image',
  STATUS_ROUTE: SERVER_PLUGIN.STATUS_ROUTE,
} as const;

/**
 * NovelAI Inpainting configuration.
 */
export const NAI_IMAGE_EDIT = {
  DEFAULT_INPAINTING_STRENGTH: 0.45,
  MIN_STRENGTH: 0,
  MAX_STRENGTH: 1,
  STRENGTH_STEP: 0.05,
  MAX_INPAINTING_STEPS: 24,
  FOCUSED_CONTEXT_PX: 192,
  FOCUSED_MIN_SIZE: 512,
  FOCUSED_DIMENSION_STEP: 64,
  FOCUSED_MAX_FULL_CANVAS_RATIO: 0.85,
  DEFAULT_MASK_PADDING_PX: 24,
  MIN_MASK_PADDING_PX: 0,
  MAX_MASK_PADDING_PX: 128,
  DEFAULT_MASK_FEATHER_PX: 24,
  MIN_MASK_FEATHER_PX: 0,
  MAX_MASK_FEATHER_PX: 80,
  MASK_FEATHER_STEP: 1,
  DEFAULT_MASK_EDGE_GUARD_PX: 4,
  MIN_MASK_EDGE_GUARD_PX: 0,
  MAX_MASK_EDGE_GUARD_PX: 32,
  MIN_ZOOM_PERCENT: 25,
  MAX_ZOOM_PERCENT: 300,
  ZOOM_STEP_PERCENT: 25,
  INPAINT_ROUTE:
    '/api/plugins/auto-illustrator-nai-advanced/generate-inpaint-image',
} as const;

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
  commonStyleTagsPosition: 'prefix' as StyleTagPosition,
  showGalleryWidget: true,
  showProgressWidget: true,
  showStreamingPreviewWidget: false,
  showFloatingPanelLauncher: true,
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
  characterFixedTagInjectionMode: 'legacy' as CharacterFixedTagInjectionMode,
  standalonePromptCount: STANDALONE_PROMPT_COUNT.DEFAULT,
  promptLibraryEntries: [] as PromptLibraryEntry[],
  promptLibraryMaxEntries: PROMPT_LIBRARY_MAX_ENTRIES.DEFAULT,
  promptLibrarySaveThumbnail: true,
  customTagCatalogEntries: [] as TagCatalogEntry[],
  customTagBridgeTriggers: {} as Record<string, string[]>,
  tagCatalogCandidateLimits: {...TAG_CATALOG_DEFAULT_CANDIDATE_LIMITS},
  generationStyleMode: 'off' as 'off' | 'fixed' | 'random',
  generationStylePresets: [] as GenerationStylePreset[],
  currentGenerationStylePresetId: '',
  fixedSdStyleName: '',
  fixedVibeCombinationId: '',
  randomizeSdStylePerGeneration: false,
  sdStylePoolWhitelist: [] as string[],
  restoreSdStyleAfter: true,
  randomizeVibeCombinationPerGeneration: false,
  vibeCombinationPoolWhitelist: [] as string[],
  vibeTransferEnabled: VIBE_TRANSFER.DEFAULT_ENABLED,
  vibeTransferLibraryItems: [] as VibeLibraryItem[],
  vibeTransferCombinations: [] as VibeTransferCombination[],
  currentVibeTransferCombinationId: '',
  vibeTransferManagerEditMode: false,
  vibeTransferManagerView: 'all' as 'all' | 'pending',
  vibeTransferReferenceImages: [] as VibeTransferReferenceImage[],
  vibeTransferPresets: [] as VibeTransferPreset[],
  currentVibeTransferPresetId: '',
  vibeTransferReferenceStrength: VIBE_TRANSFER.DEFAULT_REFERENCE_STRENGTH,
  vibeTransferInformationExtracted: VIBE_TRANSFER.DEFAULT_INFORMATION_EXTRACTED,
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
  SHOW_FLOATING_PANEL_LAUNCHER:
    'auto_illustrator_conso_show_floating_panel_launcher',
  OPEN_FLOATING_PANEL: 'auto_illustrator_conso_open_floating_panel',
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
  UPDATE_NOTICE: 'auto_illustrator_conso_update_notice',
  UPDATE_NOTICE_TITLE: 'auto_illustrator_conso_update_notice_title',
  UPDATE_NOTICE_LIST: 'auto_illustrator_conso_update_notice_list',
  UPDATE_NOTICE_MORE: 'auto_illustrator_conso_update_notice_more',
  UPDATE_NOTICE_LINK: 'auto_illustrator_conso_update_notice_link',
  SERVER_PLUGIN_STATUS: 'auto_illustrator_conso_server_plugin_status',
  SERVER_PLUGIN_INSTALL_HELP:
    'auto_illustrator_conso_server_plugin_install_help',
  TUTORIAL_LINK: 'auto_illustrator_conso_tutorial_link',
  CHARACTER_FIXED_TAGS_LIST: 'auto_illustrator_conso_character_fixed_tags_list',
  CHARACTER_TAG_SEARCH: 'auto_illustrator_conso_character_tag_search',
  CHARACTER_TAG_ADD_NAME: 'auto_illustrator_conso_character_tag_add_name',
  CHARACTER_TAG_ADD_BTN: 'auto_illustrator_conso_character_tag_add_btn',
  CHARACTER_TAG_RESET_ALL: 'auto_illustrator_conso_character_tag_reset_all',
  CHARACTER_TAG_INJECTION_MODE:
    'auto_illustrator_conso_character_tag_injection_mode',
  STANDALONE_MODE_AI: 'auto_illustrator_conso_standalone_mode_ai',
  STANDALONE_MODE_MANUAL: 'auto_illustrator_conso_standalone_mode_manual',
  STANDALONE_SCENE_INPUT: 'auto_illustrator_conso_standalone_scene_input',
  STANDALONE_PROMPT_COUNT: 'auto_illustrator_conso_standalone_prompt_count',
  STANDALONE_INCLUDE_CHAR_INFO:
    'auto_illustrator_conso_standalone_include_char_info',
  STANDALONE_INCLUDE_WORLD_INFO:
    'auto_illustrator_conso_standalone_include_world_info',
  STANDALONE_GENERATE_PROMPTS_BTN:
    'auto_illustrator_conso_standalone_generate_prompts',
  STANDALONE_AUTO_BTN: 'auto_illustrator_conso_standalone_auto',
  STANDALONE_RESULTS: 'auto_illustrator_conso_standalone_results',
  STANDALONE_GENERATE_ALL_BTN: 'auto_illustrator_conso_standalone_generate_all',
  STANDALONE_CLEAR_BTN: 'auto_illustrator_conso_standalone_clear',
  STANDALONE_MANUAL_PROMPT_INPUT:
    'auto_illustrator_conso_standalone_manual_prompt',
  STANDALONE_MANUAL_GENERATE_BTN:
    'auto_illustrator_conso_standalone_manual_generate',
  STANDALONE_MANUAL_IMAGE: 'auto_illustrator_conso_standalone_manual_image',
  STANDALONE_SUBFOLDER_LABEL:
    'auto_illustrator_conso_standalone_subfolder_label',
  PROMPT_LIBRARY_UPLOAD: 'auto_illustrator_conso_prompt_library_upload',
  PROMPT_LIBRARY_UPLOAD_INPUT:
    'auto_illustrator_conso_prompt_library_upload_input',
  PROMPT_LIBRARY_SEARCH: 'auto_illustrator_conso_prompt_library_search',
  PROMPT_LIBRARY_LIST: 'auto_illustrator_conso_prompt_library_list',
  PROMPT_LIBRARY_COUNT: 'auto_illustrator_conso_prompt_library_count',
  PROMPT_LIBRARY_EDIT_OVERLAY:
    'auto_illustrator_conso_prompt_library_edit_overlay',
  PROMPT_LIBRARY_EDIT_NAME: 'auto_illustrator_conso_prompt_library_edit_name',
  PROMPT_LIBRARY_EDIT_POSITIVE:
    'auto_illustrator_conso_prompt_library_edit_positive',
  PROMPT_LIBRARY_EDIT_NEGATIVE:
    'auto_illustrator_conso_prompt_library_edit_negative',
  PROMPT_LIBRARY_EDIT_TAGS: 'auto_illustrator_conso_prompt_library_edit_tags',
  PROMPT_LIBRARY_EDIT_CHARACTER:
    'auto_illustrator_conso_prompt_library_edit_character',
  PROMPT_LIBRARY_EDIT_SAVE: 'auto_illustrator_conso_prompt_library_edit_save',
  PROMPT_LIBRARY_EDIT_CANCEL:
    'auto_illustrator_conso_prompt_library_edit_cancel',
  TAG_CATALOG_SEARCH: 'auto_illustrator_conso_tag_catalog_search',
  TAG_CATALOG_CATEGORY: 'auto_illustrator_conso_tag_catalog_category',
  TAG_CATALOG_SOURCE_FILTER: 'auto_illustrator_conso_tag_catalog_source_filter',
  TAG_CATALOG_LIST: 'auto_illustrator_conso_tag_catalog_list',
  TAG_CATALOG_TOTAL: 'auto_illustrator_conso_tag_catalog_total',
  TAG_CATALOG_COUNT: 'auto_illustrator_conso_tag_catalog_count',
  TAG_CATALOG_SELECTED: 'auto_illustrator_conso_tag_catalog_selected',
  TAG_CATALOG_COPY_SELECTED: 'auto_illustrator_conso_tag_catalog_copy_selected',
  TAG_CATALOG_CLEAR_SELECTED:
    'auto_illustrator_conso_tag_catalog_clear_selected',
  TAG_CATALOG_ADD_COMMON: 'auto_illustrator_conso_tag_catalog_add_common',
  TAG_CATALOG_DELETE_CUSTOM_SELECTED:
    'auto_illustrator_conso_tag_catalog_delete_custom_selected',
  TAG_CATALOG_PAGE_SIZE: 'auto_illustrator_conso_tag_catalog_page_size',
  TAG_CATALOG_PAGE_PREV: 'auto_illustrator_conso_tag_catalog_page_prev',
  TAG_CATALOG_PAGE_NEXT: 'auto_illustrator_conso_tag_catalog_page_next',
  TAG_CATALOG_PAGE_STATUS: 'auto_illustrator_conso_tag_catalog_page_status',
  TAG_CATALOG_CANDIDATE_LIMITS:
    'auto_illustrator_conso_tag_catalog_candidate_limits',
  TAG_CATALOG_LAST_CANDIDATES:
    'auto_illustrator_conso_tag_catalog_last_candidates',
  TAG_CATALOG_REFRESH_LAST_CANDIDATES:
    'auto_illustrator_conso_tag_catalog_refresh_last_candidates',
  TAG_CATALOG_RESET_CANDIDATE_LIMITS:
    'auto_illustrator_conso_tag_catalog_reset_candidate_limits',
  TAG_CATALOG_CUSTOM_TAG: 'auto_illustrator_conso_tag_catalog_custom_tag',
  TAG_CATALOG_CUSTOM_LABEL: 'auto_illustrator_conso_tag_catalog_custom_label',
  TAG_CATALOG_CUSTOM_TRIGGERS:
    'auto_illustrator_conso_tag_catalog_custom_triggers',
  TAG_CATALOG_CUSTOM_CATEGORY:
    'auto_illustrator_conso_tag_catalog_custom_category',
  TAG_CATALOG_ADD_CUSTOM: 'auto_illustrator_conso_tag_catalog_add_custom',
  TAG_CATALOG_BRIDGE_SUMMARY:
    'auto_illustrator_conso_tag_catalog_bridge_summary',
  TAG_CATALOG_BRIDGE_TAG: 'auto_illustrator_conso_tag_catalog_bridge_tag',
  TAG_CATALOG_BRIDGE_EXISTING:
    'auto_illustrator_conso_tag_catalog_bridge_existing',
  TAG_CATALOG_BRIDGE_TRIGGERS:
    'auto_illustrator_conso_tag_catalog_bridge_triggers',
  TAG_CATALOG_SAVE_BRIDGE_TRIGGERS:
    'auto_illustrator_conso_tag_catalog_save_bridge_triggers',
  REGEX_MASTER: 'auto_illustrator_conso_regex_master',
  REGEX_IMG_PROMPT: 'auto_illustrator_conso_regex_img_prompt',
  REGEX_AUTO_ILLUSTRATOR: 'auto_illustrator_conso_regex_auto_illustrator',
  REGEX_IMG_TAG: 'auto_illustrator_conso_regex_img_tag',
  REGEX_SYNC: 'auto_illustrator_conso_regex_sync',
  REGEX_STATUS: 'auto_illustrator_conso_regex_status',
  PRESET_IMPORT_JSON: 'auto_illustrator_conso_preset_import_json',
  PRESET_IMPORT_FILE: 'auto_illustrator_conso_preset_import_file',
  PRESET_IMPORT_REQUIREMENT: 'auto_illustrator_conso_preset_import_requirement',
  PRESET_IMPORT_TARGET: 'auto_illustrator_conso_preset_import_target',
  PRESET_IMPORT_ANALYZE: 'auto_illustrator_conso_preset_import_analyze',
  PRESET_IMPORT_GENERATE: 'auto_illustrator_conso_preset_import_generate',
  PRESET_IMPORT_SAVE: 'auto_illustrator_conso_preset_import_save',
  PRESET_IMPORT_RESULT: 'auto_illustrator_conso_preset_import_result',
  PRESET_IMPORT_NAME: 'auto_illustrator_conso_preset_import_name',
  RANDOMIZE_SD_STYLE: 'auto_illustrator_conso_randomize_sd_style',
  GENERATION_STYLE_MODE: 'auto_illustrator_conso_generation_style_mode',
  FIXED_STYLE_PANEL: 'auto_illustrator_conso_fixed_style_panel',
  RANDOM_STYLE_PANEL: 'auto_illustrator_conso_random_style_panel',
  GENERATION_STYLE_PRESET_SELECT:
    'auto_illustrator_conso_generation_style_preset_select',
  GENERATION_STYLE_PRESET_NAME:
    'auto_illustrator_conso_generation_style_preset_name',
  GENERATION_STYLE_PRESET_SAVE:
    'auto_illustrator_conso_generation_style_preset_save',
  GENERATION_STYLE_PRESET_OVERWRITE:
    'auto_illustrator_conso_generation_style_preset_overwrite',
  GENERATION_STYLE_PRESET_DELETE:
    'auto_illustrator_conso_generation_style_preset_delete',
  FIXED_SD_STYLE_SELECT: 'auto_illustrator_conso_fixed_sd_style_select',
  FIXED_VIBE_COMBINATION_SELECT:
    'auto_illustrator_conso_fixed_vibe_combination_select',
  RESTORE_SD_STYLE_AFTER: 'auto_illustrator_conso_restore_sd_style_after',
  SD_STYLE_POOL_SUMMARY: 'auto_illustrator_conso_sd_style_pool_summary',
  SD_STYLE_POOL_LIST: 'auto_illustrator_conso_sd_style_pool_list',
  SD_STYLE_POOL_SEARCH: 'auto_illustrator_conso_sd_style_pool_search',
  SD_STYLE_POOL_REFRESH: 'auto_illustrator_conso_sd_style_pool_refresh',
  RANDOMIZE_VIBE_COMBINATION:
    'auto_illustrator_conso_randomize_vibe_combination',
  VIBE_COMBINATION_POOL_SUMMARY:
    'auto_illustrator_conso_vibe_combination_pool_summary',
  VIBE_COMBINATION_POOL_LIST:
    'auto_illustrator_conso_vibe_combination_pool_list',
  VIBE_COMBINATION_POOL_SEARCH:
    'auto_illustrator_conso_vibe_combination_pool_search',
  VIBE_TRANSFER_ENABLED: 'auto_illustrator_conso_vibe_transfer_enabled',
  VIBE_TRANSFER_UPLOAD: 'auto_illustrator_conso_vibe_transfer_upload',
  VIBE_TRANSFER_UPLOAD_INPUT:
    'auto_illustrator_conso_vibe_transfer_upload_input',
  VIBE_TRANSFER_MANAGER_OPEN:
    'auto_illustrator_conso_vibe_transfer_manager_open',
  VIBE_TRANSFER_MANAGER_EDIT_MODE:
    'auto_illustrator_conso_vibe_transfer_manager_edit_mode',
  VIBE_TRANSFER_MANAGER_SEARCH:
    'auto_illustrator_conso_vibe_transfer_manager_search',
  VIBE_TRANSFER_MANAGER_LIST:
    'auto_illustrator_conso_vibe_transfer_manager_list',
  VIBE_TRANSFER_MANAGER_STATUS:
    'auto_illustrator_conso_vibe_transfer_manager_status',
  VIBE_TRANSFER_BUNDLE_IMPORT:
    'auto_illustrator_conso_vibe_transfer_bundle_import',
  VIBE_TRANSFER_BUNDLE_IMPORT_INPUT:
    'auto_illustrator_conso_vibe_transfer_bundle_import_input',
  VIBE_TRANSFER_BUNDLE_EXPORT:
    'auto_illustrator_conso_vibe_transfer_bundle_export',
  VIBE_TRANSFER_PRESET_OVERWRITE:
    'auto_illustrator_conso_vibe_transfer_preset_overwrite',
  VIBE_TRANSFER_REFERENCE_LIST:
    'auto_illustrator_conso_vibe_transfer_reference_list',
  VIBE_TRANSFER_REFERENCE_SEARCH:
    'auto_illustrator_conso_vibe_transfer_reference_search',
  VIBE_TRANSFER_CLEAR: 'auto_illustrator_conso_vibe_transfer_clear',
  VIBE_TRANSFER_PRESET_NAME: 'auto_illustrator_conso_vibe_transfer_preset_name',
  VIBE_TRANSFER_PRESET_SELECT:
    'auto_illustrator_conso_vibe_transfer_preset_select',
  VIBE_TRANSFER_PRESET_SAVE: 'auto_illustrator_conso_vibe_transfer_preset_save',
  VIBE_TRANSFER_PRESET_APPLY:
    'auto_illustrator_conso_vibe_transfer_preset_apply',
  VIBE_TRANSFER_PRESET_DELETE:
    'auto_illustrator_conso_vibe_transfer_preset_delete',
  VIBE_TRANSFER_REFERENCE_STRENGTH:
    'auto_illustrator_conso_vibe_transfer_reference_strength',
  VIBE_TRANSFER_REFERENCE_STRENGTH_VALUE:
    'auto_illustrator_conso_vibe_transfer_reference_strength_value',
  VIBE_TRANSFER_INFORMATION_EXTRACTED:
    'auto_illustrator_conso_vibe_transfer_information_extracted',
  VIBE_TRANSFER_INFORMATION_EXTRACTED_VALUE:
    'auto_illustrator_conso_vibe_transfer_information_extracted_value',
  VIBE_TRANSFER_STATUS: 'auto_illustrator_conso_vibe_transfer_status',
} as const;

/**
 * Stable DOM section IDs for the floating panel source area.
 * These are not form control IDs; they identify movable UI fragments.
 */
export const UI_SECTION_IDS = {
  FLOATING_PANEL_SOURCE: 'auto_illustrator_conso_floating_panel_source',
  MAIN_ENABLED: 'auto_illustrator_conso_panel_main_enabled',
  MAIN_IMAGE_SUBFOLDER: 'auto_illustrator_conso_panel_main_image_subfolder',
  MAIN_INFO: 'auto_illustrator_conso_panel_main_info',
  MAIN_REGEX: 'auto_illustrator_conso_panel_main_regex',
  PROMPT_MODE_SELECTOR: 'auto_illustrator_conso_panel_prompt_mode_selector',
  SHARED_META_DISPLAY: 'auto_illustrator_conso_panel_shared_meta_display',
  INDEPENDENT_BASE: 'auto_illustrator_conso_panel_independent_base',
  CONTEXT_INJECTION: 'auto_illustrator_conso_panel_context_injection',
  WORLD_INFO: 'auto_illustrator_conso_panel_world_info',
  GUIDELINES: 'auto_illustrator_conso_panel_guidelines',
  INDEPENDENT_LLM: 'auto_illustrator_conso_panel_independent_llm',
  PROMPT_STYLE: 'auto_illustrator_conso_panel_prompt_style',
  STANDALONE: 'auto_illustrator_conso_panel_standalone',
  CHARACTER_TAGS: 'auto_illustrator_conso_panel_character_tags',
  TAG_CATALOG: 'auto_illustrator_conso_panel_tag_catalog',
  PRESET_IMPORT: 'auto_illustrator_conso_panel_preset_import',
  PROMPT_LIBRARY: 'auto_illustrator_conso_panel_prompt_library',
  MAIN_RANDOM_SD_STYLE: 'auto_illustrator_conso_panel_main_random_sd_style',
  MAIN_VIBE_TRANSFER: 'auto_illustrator_conso_panel_main_vibe_transfer',
  VIBE_MANAGER: 'auto_illustrator_conso_panel_vibe_manager',
} as const;
