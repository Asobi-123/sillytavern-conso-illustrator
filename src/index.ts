/**
 * Auto Illustrator Extension for SillyTavern
 * Automatically generates inline images based on story context
 */

import './style.css';
import {
  pruneGeneratedImages,
  pruneGeneratedImagesAndPrompts,
} from './chat_history_pruner';
import {sessionManager} from './session_manager';
// metadata functions imported where needed
import {
  handleStreamTokenStarted,
  handleMessageReceived,
  handleGenerationEnded,
  handleManualIndependentPromptRetry,
} from './message_handler';
import {addImageClickHandlers} from './manual_generation';
import {syncIndependentPromptRetryButtons} from './independent_prompt_retry';
import {
  loadSettings,
  saveSettings,
  getDefaultSettings,
  createSettingsUI,
} from './settings';
import {createLogger, setLogLevel} from './logger';
import {
  UI_ELEMENT_IDS,
  DEFAULT_PROMPT_DETECTION_PATTERNS,
  STREAMING_POLL_INTERVAL,
  MAX_CONCURRENT_GENERATIONS,
  MIN_GENERATION_INTERVAL,
  MAX_PROMPTS_PER_MESSAGE,
  CONTEXT_MESSAGE_COUNT,
  META_PROMPT_DEPTH,
  IMAGE_DISPLAY_WIDTH,
  IMAGE_RETENTION_DAYS,
  INDEPENDENT_LLM_MAX_TOKENS,
  STANDALONE_PROMPT_COUNT,
  DEFAULT_LLM_FREQUENCY_GUIDELINES,
  DEFAULT_LLM_PROMPT_WRITING_GUIDELINES,
  DEFAULT_CONTENT_FILTER_TAGS,
  PROMPT_GENERATION_MODE,
  EXTENSION_VERSION,
  GITHUB_REPO,
} from './constants';
import {
  getPresetById,
  isPresetPredefined,
  isPredefinedPresetName,
} from './meta_prompt_presets';
import {
  getIndependentLlmPresetById,
  isIndependentLlmPresetPredefined,
  isIndependentLlmPredefinedPresetName,
} from './independent_llm_presets';
import {
  initializeConcurrencyLimiter,
  updateMaxConcurrent,
  updateMinInterval,
  setImageSubfolderLabel,
} from './image_generator';
import {initializeI18n, t} from './i18n';
import {extractImagePromptsMultiPattern} from './regex';
import {progressManager} from './progress_manager';
import {
  initializeProgressWidget,
  clearProgressWidgetState,
} from './progress_widget';
import {initializeGalleryWidget, getGalleryWidget} from './gallery_widget';
import {StreamingPreviewWidget} from './streaming_preview_widget';
import {isIndependentApiMode} from './mode_utils';
import {initializeChatChangedHandler} from './chat_changed_handler';
import {initializeChatChangeOperations} from './chat_change_operations';
import {runStartupCleanup} from './image_cleaner';
import {getMetadata, saveMetadata} from './metadata';
import {
  initializeWorldInfoPanel,
  toggleWorldInfoPanelVisibility,
  registerWorldInfoEventListeners,
} from './worldinfo_ui';
import {initializeCharacterTagsPanel} from './character_tags_ui';
import {initializeStandaloneGeneration} from './standalone_generation_ui';
import {initializePromptLibrary} from './prompt_library_ui';
import {
  initializeFloatingPanel,
  openFloatingPanel,
  setFloatingPanelLauncherVisible,
} from './floating_panel_ui';

const logger = createLogger('Main');

// Module state
let context: SillyTavernContext;
let settings: AutoIllustratorSettings;
let isEditingPreset = false; // Track if user is currently editing a preset
let isEditingIndependentLlmPreset = false; // Track if user is editing independent LLM preset
let streamingPreviewWidget: StreamingPreviewWidget | null = null; // Streaming preview widget instance
let imageWidthUpdateTimer: ReturnType<typeof setTimeout> | null = null; // Debounce timer for image width updates
let previousImageDisplayWidth: number | null = null; // Track previous width to detect actual changes
let extensionInitialized = false;

type RegisteredEventHandlers = {
  streamTokenReceived: () => void;
  messageReceived: (messageId: number) => void;
  messageUpdated: () => void;
  generationStarted: (type: string, options: unknown, dryRun: boolean) => void;
  generationEnded: (messageId: number) => void;
  chatCompletionPromptReady: (eventData: any) => void;
};
let registeredEventHandlers: RegisteredEventHandlers | null = null;

// Generation state
export let currentGenerationType: string | null = null; // Track generation type for filtering

/**
 * Get the streaming preview widget instance
 * @returns Streaming preview widget or null if not initialized
 */
export function getStreamingPreviewWidget(): StreamingPreviewWidget | null {
  return streamingPreviewWidget;
}

/**
 * Checks if streaming generation is currently active
 * @param messageId - Optional message ID to check. If provided, checks if THIS message is streaming.
 *                    If omitted, checks if ANY message is streaming.
 * @returns True if streaming is in progress
 */
export function isStreamingActive(messageId?: number): boolean {
  return sessionManager?.isActive(messageId) ?? false;
}

/**
 * Checks if a specific message is currently being streamed
 * @param messageId - Message ID to check
 * @returns True if this message is being streamed
 */
export function isMessageBeingStreamed(messageId: number): boolean {
  return sessionManager?.isActive(messageId) ?? false;
}

/**
 * Updates the UI elements with current settings
 */
function updateUI(): void {
  const enabledCheckbox = document.getElementById(
    UI_ELEMENT_IDS.ENABLED
  ) as HTMLInputElement;
  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;
  const presetSelect = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_PRESET_SELECT
  ) as HTMLSelectElement;
  const presetDeleteButton = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_PRESET_DELETE
  ) as HTMLButtonElement;
  const presetEditor = document.getElementById(
    UI_ELEMENT_IDS.PRESET_EDITOR
  ) as HTMLDivElement;
  const presetViewer = document.getElementById(
    UI_ELEMENT_IDS.PRESET_VIEWER
  ) as HTMLDivElement;
  const presetPreview = document.getElementById(
    UI_ELEMENT_IDS.PRESET_PREVIEW
  ) as HTMLPreElement;
  const streamingPollIntervalInput = document.getElementById(
    UI_ELEMENT_IDS.STREAMING_POLL_INTERVAL
  ) as HTMLInputElement;
  const maxConcurrentInput = document.getElementById(
    UI_ELEMENT_IDS.MAX_CONCURRENT
  ) as HTMLInputElement;
  const minGenerationIntervalInput = document.getElementById(
    UI_ELEMENT_IDS.MIN_GENERATION_INTERVAL
  ) as HTMLInputElement;
  const logLevelSelect = document.getElementById(
    UI_ELEMENT_IDS.LOG_LEVEL
  ) as HTMLSelectElement;
  const promptPatternsTextarea = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_PATTERNS
  ) as HTMLTextAreaElement;
  const commonStyleTagsTextarea = document.getElementById(
    UI_ELEMENT_IDS.COMMON_STYLE_TAGS
  ) as HTMLTextAreaElement;
  const commonStyleTagsPositionSelect = document.getElementById(
    UI_ELEMENT_IDS.COMMON_STYLE_TAGS_POSITION
  ) as HTMLSelectElement;
  const manualGenModeSelect = document.getElementById(
    UI_ELEMENT_IDS.MANUAL_GEN_MODE
  ) as HTMLSelectElement;
  const showGalleryWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_GALLERY_WIDGET
  ) as HTMLInputElement;
  const showProgressWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_PROGRESS_WIDGET
  ) as HTMLInputElement;
  const showStreamingPreviewWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_STREAMING_PREVIEW_WIDGET
  ) as HTMLInputElement;
  const showFloatingPanelLauncherCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_FLOATING_PANEL_LAUNCHER
  ) as HTMLInputElement;
  const promptGenModeRegexRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_SHARED
  ) as HTMLInputElement;
  const promptGenModeLLMRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_INDEPENDENT
  ) as HTMLInputElement;
  const maxPromptsPerMessageInput = document.getElementById(
    UI_ELEMENT_IDS.MAX_PROMPTS_PER_MESSAGE
  ) as HTMLInputElement;
  const contextMessageCountInput = document.getElementById(
    UI_ELEMENT_IDS.CONTEXT_MESSAGE_COUNT
  ) as HTMLInputElement;
  const metaPromptDepthInput = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_DEPTH
  ) as HTMLInputElement;
  const standalonePromptCountInput = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_PROMPT_COUNT
  ) as HTMLInputElement;
  // Update image retention days
  const imageRetentionDaysInput = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_RETENTION_DAYS
  ) as HTMLInputElement;
  if (imageRetentionDaysInput) {
    imageRetentionDaysInput.value = (
      settings.imageRetentionDays ?? 1
    ).toString();
  }

  // Update basic settings
  if (enabledCheckbox) enabledCheckbox.checked = settings.enabled;
  if (streamingPollIntervalInput)
    streamingPollIntervalInput.value =
      settings.streamingPollInterval.toString();
  if (maxConcurrentInput)
    maxConcurrentInput.value = settings.maxConcurrentGenerations.toString();
  if (minGenerationIntervalInput)
    minGenerationIntervalInput.value =
      settings.minGenerationInterval.toString();
  if (logLevelSelect) logLevelSelect.value = settings.logLevel;
  if (promptPatternsTextarea)
    promptPatternsTextarea.value = settings.promptDetectionPatterns.join('\n');
  if (commonStyleTagsTextarea)
    commonStyleTagsTextarea.value = settings.commonStyleTags;
  if (commonStyleTagsPositionSelect)
    commonStyleTagsPositionSelect.value = settings.commonStyleTagsPosition;
  if (manualGenModeSelect)
    manualGenModeSelect.value = settings.manualGenerationMode;
  if (showGalleryWidgetCheckbox)
    showGalleryWidgetCheckbox.checked = settings.showGalleryWidget;
  if (showProgressWidgetCheckbox)
    showProgressWidgetCheckbox.checked = settings.showProgressWidget;
  if (showStreamingPreviewWidgetCheckbox)
    showStreamingPreviewWidgetCheckbox.checked =
      settings.showStreamingPreviewWidget;
  if (showFloatingPanelLauncherCheckbox)
    showFloatingPanelLauncherCheckbox.checked =
      settings.showFloatingPanelLauncher;

  // Update image display width
  const imageDisplayWidthInput = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_DISPLAY_WIDTH
  ) as HTMLInputElement;
  const imageDisplayWidthValue = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_DISPLAY_WIDTH_VALUE
  ) as HTMLSpanElement;
  if (imageDisplayWidthInput) {
    imageDisplayWidthInput.value = settings.imageDisplayWidth.toString();
  }
  if (imageDisplayWidthValue) {
    imageDisplayWidthValue.textContent = `${settings.imageDisplayWidth}%`;
  }

  // Update prompt generation mode radio buttons
  if (promptGenModeRegexRadio && promptGenModeLLMRadio) {
    // Support both new names and legacy aliases
    const isIndependent =
      settings.promptGenerationMode === 'independent-api' ||
      settings.promptGenerationMode === 'llm-post';
    if (isIndependent) {
      promptGenModeLLMRadio.checked = true;
      promptGenModeRegexRadio.checked = false;
    } else {
      // Default to shared-api mode for any other value (including 'shared-api', 'regex', and invalid values)
      promptGenModeRegexRadio.checked = true;
      promptGenModeLLMRadio.checked = false;
    }
  }

  // Toggle independent API settings visibility based on current mode
  toggleIndependentApiSettingsVisibility();

  // Update max prompts per message
  if (maxPromptsPerMessageInput) {
    maxPromptsPerMessageInput.value = settings.maxPromptsPerMessage.toString();
  }

  // Update context message count
  if (contextMessageCountInput) {
    contextMessageCountInput.value = settings.contextMessageCount.toString();
  }

  // Update meta prompt depth
  if (metaPromptDepthInput) {
    metaPromptDepthInput.value = settings.metaPromptDepth.toString();
  }
  if (standalonePromptCountInput) {
    standalonePromptCountInput.value = (
      settings.standalonePromptCount ?? STANDALONE_PROMPT_COUNT.DEFAULT
    ).toString();
  }

  // Update LLM guidelines textareas
  const llmFrequencyGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const llmPromptWritingGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;

  if (llmFrequencyGuidelinesTextarea) {
    llmFrequencyGuidelinesTextarea.value = settings.llmFrequencyGuidelines;
  }

  if (llmPromptWritingGuidelinesTextarea) {
    llmPromptWritingGuidelinesTextarea.value =
      settings.llmPromptWritingGuidelines;
  }

  // Update independent LLM API settings
  const useIndependentLlmApiCheckbox = document.getElementById(
    UI_ELEMENT_IDS.USE_INDEPENDENT_LLM_API
  ) as HTMLInputElement;
  const independentLlmApiUrlInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
  ) as HTMLInputElement;
  const independentLlmApiKeyInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
  ) as HTMLInputElement;
  const independentLlmModelInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
  ) as HTMLInputElement;
  const independentLlmModelSelect = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL_SELECT
  ) as HTMLSelectElement;

  if (useIndependentLlmApiCheckbox) {
    useIndependentLlmApiCheckbox.checked =
      settings.useIndependentLlmApi ?? false;
  }
  if (independentLlmApiUrlInput) {
    independentLlmApiUrlInput.value = settings.independentLlmApiUrl ?? '';
  }
  if (independentLlmApiKeyInput) {
    independentLlmApiKeyInput.value = settings.independentLlmApiKey ?? '';
  }
  if (independentLlmModelInput) {
    independentLlmModelInput.value = settings.independentLlmModel ?? '';
  }
  if (independentLlmModelSelect) {
    // If there's a saved model, show it as the selected option
    const savedModel = settings.independentLlmModel ?? '';
    if (savedModel && independentLlmModelSelect.options.length <= 1) {
      const opt = document.createElement('option');
      opt.value = savedModel;
      opt.textContent = `${savedModel} (saved)`;
      independentLlmModelSelect.appendChild(opt);
    }
    independentLlmModelSelect.value = savedModel;
  }

  const independentLlmMaxTokensInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MAX_TOKENS
  ) as HTMLInputElement;
  if (independentLlmMaxTokensInput) {
    independentLlmMaxTokensInput.value = String(
      settings.independentLlmMaxTokens ?? 4096
    );
  }

  // Update context injection checkboxes
  const injectCharDescCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_CHARACTER_DESCRIPTION
  ) as HTMLInputElement;
  const injectUserPersonaCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_USER_PERSONA
  ) as HTMLInputElement;
  const injectScenarioCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_SCENARIO
  ) as HTMLInputElement;
  if (injectCharDescCheckbox) {
    injectCharDescCheckbox.checked =
      settings.injectCharacterDescription ?? true;
  }
  if (injectUserPersonaCheckbox) {
    injectUserPersonaCheckbox.checked = settings.injectUserPersona ?? true;
  }
  if (injectScenarioCheckbox) {
    injectScenarioCheckbox.checked = settings.injectScenario ?? true;
  }

  // Update world info injection checkbox
  const injectWorldInfoCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_WORLD_INFO
  ) as HTMLInputElement;
  if (injectWorldInfoCheckbox) {
    injectWorldInfoCheckbox.checked = settings.injectWorldInfo ?? false;
  }
  toggleWorldInfoPanelVisibility(settings.injectWorldInfo ?? false);

  // Update content filter tags
  const contentFilterTagsTextarea = document.getElementById(
    UI_ELEMENT_IDS.CONTENT_FILTER_TAGS
  ) as HTMLTextAreaElement;
  if (contentFilterTagsTextarea) {
    contentFilterTagsTextarea.value = (
      settings.contentFilterTags ?? DEFAULT_CONTENT_FILTER_TAGS
    ).join('\n');
  }

  // Update image subfolder label from chat metadata
  const imageSubfolderLabelInput = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_SUBFOLDER_LABEL
  ) as HTMLInputElement;
  if (imageSubfolderLabelInput) {
    try {
      const metadata = getMetadata();
      imageSubfolderLabelInput.value = metadata.imageSubfolderLabel ?? '';
      setImageSubfolderLabel(metadata.imageSubfolderLabel ?? null);
    } catch {
      // Metadata not ready (no chat loaded yet)
      imageSubfolderLabelInput.value = '';
      setImageSubfolderLabel(null);
    }
  }

  // Update preset dropdown with custom presets
  if (presetSelect) {
    const customPresetsGroup = presetSelect.querySelector(
      '#custom_presets_group'
    );
    if (customPresetsGroup) {
      customPresetsGroup.innerHTML = '';
      settings.customPresets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        customPresetsGroup.appendChild(option);
      });
    }
    presetSelect.value = settings.currentPresetId;
  }

  // Update delete button state based on preset type
  if (presetDeleteButton) {
    const isPredefined = isPresetPredefined(settings.currentPresetId);
    presetDeleteButton.disabled = isPredefined;
    presetDeleteButton.title = isPredefined
      ? 'Cannot delete predefined presets'
      : 'Delete custom preset';
  }

  // Update preview area with current preset content
  if (presetPreview) {
    presetPreview.textContent = settings.metaPrompt;
  }

  // Update textarea (used in edit mode)
  if (metaPromptTextarea) {
    metaPromptTextarea.value = settings.metaPrompt;
  }

  // Ensure editor is hidden and viewer is shown (not in edit mode)
  if (presetEditor) presetEditor.style.display = 'none';
  if (presetViewer) presetViewer.style.display = 'block';
  isEditingPreset = false;

  // Update independent LLM preset dropdown
  const ilmPresetSelect = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SELECT
  ) as HTMLSelectElement;
  const ilmPresetDeleteButton = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_DELETE
  ) as HTMLButtonElement;
  const ilmPresetEditor = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_EDITOR
  ) as HTMLDivElement;

  if (ilmPresetSelect) {
    const customGroup = ilmPresetSelect.querySelector(
      '#custom_independent_llm_presets_group'
    );
    if (customGroup) {
      customGroup.innerHTML = '';
      (settings.customIndependentLlmPresets || []).forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        customGroup.appendChild(option);
      });
    }
    ilmPresetSelect.value = settings.currentIndependentLlmPresetId;
  }

  if (ilmPresetDeleteButton) {
    const isPredefined = isIndependentLlmPresetPredefined(
      settings.currentIndependentLlmPresetId
    );
    ilmPresetDeleteButton.disabled = isPredefined;
    ilmPresetDeleteButton.title = isPredefined
      ? t('toast.cannotDeletePredefinedIndependentLlm')
      : t('settings.deletePreset');
  }

  if (ilmPresetEditor) ilmPresetEditor.style.display = 'none';
  isEditingIndependentLlmPreset = false;

  // Update API profile dropdown
  populateApiProfileDropdown();

  // Update validation status
  updateValidationStatus();
}

/**
 * Validates whether the current prompt detection patterns can find prompts in the meta prompt
 * @returns True if patterns can detect prompts, false otherwise
 */
function validatePromptPatterns(): boolean {
  const metaPrompt = settings.metaPrompt;
  const patterns = settings.promptDetectionPatterns;

  if (!metaPrompt || !patterns || patterns.length === 0) {
    return false;
  }

  try {
    const matches = extractImagePromptsMultiPattern(metaPrompt, patterns);
    return matches.length > 0;
  } catch (error) {
    logger.warn('Error validating prompt patterns:', error);
    return false;
  }
}

/**
 * Updates the validation status UI element
 */
function updateValidationStatus(): void {
  const validationElement = document.getElementById(
    UI_ELEMENT_IDS.PATTERN_VALIDATION_STATUS
  );
  if (!validationElement) return;

  const isValid = validatePromptPatterns();

  // Clear existing classes
  validationElement.className = 'pattern-validation-status';

  if (isValid) {
    validationElement.classList.add('validation-success');
    validationElement.innerHTML = `
      <span class="validation-message">${t('settings.validationSuccess')}</span>
    `;
  } else {
    validationElement.classList.add('validation-warning');
    validationElement.innerHTML = `
      <span class="validation-message">${t('settings.validationWarning')}</span>
      <span class="validation-hint">${t('settings.validationHint')}</span>
    `;
  }
}

/**
 * Clamps a value to the specified range and rounds to nearest step
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @param step - Step size for rounding
 * @returns Clamped and rounded value
 */
function clampValue(
  value: number,
  min: number,
  max: number,
  step: number
): number {
  // Round to nearest step
  const rounded = Math.round(value / step) * step;
  // Clamp to min/max
  return Math.max(min, Math.min(max, rounded));
}

/**
 * Applies the current image display width setting to all AI-generated images in chat
 * This allows retroactive width changes to already-generated images by updating the message HTML
 */
export function applyImageWidthToAllImages(): void {
  let updatedCount = 0;

  // Update the HTML in each message that contains auto-illustrator images
  context.chat?.forEach((message, messageId) => {
    if (!message.mes || !message.mes.includes('auto-illustrator-img')) {
      return;
    }

    const imagesInThisMessage = (
      message.mes.match(/class="[^"]*auto-illustrator-img[^"]*"/g) || []
    ).length;

    // Update all img tags with auto-illustrator-img class in this message
    const updatedMes = message.mes.replace(
      /<img\s+([^>]*class="[^"]*auto-illustrator-img[^"]*"[^>]*)>/g,
      (_match: string, attributes: string) => {
        // Skip failed placeholders - they should stay at 10% width
        if (attributes.includes('data-failed-placeholder="true"')) {
          return `<img ${attributes}>`;
        }

        updatedCount++;
        // Replace only the width value, keeping everything else untouched
        const updatedAttributes = attributes.replace(
          /style="([^"]*)"/,
          (_styleMatch: string, styleContent: string) => {
            // Update or add width in the style
            let newStyle = styleContent;
            if (newStyle.includes('width:')) {
              // Replace existing width
              newStyle = newStyle.replace(
                /width:\s*[^;]+;?/,
                `width: ${settings.imageDisplayWidth}%;`
              );
            } else {
              // Add width at the beginning
              newStyle = `width: ${settings.imageDisplayWidth}%; ${newStyle}`;
            }
            return `style="${newStyle}"`;
          }
        );
        return `<img ${updatedAttributes}>`;
      }
    );

    if (updatedMes !== message.mes) {
      message.mes = updatedMes;
      logger.debug(
        `[DEBUG] Updated HTML for message ${messageId} with ${imagesInThisMessage} images`
      );
    }
  });

  logger.info(
    `[DEBUG] Applied width ${settings.imageDisplayWidth}% to ${updatedCount} images in message HTML`
  );

  if (updatedCount === 0) {
    logger.warn('[DEBUG] No images found to apply width to');
  }
}

/**
 * Handles changes to settings from UI
 */
function handleSettingsChange(): void {
  const previousMetaPrompt = settings.metaPrompt;
  const previousPromptPatterns = settings.promptDetectionPatterns.join('\n');
  const enabledCheckbox = document.getElementById(
    UI_ELEMENT_IDS.ENABLED
  ) as HTMLInputElement;
  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;
  const streamingPollIntervalInput = document.getElementById(
    UI_ELEMENT_IDS.STREAMING_POLL_INTERVAL
  ) as HTMLInputElement;
  const maxConcurrentInput = document.getElementById(
    UI_ELEMENT_IDS.MAX_CONCURRENT
  ) as HTMLInputElement;
  const minGenerationIntervalInput = document.getElementById(
    UI_ELEMENT_IDS.MIN_GENERATION_INTERVAL
  ) as HTMLInputElement;
  const logLevelSelect = document.getElementById(
    UI_ELEMENT_IDS.LOG_LEVEL
  ) as HTMLSelectElement;
  const promptPatternsTextarea = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_PATTERNS
  ) as HTMLTextAreaElement;
  const commonStyleTagsTextarea = document.getElementById(
    UI_ELEMENT_IDS.COMMON_STYLE_TAGS
  ) as HTMLTextAreaElement;
  const commonStyleTagsPositionSelect = document.getElementById(
    UI_ELEMENT_IDS.COMMON_STYLE_TAGS_POSITION
  ) as HTMLSelectElement;
  const manualGenModeSelect = document.getElementById(
    UI_ELEMENT_IDS.MANUAL_GEN_MODE
  ) as HTMLSelectElement;
  const showGalleryWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_GALLERY_WIDGET
  ) as HTMLInputElement;
  const showProgressWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_PROGRESS_WIDGET
  ) as HTMLInputElement;
  const showStreamingPreviewWidgetCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_STREAMING_PREVIEW_WIDGET
  ) as HTMLInputElement;
  const showFloatingPanelLauncherCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_FLOATING_PANEL_LAUNCHER
  ) as HTMLInputElement;
  const promptGenModeRegexRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_SHARED
  ) as HTMLInputElement;
  const promptGenModeLLMRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_INDEPENDENT
  ) as HTMLInputElement;
  const maxPromptsPerMessageInput = document.getElementById(
    UI_ELEMENT_IDS.MAX_PROMPTS_PER_MESSAGE
  ) as HTMLInputElement;
  const contextMessageCountInput = document.getElementById(
    UI_ELEMENT_IDS.CONTEXT_MESSAGE_COUNT
  ) as HTMLInputElement;
  const metaPromptDepthInput = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_DEPTH
  ) as HTMLInputElement;
  const standalonePromptCountInput = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_PROMPT_COUNT
  ) as HTMLInputElement;
  const llmFrequencyGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const llmPromptWritingGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;
  const imageDisplayWidthInput = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_DISPLAY_WIDTH
  ) as HTMLInputElement;
  const imageDisplayWidthValue = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_DISPLAY_WIDTH_VALUE
  ) as HTMLSpanElement;
  // Image retention days
  const imageRetentionDaysInput = document.getElementById(
    UI_ELEMENT_IDS.IMAGE_RETENTION_DAYS
  ) as HTMLInputElement;
  if (imageRetentionDaysInput) {
    const originalValue = parseInt(imageRetentionDaysInput.value, 10);
    const clampedValue = clampValue(
      originalValue,
      IMAGE_RETENTION_DAYS.MIN,
      IMAGE_RETENTION_DAYS.MAX,
      IMAGE_RETENTION_DAYS.STEP
    );
    settings.imageRetentionDays = clampedValue;
    imageRetentionDaysInput.value = clampedValue.toString();

    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: IMAGE_RETENTION_DAYS.MIN,
          max: IMAGE_RETENTION_DAYS.MAX,
        }),
        t('extensionName')
      );
    }
  }

  // Independent LLM API settings
  const useIndependentLlmApiCheckbox = document.getElementById(
    UI_ELEMENT_IDS.USE_INDEPENDENT_LLM_API
  ) as HTMLInputElement;
  const independentLlmApiUrlInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
  ) as HTMLInputElement;
  const independentLlmApiKeyInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
  ) as HTMLInputElement;
  const independentLlmModelInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
  ) as HTMLInputElement;

  settings.useIndependentLlmApi =
    useIndependentLlmApiCheckbox?.checked ?? settings.useIndependentLlmApi;
  settings.independentLlmApiUrl =
    independentLlmApiUrlInput?.value ?? settings.independentLlmApiUrl;
  settings.independentLlmApiKey =
    independentLlmApiKeyInput?.value ?? settings.independentLlmApiKey;
  settings.independentLlmModel =
    independentLlmModelInput?.value ?? settings.independentLlmModel;

  const independentLlmMaxTokensInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MAX_TOKENS
  ) as HTMLInputElement;
  if (independentLlmMaxTokensInput) {
    const originalValue = parseInt(independentLlmMaxTokensInput.value, 10);
    const clampedValue = clampValue(
      originalValue,
      INDEPENDENT_LLM_MAX_TOKENS.MIN,
      INDEPENDENT_LLM_MAX_TOKENS.MAX,
      INDEPENDENT_LLM_MAX_TOKENS.STEP
    );
    settings.independentLlmMaxTokens = clampedValue;
    independentLlmMaxTokensInput.value = clampedValue.toString();

    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: INDEPENDENT_LLM_MAX_TOKENS.MIN,
          max: INDEPENDENT_LLM_MAX_TOKENS.MAX,
        }),
        t('extensionName')
      );
    }
  }

  // Context injection checkboxes
  const injectCharDescCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_CHARACTER_DESCRIPTION
  ) as HTMLInputElement;
  const injectUserPersonaCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_USER_PERSONA
  ) as HTMLInputElement;
  const injectScenarioCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_SCENARIO
  ) as HTMLInputElement;
  settings.injectCharacterDescription =
    injectCharDescCheckbox?.checked ?? settings.injectCharacterDescription;
  settings.injectUserPersona =
    injectUserPersonaCheckbox?.checked ?? settings.injectUserPersona;
  settings.injectScenario =
    injectScenarioCheckbox?.checked ?? settings.injectScenario;

  // World info injection
  const injectWorldInfoCheckbox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_WORLD_INFO
  ) as HTMLInputElement;
  settings.injectWorldInfo =
    injectWorldInfoCheckbox?.checked ?? settings.injectWorldInfo;
  toggleWorldInfoPanelVisibility(settings.injectWorldInfo);

  // Content filter tags
  const contentFilterTagsTextarea = document.getElementById(
    UI_ELEMENT_IDS.CONTENT_FILTER_TAGS
  ) as HTMLTextAreaElement;
  if (contentFilterTagsTextarea) {
    settings.contentFilterTags = contentFilterTagsTextarea.value
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }

  // Track if enabled state or widget visibility changed (requires page reload)
  const wasEnabled = settings.enabled;
  const wasShowGalleryWidget = settings.showGalleryWidget;
  const wasShowProgressWidget = settings.showProgressWidget;
  const wasShowStreamingPreviewWidget = settings.showStreamingPreviewWidget;
  settings.enabled = enabledCheckbox?.checked ?? settings.enabled;
  settings.metaPrompt = metaPromptTextarea?.value ?? settings.metaPrompt;

  // Validate and clamp numeric settings
  if (streamingPollIntervalInput) {
    const originalValue = parseInt(streamingPollIntervalInput.value);
    const clampedValue = clampValue(
      originalValue,
      STREAMING_POLL_INTERVAL.MIN,
      STREAMING_POLL_INTERVAL.MAX,
      STREAMING_POLL_INTERVAL.STEP
    );
    settings.streamingPollInterval = clampedValue;
    // Update UI to show validated value
    streamingPollIntervalInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjusted', {
          original: originalValue,
          clamped: clampedValue,
          min: STREAMING_POLL_INTERVAL.MIN,
          max: STREAMING_POLL_INTERVAL.MAX,
          step: STREAMING_POLL_INTERVAL.STEP,
        }),
        t('extensionName')
      );
    }
  }

  if (maxConcurrentInput) {
    const originalValue = parseInt(maxConcurrentInput.value);
    const clampedValue = clampValue(
      originalValue,
      MAX_CONCURRENT_GENERATIONS.MIN,
      MAX_CONCURRENT_GENERATIONS.MAX,
      MAX_CONCURRENT_GENERATIONS.STEP
    );
    settings.maxConcurrentGenerations = clampedValue;
    // Update UI to show validated value
    maxConcurrentInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: MAX_CONCURRENT_GENERATIONS.MIN,
          max: MAX_CONCURRENT_GENERATIONS.MAX,
        }),
        t('extensionName')
      );
    }
  }

  if (minGenerationIntervalInput) {
    const originalValue = parseInt(minGenerationIntervalInput.value);
    const clampedValue = clampValue(
      originalValue,
      MIN_GENERATION_INTERVAL.MIN,
      MIN_GENERATION_INTERVAL.MAX,
      MIN_GENERATION_INTERVAL.STEP
    );
    settings.minGenerationInterval = clampedValue;
    // Update UI to show validated value
    minGenerationIntervalInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjusted', {
          original: originalValue,
          clamped: clampedValue,
          min: MIN_GENERATION_INTERVAL.MIN,
          max: MIN_GENERATION_INTERVAL.MAX,
          step: MIN_GENERATION_INTERVAL.STEP,
        }),
        t('extensionName')
      );
    }
  }
  settings.logLevel =
    (logLevelSelect?.value as AutoIllustratorSettings['logLevel']) ??
    settings.logLevel;
  settings.promptDetectionPatterns = promptPatternsTextarea
    ? promptPatternsTextarea.value
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0)
    : settings.promptDetectionPatterns;
  settings.commonStyleTags =
    commonStyleTagsTextarea?.value ?? settings.commonStyleTags;
  settings.commonStyleTagsPosition =
    (commonStyleTagsPositionSelect?.value as 'prefix' | 'suffix') ??
    settings.commonStyleTagsPosition;
  settings.manualGenerationMode =
    (manualGenModeSelect?.value as 'replace' | 'append') ??
    settings.manualGenerationMode;

  // Prompt generation mode (radio buttons)
  if (promptGenModeRegexRadio?.checked) {
    settings.promptGenerationMode = 'shared-api';
  } else if (promptGenModeLLMRadio?.checked) {
    settings.promptGenerationMode = 'independent-api';
  } else {
    // Fallback to default if neither is checked (shouldn't happen, but be defensive)
    settings.promptGenerationMode = PROMPT_GENERATION_MODE.DEFAULT;
  }

  // Max prompts per message with validation
  if (maxPromptsPerMessageInput) {
    const originalValue = parseInt(maxPromptsPerMessageInput.value);
    const clampedValue = clampValue(
      originalValue,
      MAX_PROMPTS_PER_MESSAGE.MIN,
      MAX_PROMPTS_PER_MESSAGE.MAX,
      MAX_PROMPTS_PER_MESSAGE.STEP
    );
    settings.maxPromptsPerMessage = clampedValue;
    // Update UI to show validated value
    maxPromptsPerMessageInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: MAX_PROMPTS_PER_MESSAGE.MIN,
          max: MAX_PROMPTS_PER_MESSAGE.MAX,
        }),
        t('extensionName')
      );
    }
  }

  // Context message count with validation
  if (contextMessageCountInput) {
    const originalValue = parseInt(contextMessageCountInput.value);
    const clampedValue = clampValue(
      originalValue,
      CONTEXT_MESSAGE_COUNT.MIN,
      CONTEXT_MESSAGE_COUNT.MAX,
      CONTEXT_MESSAGE_COUNT.STEP
    );
    settings.contextMessageCount = clampedValue;
    // Update UI to show validated value
    contextMessageCountInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: CONTEXT_MESSAGE_COUNT.MIN,
          max: CONTEXT_MESSAGE_COUNT.MAX,
        }),
        t('extensionName')
      );
    }
  }

  // Meta prompt depth with validation
  if (metaPromptDepthInput) {
    const originalValue = parseInt(metaPromptDepthInput.value);
    const clampedValue = clampValue(
      originalValue,
      META_PROMPT_DEPTH.MIN,
      META_PROMPT_DEPTH.MAX,
      META_PROMPT_DEPTH.STEP
    );
    settings.metaPromptDepth = clampedValue;
    logger.debug(`Meta prompt depth updated: ${clampedValue}`);
    // Update UI to show validated value
    metaPromptDepthInput.value = clampedValue.toString();

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: META_PROMPT_DEPTH.MIN,
          max: META_PROMPT_DEPTH.MAX,
        }),
        t('extensionName')
      );
    }
  }

  if (standalonePromptCountInput) {
    const originalValue = parseInt(standalonePromptCountInput.value);
    const clampedValue = clampValue(
      originalValue,
      STANDALONE_PROMPT_COUNT.MIN,
      STANDALONE_PROMPT_COUNT.MAX,
      STANDALONE_PROMPT_COUNT.STEP
    );
    settings.standalonePromptCount = clampedValue;
    standalonePromptCountInput.value = clampedValue.toString();

    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjustedNoStep', {
          original: originalValue,
          clamped: clampedValue,
          min: STANDALONE_PROMPT_COUNT.MIN,
          max: STANDALONE_PROMPT_COUNT.MAX,
        }),
        t('extensionName')
      );
    }
  }

  // LLM guidelines (textareas)
  settings.llmFrequencyGuidelines =
    llmFrequencyGuidelinesTextarea?.value ?? settings.llmFrequencyGuidelines;
  settings.llmPromptWritingGuidelines =
    llmPromptWritingGuidelinesTextarea?.value ??
    settings.llmPromptWritingGuidelines;

  settings.showGalleryWidget =
    showGalleryWidgetCheckbox?.checked ?? settings.showGalleryWidget;
  settings.showProgressWidget =
    showProgressWidgetCheckbox?.checked ?? settings.showProgressWidget;
  settings.showStreamingPreviewWidget =
    showStreamingPreviewWidgetCheckbox?.checked ??
    settings.showStreamingPreviewWidget;
  settings.showFloatingPanelLauncher =
    showFloatingPanelLauncherCheckbox?.checked ??
    settings.showFloatingPanelLauncher;

  // Image display width with validation
  if (imageDisplayWidthInput) {
    const originalValue = parseInt(imageDisplayWidthInput.value);
    const clampedValue = clampValue(
      originalValue,
      IMAGE_DISPLAY_WIDTH.MIN,
      IMAGE_DISPLAY_WIDTH.MAX,
      IMAGE_DISPLAY_WIDTH.STEP
    );

    // Check if value actually changed from previous setting
    const valueChanged =
      previousImageDisplayWidth === null ||
      clampedValue !== previousImageDisplayWidth;

    settings.imageDisplayWidth = clampedValue;
    // Update UI to show validated value
    imageDisplayWidthInput.value = clampedValue.toString();
    if (imageDisplayWidthValue) {
      imageDisplayWidthValue.textContent = `${clampedValue}%`;
    }

    // Only apply expensive operations if the value actually changed
    if (valueChanged) {
      logger.debug(
        `Image width changed from ${previousImageDisplayWidth ?? 'initial'} to ${clampedValue}`
      );

      // Debounce the expensive operations (HTML update + re-render)
      // Clear any pending update
      if (imageWidthUpdateTimer) {
        clearTimeout(imageWidthUpdateTimer);
      }

      // Schedule the update to run after user stops sliding (1s delay)
      imageWidthUpdateTimer = setTimeout(async () => {
        // Apply width to all existing images (updates HTML)
        logger.debug(
          `[DEBUG] Applying width ${settings.imageDisplayWidth}% to all images`
        );
        applyImageWidthToAllImages();

        // Save chat to persist the updated HTML BEFORE reloading
        // This ensures the reload will load the updated HTML with new width
        if (typeof context.saveChat === 'function') {
          try {
            logger.debug(
              '[DEBUG] Saving chat with updated image width before reload'
            );
            await context.saveChat();
            logger.debug('[DEBUG] Chat saved successfully');
          } catch (error) {
            logger.error(
              'Failed to save chat after image width update:',
              error
            );
            return; // Don't reload if save failed
          }
        }

        // Reload the current chat to apply width changes
        // This triggers the full chat reload flow including CHAT_CHANGED event
        // which properly handles DOM rendering and event listener attachment
        logger.debug('[DEBUG] Reloading current chat to apply width changes');
        context.reloadCurrentChat();

        // Update tracked value after successful application
        previousImageDisplayWidth = settings.imageDisplayWidth;
        imageWidthUpdateTimer = null;
      }, 1000);
    }

    // Show toast if value was clamped
    if (clampedValue !== originalValue) {
      toastr.warning(
        t('toast.valueAdjusted', {
          original: originalValue,
          clamped: clampedValue,
          min: IMAGE_DISPLAY_WIDTH.MIN,
          max: IMAGE_DISPLAY_WIDTH.MAX,
          step: IMAGE_DISPLAY_WIDTH.STEP,
        }),
        t('extensionName')
      );
    }
  }

  // Apply log level
  setLogLevel(settings.logLevel);

  // Update concurrency limiter settings
  updateMaxConcurrent(settings.maxConcurrentGenerations);
  updateMinInterval(settings.minGenerationInterval);
  setFloatingPanelLauncherVisible(settings.showFloatingPanelLauncher);

  saveSettings(settings, context);

  if (
    previousMetaPrompt !== settings.metaPrompt ||
    previousPromptPatterns !== settings.promptDetectionPatterns.join('\n')
  ) {
    updateValidationStatus();
  }

  // ===== 处理 enabled 开关的立即生效 =====
  if (wasEnabled !== settings.enabled) {
    if (settings.enabled) {
      // ===== 启用扩展 =====
      logger.info('扩展已启用 - 正在注册事件处理器');

      // 注册事件处理器
      if (!eventHandlersRegistered) {
        registerEventHandlers();
      }

      // 初始化必要的组件
      if (settings.showProgressWidget) {
        initializeProgressWidget(progressManager);
        logger.info('已初始化进度 Widget');
      }

      if (settings.showGalleryWidget) {
        initializeGalleryWidget(progressManager);
        const gallery = getGalleryWidget();
        if (gallery) gallery.show();
        logger.info('已初始化图库 Widget');
      }

      if (settings.showStreamingPreviewWidget && !streamingPreviewWidget) {
        streamingPreviewWidget = new StreamingPreviewWidget(
          progressManager,
          settings.promptDetectionPatterns || DEFAULT_PROMPT_DETECTION_PATTERNS
        );
        logger.info('已初始化流式预览 Widget');
      }

      // 使用 toastr 显示成功提示 (去掉 positionClass)
      toastr.success('扩展已启用', t('extensionName'), {
        timeOut: 2000,
      });
    } else {
      // ===== 禁用扩展 =====
      logger.info('扩展已禁用 - 正在注销事件处理器');

      // 注销事件处理器
      unregisterEventHandlers();

      // 清理组件
      clearProgressWidgetState();

      // 清理 streamingPreviewWidget (不调用 hide,直接设为 null)
      if (streamingPreviewWidget) {
        streamingPreviewWidget.destroy();
        streamingPreviewWidget = null;
      }

      const gallery = getGalleryWidget();
      if (gallery) gallery.hide();

      // 使用 toastr 显示提示 (去掉 positionClass)
      toastr.info('扩展已禁用', t('extensionName'), {
        timeOut: 2000,
      });
    }
  }

  // Widget 可见性变化仍需刷新页面
  if (
    wasShowGalleryWidget !== settings.showGalleryWidget ||
    wasShowProgressWidget !== settings.showProgressWidget ||
    wasShowStreamingPreviewWidget !== settings.showStreamingPreviewWidget
  ) {
    toastr.info(t('toast.reloadRequired'), t('extensionName'), {
      timeOut: 5000,
    });

    if (wasShowGalleryWidget !== settings.showGalleryWidget) {
      logger.info(
        `图库 Widget ${settings.showGalleryWidget ? '已启用' : '已禁用'} - 需要重载`
      );
    }
    if (wasShowProgressWidget !== settings.showProgressWidget) {
      logger.info(
        `进度 Widget ${settings.showProgressWidget ? '已启用' : '已禁用'} - 需要重载`
      );
    }
    if (wasShowStreamingPreviewWidget !== settings.showStreamingPreviewWidget) {
      logger.info(
        `流式预览 Widget ${settings.showStreamingPreviewWidget ? '已启用' : '已禁用'} - 需要重载`
      );
    }
  }

  logger.info('设置已更新:', settings);
}

/**
 * Resets settings to defaults
 */
function handleResetSettings(): void {
  if (
    typeof confirm === 'function' &&
    !confirm(t('prompt.resetSettingsConfirm'))
  ) {
    return;
  }

  const previousSettings = settings;
  const defaults = getDefaultSettings();
  settings = {
    ...defaults,
    customPresets: [...(previousSettings.customPresets || [])],
    customIndependentLlmPresets: [
      ...(previousSettings.customIndependentLlmPresets || []),
    ],
    apiProfiles: [...(previousSettings.apiProfiles || [])],
  };
  saveSettings(settings, context);
  updateUI();

  setLogLevel(settings.logLevel);
  updateMaxConcurrent(settings.maxConcurrentGenerations);
  updateMinInterval(settings.minGenerationInterval);
  setFloatingPanelLauncherVisible(settings.showFloatingPanelLauncher);

  if (previousSettings.enabled !== settings.enabled) {
    if (settings.enabled) {
      if (!eventHandlersRegistered) {
        registerEventHandlers();
      }

      if (settings.showProgressWidget) {
        initializeProgressWidget(progressManager);
      }

      if (settings.showGalleryWidget) {
        initializeGalleryWidget(progressManager);
        getGalleryWidget()?.show();
      }

      if (settings.showStreamingPreviewWidget && !streamingPreviewWidget) {
        streamingPreviewWidget = new StreamingPreviewWidget(
          progressManager,
          settings.promptDetectionPatterns || DEFAULT_PROMPT_DETECTION_PATTERNS
        );
      }
    } else {
      unregisterEventHandlers();
      clearProgressWidgetState();
      if (streamingPreviewWidget) {
        streamingPreviewWidget.destroy();
        streamingPreviewWidget = null;
      }
      getGalleryWidget()?.hide();
    }
  }

  if (
    previousSettings.showGalleryWidget !== settings.showGalleryWidget ||
    previousSettings.showProgressWidget !== settings.showProgressWidget ||
    previousSettings.showStreamingPreviewWidget !==
      settings.showStreamingPreviewWidget
  ) {
    toastr.info(t('toast.reloadRequired'), t('extensionName'), {
      timeOut: 5000,
    });
  }

  logger.info('Settings reset to defaults');
}

/**
 * Resets prompt patterns to defaults
 */
function handlePromptPatternsReset(): void {
  const promptPatternsTextarea = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_PATTERNS
  ) as HTMLTextAreaElement;

  if (promptPatternsTextarea) {
    promptPatternsTextarea.value = DEFAULT_PROMPT_DETECTION_PATTERNS.join('\n');
    // Trigger change event to save the settings
    handleSettingsChange();
  }

  logger.info('Prompt patterns reset to defaults');
}

/**
 * Handles LLM frequency guidelines reset to defaults
 */
function handleLLMFrequencyGuidelinesReset(): void {
  const llmFrequencyGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;

  if (llmFrequencyGuidelinesTextarea) {
    llmFrequencyGuidelinesTextarea.value = DEFAULT_LLM_FREQUENCY_GUIDELINES;
    // Trigger change event to save the settings
    handleSettingsChange();
    toastr.success('Frequency guidelines reset to default', t('extensionName'));
  }

  logger.info('LLM frequency guidelines reset to defaults');
}

/**
 * Handles LLM prompt writing guidelines reset to defaults
 */
function handleLLMPromptWritingGuidelinesReset(): void {
  const llmPromptWritingGuidelinesTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;

  if (llmPromptWritingGuidelinesTextarea) {
    llmPromptWritingGuidelinesTextarea.value =
      DEFAULT_LLM_PROMPT_WRITING_GUIDELINES;
    // Trigger change event to save the settings
    handleSettingsChange();
    toastr.success(
      'Prompt writing guidelines reset to default',
      t('extensionName')
    );
  }

  logger.info('LLM prompt writing guidelines reset to defaults');
}

/**
 * Tests the independent LLM API connection
 */
async function handleTestIndependentLlmConnection(): Promise<void> {
  const urlInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
  ) as HTMLInputElement;
  const keyInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
  ) as HTMLInputElement;
  const modelInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
  ) as HTMLInputElement;

  const apiUrl = urlInput?.value?.trim();
  const apiKey = keyInput?.value?.trim();
  const model = modelInput?.value?.trim();

  if (!apiUrl || !model) {
    toastr.error(t('toast.independentLlmApiMissingConfig'), t('extensionName'));
    return;
  }

  try {
    toastr.info(t('toast.testingConnection'), t('extensionName'));

    const {buildChatCompletionsUrl} = await import(
      './services/independent_llm'
    );
    const fullUrl = buildChatCompletionsUrl(apiUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        max_tokens: 10,
      }),
    });

    if (response.ok) {
      toastr.success(t('toast.connectionSuccess'), t('extensionName'));
      logger.info('Independent LLM API connection test successful');
    } else {
      const errorText = await response.text();
      toastr.error(
        t('toast.connectionFailed', {
          error: `${response.status}: ${errorText}`,
        }),
        t('extensionName')
      );
      logger.error('Independent LLM API connection test failed:', errorText);
    }
  } catch (error) {
    toastr.error(
      t('toast.connectionFailed', {error: String(error)}),
      t('extensionName')
    );
    logger.error('Independent LLM API connection test error:', error);
  }
}

/**
 * Shows a read-only modal with the last independent LLM request snapshot.
 */
function handleViewLastRequest(): void {
  const {getLastRequestSnapshot} = require('./services/independent_llm');
  const snapshot = getLastRequestSnapshot();

  if (!snapshot) {
    toastr.info(t('toast.noRequestSnapshot'), t('extensionName'));
    return;
  }

  // Build formatted content
  const timestamp = new Date(snapshot.timestamp).toLocaleString();
  const messagesFormatted = snapshot.messages
    .map(
      (m: {role: string; content: string}) =>
        `--- ${m.role.toUpperCase()} ---\n${m.content}`
    )
    .join('\n\n');

  const content = [
    `URL: ${snapshot.url}`,
    `Model: ${snapshot.model}`,
    `Max Tokens: ${snapshot.maxTokens}`,
    `Temperature: ${snapshot.temperature}`,
    `Authorization: ${snapshot.hasAuthorization ? 'Bearer ****' : '(none)'}`,
    `Time: ${timestamp}`,
    '',
    '=== Messages ===',
    messagesFormatted,
  ].join('\n');

  // Create backdrop
  const backdrop = $('<div>').addClass('auto-illustrator-dialog-backdrop');
  const dialog = $('<div>')
    .attr('id', 'auto_illustrator_last_request_dialog')
    .addClass('auto-illustrator-dialog')
    .css({maxWidth: '700px', maxHeight: '80vh'});

  dialog.append($('<h3>').text(t('dialog.lastRequestTitle')));

  const pre = $('<pre>')
    .css({
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      maxHeight: '60vh',
      overflow: 'auto',
      fontSize: '0.85em',
      background: 'var(--SmartThemeBotMesBlurTintColor, #1a1a2e)',
      padding: '0.75rem',
      borderRadius: '6px',
    })
    .text(content);
  dialog.append(pre);

  const buttons = $('<div>').addClass('auto-illustrator-dialog-buttons');
  const closeBtn = $('<button>')
    .text(t('dialog.cancel'))
    .addClass('menu_button')
    .on('click', () => {
      backdrop.remove();
      dialog.remove();
    });
  buttons.append(closeBtn);
  dialog.append(buttons);

  backdrop.on('click', () => {
    backdrop.remove();
    dialog.remove();
  });

  $('body').append(backdrop).append(dialog);
}

/**
 * Fetches available models from the independent LLM API endpoint
 * and populates the model select dropdown.
 */
async function handleFetchModels(): Promise<void> {
  const urlInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
  ) as HTMLInputElement;
  const keyInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
  ) as HTMLInputElement;
  const modelSelect = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL_SELECT
  ) as HTMLSelectElement;
  const modelInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
  ) as HTMLInputElement;

  const apiUrl = urlInput?.value?.trim();
  if (!apiUrl) {
    toastr.warning(t('toast.fetchModelsNeedUrl'), t('extensionName'));
    return;
  }

  const apiKey = keyInput?.value?.trim();

  try {
    toastr.info(t('toast.fetchingModels'), t('extensionName'));

    const {fetchAvailableModels} = await import('./services/independent_llm');
    const models = await fetchAvailableModels(apiUrl, apiKey || undefined);

    if (!modelSelect) return;

    // Clear existing options
    modelSelect.innerHTML = '';

    if (models.length === 0) {
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = t('toast.fetchModelsEmpty');
      modelSelect.appendChild(emptyOpt);
      toastr.warning(t('toast.fetchModelsEmpty'), t('extensionName'));
      return;
    }

    // Add placeholder
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('settings.independentLlmModelPlaceholder');
    placeholder.disabled = true;
    modelSelect.appendChild(placeholder);

    // Add fetched models
    for (const modelId of models) {
      const opt = document.createElement('option');
      opt.value = modelId;
      opt.textContent = modelId;
      modelSelect.appendChild(opt);
    }

    // If current model input matches one of the fetched models, select it
    const currentModel = modelInput?.value?.trim();
    if (currentModel) {
      const matchingOpt = modelSelect.querySelector(
        `option[value="${CSS.escape(currentModel)}"]`
      );
      if (matchingOpt) {
        modelSelect.value = currentModel;
      } else {
        modelSelect.selectedIndex = 0;
      }
    }

    toastr.success(
      t('toast.fetchModelsSuccess', {count: String(models.length)}),
      t('extensionName')
    );
    logger.info(`Fetched ${models.length} models from API`);
  } catch (error) {
    toastr.error(
      t('toast.fetchModelsFailed', {error: String(error)}),
      t('extensionName')
    );
    logger.error('Failed to fetch models:', error);
  }
}

/**
 * Toggles visibility of LLM-specific settings based on prompt generation mode
 */
function toggleIndependentApiSettingsVisibility(): void {
  const llmSettingsContainer = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_API_SETTINGS_CONTAINER
  );
  const promptGenModeLLMRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_INDEPENDENT
  ) as HTMLInputElement;

  if (llmSettingsContainer && promptGenModeLLMRadio) {
    llmSettingsContainer.style.display = promptGenModeLLMRadio.checked
      ? 'block'
      : 'none';
  }
}

/**
 * Handles preset selection change
 */
function handlePresetChange(): void {
  // Exit edit mode if active
  if (isEditingPreset) {
    handlePresetCancel();
  }

  const presetSelect = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_PRESET_SELECT
  ) as HTMLSelectElement;
  if (!presetSelect) return;

  const selectedId = presetSelect.value;
  const preset = getPresetById(selectedId, settings.customPresets);

  settings.currentPresetId = selectedId;
  settings.metaPrompt = preset.template;
  saveSettings(settings, context);
  updateUI();

  logger.info('Preset changed:', {id: selectedId, name: preset.name});
}

/**
 * Handles entering edit mode for current preset
 */
function handlePresetEdit(): void {
  const presetEditor = document.getElementById(
    UI_ELEMENT_IDS.PRESET_EDITOR
  ) as HTMLDivElement;
  const presetViewer = document.getElementById(
    UI_ELEMENT_IDS.PRESET_VIEWER
  ) as HTMLDivElement;
  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;
  const presetSaveButton = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT_PRESET_SAVE
  ) as HTMLButtonElement;

  if (!presetEditor || !presetViewer || !metaPromptTextarea) return;

  // Show editor, hide viewer
  presetViewer.style.display = 'none';
  presetEditor.style.display = 'block';

  // Make textarea editable and populate with current content
  metaPromptTextarea.removeAttribute('readonly');
  metaPromptTextarea.value = settings.metaPrompt;

  // Update save button state (disabled for predefined presets)
  if (presetSaveButton) {
    const isPredefined = isPresetPredefined(settings.currentPresetId);
    presetSaveButton.disabled = isPredefined;
    presetSaveButton.title = isPredefined
      ? 'Cannot save changes to predefined presets (use Save As)'
      : 'Save changes to this preset';
  }

  isEditingPreset = true;
  logger.info('Entered preset edit mode');
}

/**
 * Handles saving changes to current custom preset
 */
function handlePresetSave(): void {
  if (isPresetPredefined(settings.currentPresetId)) {
    toastr.error(t('settings.cannotDeletePredefined'), t('extensionName'));
    return;
  }

  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;
  if (!metaPromptTextarea) return;

  const content = metaPromptTextarea.value;

  // Find and update the custom preset
  const presetIndex = settings.customPresets.findIndex(
    p => p.id === settings.currentPresetId
  );
  if (presetIndex === -1) {
    toastr.error(t('toast.presetNotFound'), t('extensionName'));
    return;
  }

  settings.customPresets[presetIndex].template = content;
  settings.metaPrompt = content;
  saveSettings(settings, context);

  // Exit edit mode
  const presetEditor = document.getElementById(
    UI_ELEMENT_IDS.PRESET_EDITOR
  ) as HTMLDivElement;
  const presetViewer = document.getElementById(
    UI_ELEMENT_IDS.PRESET_VIEWER
  ) as HTMLDivElement;
  if (presetEditor) presetEditor.style.display = 'none';
  if (presetViewer) presetViewer.style.display = 'block';
  isEditingPreset = false;

  updateUI();
  toastr.success(t('toast.presetSaved'), t('extensionName'));
  logger.info('Preset saved:', settings.customPresets[presetIndex].name);
}

/**
 * Handles saving current content as a new preset or overwriting existing
 */
function handlePresetSaveAs(): void {
  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;
  if (!metaPromptTextarea) return;

  const content = metaPromptTextarea.value;
  const name = prompt(t('prompt.enterPresetName'));

  if (!name || name.trim() === '') {
    return;
  }

  const trimmedName = name.trim();

  // Check if name is a predefined preset name
  if (isPredefinedPresetName(trimmedName)) {
    toastr.error(t('toast.cannotUsePredefinedNames'), t('extensionName'));
    return;
  }

  // Check if name already exists in custom presets
  const existingPreset = settings.customPresets.find(
    p => p.name === trimmedName
  );

  if (existingPreset) {
    const overwrite = confirm(t('prompt.overwritePreset', {name: trimmedName}));
    if (!overwrite) {
      return;
    }

    // Overwrite existing preset
    existingPreset.template = content;
    settings.currentPresetId = existingPreset.id;
    settings.metaPrompt = content;
  } else {
    // Create new preset
    const newPreset: MetaPromptPreset = {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      template: content,
      predefined: false,
    };

    settings.customPresets.push(newPreset);
    settings.currentPresetId = newPreset.id;
    settings.metaPrompt = content;
  }

  saveSettings(settings, context);

  // Exit edit mode
  const presetEditor = document.getElementById(
    UI_ELEMENT_IDS.PRESET_EDITOR
  ) as HTMLDivElement;
  const presetViewer = document.getElementById(
    UI_ELEMENT_IDS.PRESET_VIEWER
  ) as HTMLDivElement;
  if (presetEditor) presetEditor.style.display = 'none';
  if (presetViewer) presetViewer.style.display = 'block';
  isEditingPreset = false;

  updateUI();
  toastr.success(
    t('toast.presetSavedNamed', {name: trimmedName}),
    t('extensionName')
  );
  logger.info('Preset saved as:', trimmedName);
}

/**
 * Handles canceling preset edit
 */
function handlePresetCancel(): void {
  const presetEditor = document.getElementById(
    UI_ELEMENT_IDS.PRESET_EDITOR
  ) as HTMLDivElement;
  const presetViewer = document.getElementById(
    UI_ELEMENT_IDS.PRESET_VIEWER
  ) as HTMLDivElement;
  const metaPromptTextarea = document.getElementById(
    UI_ELEMENT_IDS.META_PROMPT
  ) as HTMLTextAreaElement;

  if (!presetEditor || !presetViewer || !metaPromptTextarea) return;

  // Hide editor, show viewer
  presetEditor.style.display = 'none';
  presetViewer.style.display = 'block';

  // Reset textarea to readonly and restore content
  metaPromptTextarea.setAttribute('readonly', 'readonly');
  metaPromptTextarea.value = settings.metaPrompt;

  isEditingPreset = false;
  logger.info('Cancelled preset edit');
}

/**
 * Handles deleting a custom preset
 */
function handlePresetDelete(): void {
  if (isPresetPredefined(settings.currentPresetId)) {
    toastr.error(t('toast.cannotDeletePredefined'), t('extensionName'));
    return;
  }

  const preset = settings.customPresets.find(
    p => p.id === settings.currentPresetId
  );
  if (!preset) {
    toastr.error(t('toast.presetNotFound'), t('extensionName'));
    return;
  }

  const confirmDelete = confirm(
    t('prompt.deletePresetConfirm', {name: preset.name})
  );
  if (!confirmDelete) {
    return;
  }

  // Remove preset from array
  settings.customPresets = settings.customPresets.filter(
    p => p.id !== settings.currentPresetId
  );

  // Switch to default preset
  settings.currentPresetId = 'default';
  const defaultPreset = getPresetById('default', settings.customPresets);
  settings.metaPrompt = defaultPreset.template;

  saveSettings(settings, context);
  updateUI();

  toastr.success(
    t('toast.presetDeleted', {name: preset.name}),
    t('extensionName')
  );
  logger.info('Preset deleted:', preset.name);
}

// ===== Independent LLM Preset Handlers =====

/**
 * Handles independent LLM preset selection change
 */
function handleIndependentLlmPresetChange(): void {
  if (isEditingIndependentLlmPreset) {
    handleIndependentLlmPresetCancel();
  }

  const select = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SELECT
  ) as HTMLSelectElement;
  if (!select) return;

  const selectedId = select.value;
  const preset = getIndependentLlmPresetById(
    selectedId,
    settings.customIndependentLlmPresets || []
  );

  settings.currentIndependentLlmPresetId = selectedId;
  settings.llmFrequencyGuidelines = preset.frequencyGuidelines;
  settings.llmPromptWritingGuidelines = preset.promptWritingGuidelines;
  saveSettings(settings, context);
  updateUI();

  logger.info('Independent LLM preset changed:', {
    id: selectedId,
    name: preset.name,
  });
}

/**
 * Handles entering edit mode for independent LLM preset
 */
function handleIndependentLlmPresetEdit(): void {
  const editor = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_EDITOR
  ) as HTMLDivElement;
  const freqTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const writingTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;
  const saveButton = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SAVE
  ) as HTMLButtonElement;

  if (!editor || !freqTextarea || !writingTextarea) return;

  editor.style.display = 'block';
  freqTextarea.removeAttribute('readonly');
  writingTextarea.removeAttribute('readonly');

  if (saveButton) {
    const isPredefined = isIndependentLlmPresetPredefined(
      settings.currentIndependentLlmPresetId
    );
    saveButton.disabled = isPredefined;
    saveButton.title = isPredefined
      ? t('toast.cannotDeletePredefinedIndependentLlm')
      : t('settings.save');
  }

  isEditingIndependentLlmPreset = true;
  logger.info('Entered independent LLM preset edit mode');
}

/**
 * Handles saving changes to current custom independent LLM preset
 */
function handleIndependentLlmPresetSave(): void {
  if (
    isIndependentLlmPresetPredefined(settings.currentIndependentLlmPresetId)
  ) {
    toastr.error(
      t('toast.cannotDeletePredefinedIndependentLlm'),
      t('extensionName')
    );
    return;
  }

  const freqTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const writingTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;
  if (!freqTextarea || !writingTextarea) return;

  const presetIndex = (settings.customIndependentLlmPresets || []).findIndex(
    p => p.id === settings.currentIndependentLlmPresetId
  );
  if (presetIndex === -1) {
    toastr.error(t('toast.presetNotFound'), t('extensionName'));
    return;
  }

  settings.customIndependentLlmPresets[presetIndex].frequencyGuidelines =
    freqTextarea.value;
  settings.customIndependentLlmPresets[presetIndex].promptWritingGuidelines =
    writingTextarea.value;
  settings.llmFrequencyGuidelines = freqTextarea.value;
  settings.llmPromptWritingGuidelines = writingTextarea.value;
  saveSettings(settings, context);

  exitIndependentLlmEditMode();
  updateUI();
  toastr.success(t('toast.independentLlmPresetSaved'), t('extensionName'));
  logger.info(
    'Independent LLM preset saved:',
    settings.customIndependentLlmPresets[presetIndex].name
  );
}

/**
 * Handles saving current content as a new independent LLM preset
 */
function handleIndependentLlmPresetSaveAs(): void {
  const freqTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const writingTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;
  if (!freqTextarea || !writingTextarea) return;

  const name = prompt(t('prompt.enterIndependentLlmPresetName'));
  if (!name || name.trim() === '') return;

  const trimmedName = name.trim();

  if (isIndependentLlmPredefinedPresetName(trimmedName)) {
    toastr.error(
      t('toast.cannotUsePredefinedIndependentLlmNames'),
      t('extensionName')
    );
    return;
  }

  if (!settings.customIndependentLlmPresets) {
    settings.customIndependentLlmPresets = [];
  }

  const existingPreset = settings.customIndependentLlmPresets.find(
    p => p.name === trimmedName
  );

  if (existingPreset) {
    const overwrite = confirm(
      t('prompt.overwriteIndependentLlmPreset', {name: trimmedName})
    );
    if (!overwrite) return;

    existingPreset.frequencyGuidelines = freqTextarea.value;
    existingPreset.promptWritingGuidelines = writingTextarea.value;
    settings.currentIndependentLlmPresetId = existingPreset.id;
  } else {
    const newPreset: IndependentLlmGuidelinesPreset = {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      frequencyGuidelines: freqTextarea.value,
      promptWritingGuidelines: writingTextarea.value,
      predefined: false,
    };
    settings.customIndependentLlmPresets.push(newPreset);
    settings.currentIndependentLlmPresetId = newPreset.id;
  }

  settings.llmFrequencyGuidelines = freqTextarea.value;
  settings.llmPromptWritingGuidelines = writingTextarea.value;
  saveSettings(settings, context);

  exitIndependentLlmEditMode();
  updateUI();
  toastr.success(
    t('toast.independentLlmPresetSavedNamed', {name: trimmedName}),
    t('extensionName')
  );
  logger.info('Independent LLM preset saved as:', trimmedName);
}

/**
 * Handles canceling independent LLM preset edit
 */
function handleIndependentLlmPresetCancel(): void {
  const freqTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const writingTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;

  // Restore original values
  if (freqTextarea) freqTextarea.value = settings.llmFrequencyGuidelines;
  if (writingTextarea)
    writingTextarea.value = settings.llmPromptWritingGuidelines;

  exitIndependentLlmEditMode();
  logger.info('Cancelled independent LLM preset edit');
}

/**
 * Handles deleting a custom independent LLM preset
 */
function handleIndependentLlmPresetDelete(): void {
  if (
    isIndependentLlmPresetPredefined(settings.currentIndependentLlmPresetId)
  ) {
    toastr.error(
      t('toast.cannotDeletePredefinedIndependentLlm'),
      t('extensionName')
    );
    return;
  }

  const preset = (settings.customIndependentLlmPresets || []).find(
    p => p.id === settings.currentIndependentLlmPresetId
  );
  if (!preset) {
    toastr.error(t('toast.presetNotFound'), t('extensionName'));
    return;
  }

  const confirmDelete = confirm(
    t('prompt.deleteIndependentLlmPresetConfirm', {name: preset.name})
  );
  if (!confirmDelete) return;

  settings.customIndependentLlmPresets =
    settings.customIndependentLlmPresets.filter(
      p => p.id !== settings.currentIndependentLlmPresetId
    );

  // Switch to default
  settings.currentIndependentLlmPresetId = 'default';
  const defaultPreset = getIndependentLlmPresetById(
    'default',
    settings.customIndependentLlmPresets
  );
  settings.llmFrequencyGuidelines = defaultPreset.frequencyGuidelines;
  settings.llmPromptWritingGuidelines = defaultPreset.promptWritingGuidelines;

  saveSettings(settings, context);
  updateUI();

  toastr.success(
    t('toast.independentLlmPresetDeleted', {name: preset.name}),
    t('extensionName')
  );
  logger.info('Independent LLM preset deleted:', preset.name);
}

/**
 * Exits independent LLM preset edit mode
 */
function exitIndependentLlmEditMode(): void {
  const editor = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_EDITOR
  ) as HTMLDivElement;
  const freqTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
  ) as HTMLTextAreaElement;
  const writingTextarea = document.getElementById(
    UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
  ) as HTMLTextAreaElement;

  if (editor) editor.style.display = 'none';
  if (freqTextarea) freqTextarea.setAttribute('readonly', 'readonly');
  if (writingTextarea) writingTextarea.setAttribute('readonly', 'readonly');
  isEditingIndependentLlmPreset = false;
}

// ===== API Profile Handlers =====

/**
 * Populates the API profile dropdown with saved profiles
 */
function populateApiProfileDropdown(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.API_PROFILE_SELECT
  ) as HTMLSelectElement;
  if (!select) return;

  // Preserve manual option, clear the rest
  const manualOption = select.querySelector('option[value=""]');
  select.innerHTML = '';
  if (manualOption) {
    select.appendChild(manualOption);
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = t('settings.apiProfileManual');
    select.appendChild(opt);
  }

  // Add saved profiles
  (settings.apiProfiles || []).forEach(profile => {
    const opt = document.createElement('option');
    opt.value = profile.id;
    opt.textContent = profile.name;
    select.appendChild(opt);
  });

  select.value = settings.currentApiProfileId || '';
}

/**
 * Handles API profile selection change - fills fields with profile data
 */
function handleApiProfileChange(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.API_PROFILE_SELECT
  ) as HTMLSelectElement;
  if (!select) return;

  const profileId = select.value;
  settings.currentApiProfileId = profileId;

  if (profileId) {
    const profile = (settings.apiProfiles || []).find(p => p.id === profileId);
    if (profile) {
      // Fill fields with profile data
      const urlInput = document.getElementById(
        UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
      ) as HTMLInputElement;
      const keyInput = document.getElementById(
        UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
      ) as HTMLInputElement;
      const modelInput = document.getElementById(
        UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
      ) as HTMLInputElement;
      const maxTokensInput = document.getElementById(
        UI_ELEMENT_IDS.INDEPENDENT_LLM_MAX_TOKENS
      ) as HTMLInputElement;

      if (urlInput) urlInput.value = profile.apiUrl;
      if (keyInput) keyInput.value = profile.apiKey;
      if (modelInput) modelInput.value = profile.model;
      if (maxTokensInput) maxTokensInput.value = String(profile.maxTokens);

      // Update settings
      settings.independentLlmApiUrl = profile.apiUrl;
      settings.independentLlmApiKey = profile.apiKey;
      settings.independentLlmModel = profile.model;
      settings.independentLlmMaxTokens = profile.maxTokens;
    }
  }

  saveSettings(settings, context);
}

/**
 * Handles saving current API config as a profile
 */
function handleApiProfileSave(): void {
  const urlInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
  ) as HTMLInputElement;
  const keyInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
  ) as HTMLInputElement;
  const modelInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
  ) as HTMLInputElement;
  const maxTokensInput = document.getElementById(
    UI_ELEMENT_IDS.INDEPENDENT_LLM_MAX_TOKENS
  ) as HTMLInputElement;

  const name = prompt(t('prompt.enterApiProfileName'));
  if (!name || name.trim() === '') return;

  const trimmedName = name.trim();

  if (!settings.apiProfiles) {
    settings.apiProfiles = [];
  }

  // Check if name already exists - overwrite if so
  const existing = settings.apiProfiles.find(p => p.name === trimmedName);
  if (existing) {
    existing.apiUrl = urlInput?.value || '';
    existing.apiKey = keyInput?.value || '';
    existing.model = modelInput?.value || '';
    existing.maxTokens = parseInt(maxTokensInput?.value || '4096', 10);
    settings.currentApiProfileId = existing.id;
  } else {
    const newProfile: ApiProfile = {
      id: `profile-${Date.now()}`,
      name: trimmedName,
      apiUrl: urlInput?.value || '',
      apiKey: keyInput?.value || '',
      model: modelInput?.value || '',
      maxTokens: parseInt(maxTokensInput?.value || '4096', 10),
    };
    settings.apiProfiles.push(newProfile);
    settings.currentApiProfileId = newProfile.id;
  }

  saveSettings(settings, context);
  populateApiProfileDropdown();

  toastr.success(
    t('toast.apiProfileSaved', {name: trimmedName}),
    t('extensionName')
  );
  logger.info('API profile saved:', trimmedName);
}

/**
 * Handles deleting the selected API profile
 */
function handleApiProfileDelete(): void {
  const select = document.getElementById(
    UI_ELEMENT_IDS.API_PROFILE_SELECT
  ) as HTMLSelectElement;
  if (!select || !select.value) {
    toastr.warning(t('toast.apiProfileSelectToDelete'), t('extensionName'));
    return;
  }

  const profile = (settings.apiProfiles || []).find(p => p.id === select.value);
  if (!profile) return;

  const confirmDelete = confirm(
    t('prompt.deleteApiProfileConfirm', {name: profile.name})
  );
  if (!confirmDelete) return;

  settings.apiProfiles = settings.apiProfiles.filter(p => p.id !== profile.id);
  settings.currentApiProfileId = '';

  saveSettings(settings, context);
  populateApiProfileDropdown();

  toastr.success(
    t('toast.apiProfileDeleted', {name: profile.name}),
    t('extensionName')
  );
  logger.info('API profile deleted:', profile.name);
}

/**
 * Checks for extension updates from GitHub releases API
 */
async function checkForUpdates(): Promise<void> {
  const statusEl = document.getElementById(UI_ELEMENT_IDS.VERSION_STATUS);
  if (!statusEl) return;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {signal: AbortSignal.timeout(10000)}
    );

    if (!response.ok) {
      statusEl.textContent = t('version.checkFailed');
      return;
    }

    const data = await response.json();
    const latestVersion = (data.tag_name || '').replace(/^v/, '');

    if (latestVersion && latestVersion !== EXTENSION_VERSION) {
      statusEl.innerHTML = `→ <a href="${data.html_url}" target="_blank" style="color: var(--SmartThemeQuoteColor, #e49e2c);">${t('version.updateAvailable', {version: latestVersion})}</a>`;
    } else {
      statusEl.textContent = `✓ ${t('version.latest')}`;
      statusEl.style.color = 'var(--SmartThemeGreenColor, #4caf50)';
    }
  } catch {
    statusEl.textContent = t('version.checkFailed');
  }
}

/**
 * Cancels all active streaming sessions
 * Used when chat is cleared or reset
 */
function cancelAllSessions(): void {
  const sessions = sessionManager.getAllSessions();
  if (sessions.length === 0) {
    return;
  }

  logger.info(`Cancelling ${sessions.length} active streaming sessions`);

  for (const session of sessions) {
    sessionManager.cancelSession(session.messageId);
  }
}

/**
 * Track whether event handlers have been registered to prevent duplicates
 */
let eventHandlersRegistered = false;

/**
 * Registers all event handlers for the extension
 * Only called when extension is enabled
 * Uses flag to prevent duplicate registration
 */
function registerEventHandlers(): void {
  // Prevent duplicate registration
  if (eventHandlersRegistered) {
    logger.debug(
      'Event handlers already registered, skipping duplicate registration'
    );
    return;
  }

  logger.info('Registering event handlers...');

  if (!registeredEventHandlers) {
    registeredEventHandlers = {
      streamTokenReceived: () => {
        if (!settings.enabled) {
          return;
        }

        const messageId = context.chat.length - 1;
        if (messageId < 0) {
          logger.warn('No messages in chat, cannot start streaming session');
          return;
        }
        handleStreamTokenStarted(messageId, context, settings);
      },
      messageReceived: (messageId: number) => {
        if (!settings.enabled) {
          return;
        }

        handleMessageReceived(messageId, context, settings);

        setTimeout(() => {
          if (!settings.enabled) {
            return;
          }
          addImageClickHandlers(settings);
          syncIndependentPromptRetryButtons(context, settings, retryMessageId =>
            handleManualIndependentPromptRetry(retryMessageId, settings)
          );
        }, 100);
      },
      messageUpdated: () => {
        if (!settings.enabled) {
          return;
        }

        setTimeout(() => {
          if (!settings.enabled) {
            return;
          }
          addImageClickHandlers(settings);
          syncIndependentPromptRetryButtons(context, settings, retryMessageId =>
            handleManualIndependentPromptRetry(retryMessageId, settings)
          );
        }, 100);
      },
      generationStarted: (type: string, _options: unknown, dryRun: boolean) => {
        if (!settings.enabled) {
          return;
        }

        if (dryRun) {
          logger.trace('Generation started (dry run), skipping type tracking', {
            type,
          });
          return;
        }
        currentGenerationType = type;
        logger.info('Generation started', {type});
      },
      generationEnded: (messageId: number) => {
        if (!settings.enabled) {
          return;
        }

        handleGenerationEnded(messageId, context, settings);
      },
      chatCompletionPromptReady: (eventData: any) => {
        if (!settings.enabled) {
          return;
        }

        if (eventData?.dryRun) {
          logger.trace('Skipping prompt ready processing for dry run');
          return;
        }

        if (!eventData?.chat) {
          return;
        }

        if (isIndependentApiMode(settings.promptGenerationMode)) {
          pruneGeneratedImagesAndPrompts(
            eventData.chat,
            settings.promptDetectionPatterns
          );
          logger.debug(
            'Applied independent-API-mode pruning (images + prompts)'
          );
        } else {
          pruneGeneratedImages(
            eventData.chat,
            settings.promptDetectionPatterns
          );
          logger.debug('Applied shared-API-mode pruning (images only)');
        }

        const effectiveType = currentGenerationType || 'normal';
        const shouldInject =
          settings.metaPrompt &&
          settings.metaPrompt.length > 0 &&
          !['quiet', 'impersonate'].includes(effectiveType) &&
          !isIndependentApiMode(settings.promptGenerationMode);

        if (shouldInject) {
          const depth = settings.metaPromptDepth || 0;
          const insertPosition = Math.max(0, eventData.chat.length - depth);

          logger.info('Injecting meta-prompt as system message', {
            generationType: effectiveType,
            depth,
            insertPosition,
            chatLength: eventData.chat.length,
          });

          eventData.chat.splice(insertPosition, 0, {
            role: 'system',
            content: settings.metaPrompt,
          });
        } else {
          logger.info('Skipping meta-prompt injection', {
            enabled: settings.enabled,
            hasMetaPrompt: !!settings.metaPrompt,
            generationType: effectiveType,
            promptGenerationMode: settings.promptGenerationMode,
            reason: !settings.metaPrompt
              ? 'no meta-prompt'
              : ['quiet', 'impersonate'].includes(effectiveType)
                ? `filtered generation type: ${effectiveType}`
                : isIndependentApiMode(settings.promptGenerationMode)
                  ? 'Independent API mode enabled'
                  : 'unknown',
          });
        }
      },
    };
  }

  const STREAM_TOKEN_RECEIVED = context.eventTypes.STREAM_TOKEN_RECEIVED;
  context.eventSource.on(
    STREAM_TOKEN_RECEIVED,
    registeredEventHandlers.streamTokenReceived
  );

  const MESSAGE_RECEIVED = context.eventTypes.MESSAGE_RECEIVED;
  context.eventSource.on(
    MESSAGE_RECEIVED,
    registeredEventHandlers.messageReceived
  );

  const MESSAGE_UPDATED = context.eventTypes.MESSAGE_UPDATED;
  context.eventSource.on(
    MESSAGE_UPDATED,
    registeredEventHandlers.messageUpdated
  );

  const GENERATION_STARTED = context.eventTypes.GENERATION_STARTED;
  context.eventSource.on(
    GENERATION_STARTED,
    registeredEventHandlers.generationStarted
  );

  const GENERATION_ENDED = context.eventTypes.GENERATION_ENDED;
  context.eventSource.on(
    GENERATION_ENDED,
    registeredEventHandlers.generationEnded
  );

  const CHAT_COMPLETION_PROMPT_READY =
    context.eventTypes.CHAT_COMPLETION_PROMPT_READY;
  context.eventSource.on(
    CHAT_COMPLETION_PROMPT_READY,
    registeredEventHandlers.chatCompletionPromptReady
  );

  // Note: CHAT_CHANGED is now handled by chat_changed_handler module

  // Mark as registered to prevent duplicates
  eventHandlersRegistered = true;

  logger.info('Event handlers registered:', {
    STREAM_TOKEN_RECEIVED,
    MESSAGE_RECEIVED,
    MESSAGE_UPDATED,
    GENERATION_STARTED,
    CHAT_COMPLETION_PROMPT_READY,
  });
}

/**
 * 注销所有事件处理器
 * 允许扩展被禁用而无需刷新页面
 */
function unregisterEventHandlers(): void {
  if (!eventHandlersRegistered) {
    logger.debug('事件处理器未注册,无需注销');
    return;
  }

  logger.info('正在注销事件处理器...');
  const off =
    (context.eventSource as any).off ||
    (context.eventSource as any).removeListener;

  if (typeof off === 'function' && registeredEventHandlers) {
    off.call(
      context.eventSource,
      context.eventTypes.STREAM_TOKEN_RECEIVED,
      registeredEventHandlers.streamTokenReceived
    );
    off.call(
      context.eventSource,
      context.eventTypes.MESSAGE_RECEIVED,
      registeredEventHandlers.messageReceived
    );
    off.call(
      context.eventSource,
      context.eventTypes.MESSAGE_UPDATED,
      registeredEventHandlers.messageUpdated
    );
    off.call(
      context.eventSource,
      context.eventTypes.GENERATION_STARTED,
      registeredEventHandlers.generationStarted
    );
    off.call(
      context.eventSource,
      context.eventTypes.GENERATION_ENDED,
      registeredEventHandlers.generationEnded
    );
    off.call(
      context.eventSource,
      context.eventTypes.CHAT_COMPLETION_PROMPT_READY,
      registeredEventHandlers.chatCompletionPromptReady
    );
    eventHandlersRegistered = false;
    logger.info('事件处理器已注销');
    return;
  }

  logger.warn(
    'eventSource 不支持解绑，保留已注册处理器并通过 enabled 开关使其休眠'
  );
}

/**
 * Initializes the extension
 */
function initialize(): void {
  if (extensionInitialized) {
    logger.info(
      'Extension already initialized, skipping duplicate initialization'
    );
    return;
  }

  logger.info('Initializing extension...');

  const st = (
    globalThis as {SillyTavern?: {getContext?: () => SillyTavernContext}}
  ).SillyTavern;
  if (!st || typeof st.getContext !== 'function') {
    logger.debug('SillyTavern global not available; skipping initialization');
    return;
  }

  // Get SillyTavern context
  try {
    context = st.getContext();
    logger.info('Got SillyTavern context');
  } catch (error) {
    logger.error('Failed to get SillyTavern context:', error);
    return;
  }

  // Initialize i18n
  initializeI18n(context);
  logger.info('Initialized i18n');

  // Initialize CHAT_CHANGED handler (single centralized handler)
  initializeChatChangedHandler();
  logger.info('Initialized centralized CHAT_CHANGED handler');

  // Load settings
  settings = loadSettings(context);
  logger.info('Loaded settings:', settings);

  // Initialize previous image display width to track changes
  previousImageDisplayWidth = settings.imageDisplayWidth;

  // Apply log level from settings
  setLogLevel(settings.logLevel);

  // Initialize chat change operations module with current context and callbacks
  // This must be done after settings are loaded
  initializeChatChangeOperations(
    context,
    settings,
    updateMaxConcurrent,
    updateMinInterval,
    updateUI
  );
  logger.info('Initialized chat change operations module');

  // Conditionally initialize extension components based on settings.enabled
  if (settings.enabled) {
    // SessionManager is already a singleton, no initialization needed
    logger.info('SessionManager ready (singleton)');

    // Initialize progress widget if enabled (connects to progressManager via events)
    if (settings.showProgressWidget) {
      initializeProgressWidget(progressManager);
      logger.info('Initialized ProgressWidget with event subscriptions');
    } else {
      logger.info('Progress widget disabled - skipping initialization');
    }

    // Initialize gallery widget if enabled (connects to progressManager via events)
    if (settings.showGalleryWidget) {
      initializeGalleryWidget(progressManager);
      logger.info('Initialized GalleryWidget');

      // Show gallery widget on initialization to scan for existing images
      const gallery = getGalleryWidget();
      if (gallery) {
        gallery.show();
        logger.debug('Gallery widget shown on initialization');
      }
    } else {
      logger.info('Gallery widget disabled - skipping initialization');
    }

    // Initialize streaming preview widget if enabled
    if (settings.showStreamingPreviewWidget) {
      streamingPreviewWidget = new StreamingPreviewWidget(
        progressManager,
        settings.promptDetectionPatterns || DEFAULT_PROMPT_DETECTION_PATTERNS
      );
      logger.info('Initialized StreamingPreviewWidget');
    } else {
      logger.info(
        'Streaming preview widget disabled - skipping initialization'
      );
    }
  } else {
    logger.info(
      'Extension is disabled - skipping SessionManager and widget initialization'
    );
  }

  // Initialize concurrency limiter with settings
  initializeConcurrencyLimiter(
    settings.maxConcurrentGenerations,
    settings.minGenerationInterval
  );
  logger.info(
    `Initialized concurrency limiter: max=${settings.maxConcurrentGenerations}, minInterval=${settings.minGenerationInterval}ms`
  );

  // Conditionally register event handlers based on settings.enabled
  if (settings.enabled) {
    registerEventHandlers();
    logger.info('Extension is enabled - event handlers registered');
  } else {
    logger.info('Extension is disabled - skipping event handler registration');
  }

  // Inject settings UI
  const settingsContainer = document.getElementById('extensions_settings2');
  if (settingsContainer) {
    const settingsHTML = createSettingsUI();
    settingsContainer.insertAdjacentHTML('beforeend', settingsHTML);

    // Attach event listeners
    const enabledCheckbox = document.getElementById(UI_ELEMENT_IDS.ENABLED);
    const presetSelect = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_SELECT
    );
    const presetEditButton = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_EDIT
    );
    const presetSaveButton = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_SAVE
    );
    const presetSaveAsButton = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_SAVE_AS
    );
    const presetDeleteButton = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_DELETE
    );
    const presetCancelButton = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_PRESET_CANCEL
    );
    const streamingPollIntervalInput = document.getElementById(
      UI_ELEMENT_IDS.STREAMING_POLL_INTERVAL
    );
    const maxConcurrentInput = document.getElementById(
      UI_ELEMENT_IDS.MAX_CONCURRENT
    );
    const minGenerationIntervalInput = document.getElementById(
      UI_ELEMENT_IDS.MIN_GENERATION_INTERVAL
    );
    const logLevelSelect = document.getElementById(UI_ELEMENT_IDS.LOG_LEVEL);
    const promptPatternsTextarea = document.getElementById(
      UI_ELEMENT_IDS.PROMPT_PATTERNS
    );
    const promptPatternsResetButton = document.getElementById(
      UI_ELEMENT_IDS.PROMPT_PATTERNS_RESET
    );
    const commonStyleTagsTextarea = document.getElementById(
      UI_ELEMENT_IDS.COMMON_STYLE_TAGS
    );
    const commonStyleTagsPositionSelect = document.getElementById(
      UI_ELEMENT_IDS.COMMON_STYLE_TAGS_POSITION
    );
    const manualGenModeSelect = document.getElementById(
      UI_ELEMENT_IDS.MANUAL_GEN_MODE
    );
    const promptGenModeRegexRadio = document.getElementById(
      UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_SHARED
    ) as HTMLInputElement;
    const promptGenModeLLMRadio = document.getElementById(
      UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_INDEPENDENT
    ) as HTMLInputElement;
    const maxPromptsPerMessageInput = document.getElementById(
      UI_ELEMENT_IDS.MAX_PROMPTS_PER_MESSAGE
    ) as HTMLInputElement;
    const contextMessageCountInput = document.getElementById(
      UI_ELEMENT_IDS.CONTEXT_MESSAGE_COUNT
    ) as HTMLInputElement;
    const metaPromptDepthInput = document.getElementById(
      UI_ELEMENT_IDS.META_PROMPT_DEPTH
    ) as HTMLInputElement;
    const standalonePromptCountInput = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_PROMPT_COUNT
    ) as HTMLInputElement;
    const llmFrequencyGuidelinesTextarea = document.getElementById(
      UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES
    ) as HTMLTextAreaElement;
    const llmFrequencyGuidelinesResetButton = document.getElementById(
      UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES_RESET
    );
    const llmPromptWritingGuidelinesTextarea = document.getElementById(
      UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES
    ) as HTMLTextAreaElement;
    const llmPromptWritingGuidelinesResetButton = document.getElementById(
      UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES_RESET
    );
    const resetButton = document.getElementById(UI_ELEMENT_IDS.RESET_BUTTON);

    enabledCheckbox?.addEventListener('change', handleSettingsChange);
    presetSelect?.addEventListener('change', handlePresetChange);
    presetEditButton?.addEventListener('click', handlePresetEdit);
    presetSaveButton?.addEventListener('click', handlePresetSave);
    presetSaveAsButton?.addEventListener('click', handlePresetSaveAs);
    presetDeleteButton?.addEventListener('click', handlePresetDelete);
    presetCancelButton?.addEventListener('click', handlePresetCancel);
    streamingPollIntervalInput?.addEventListener(
      'change',
      handleSettingsChange
    );
    maxConcurrentInput?.addEventListener('change', handleSettingsChange);
    minGenerationIntervalInput?.addEventListener(
      'change',
      handleSettingsChange
    );
    logLevelSelect?.addEventListener('change', handleSettingsChange);
    promptPatternsTextarea?.addEventListener('change', handleSettingsChange);
    promptPatternsResetButton?.addEventListener(
      'click',
      handlePromptPatternsReset
    );
    commonStyleTagsTextarea?.addEventListener('change', handleSettingsChange);
    commonStyleTagsPositionSelect?.addEventListener(
      'change',
      handleSettingsChange
    );
    manualGenModeSelect?.addEventListener('change', handleSettingsChange);
    promptGenModeRegexRadio?.addEventListener('change', () => {
      toggleIndependentApiSettingsVisibility();
      handleSettingsChange();
    });
    promptGenModeLLMRadio?.addEventListener('change', () => {
      toggleIndependentApiSettingsVisibility();
      handleSettingsChange();
    });
    maxPromptsPerMessageInput?.addEventListener('change', handleSettingsChange);
    contextMessageCountInput?.addEventListener('change', handleSettingsChange);
    metaPromptDepthInput?.addEventListener('change', handleSettingsChange);
    standalonePromptCountInput?.addEventListener(
      'change',
      handleSettingsChange
    );
    llmFrequencyGuidelinesTextarea?.addEventListener(
      'change',
      handleSettingsChange
    );
    llmFrequencyGuidelinesResetButton?.addEventListener(
      'click',
      handleLLMFrequencyGuidelinesReset
    );
    llmPromptWritingGuidelinesTextarea?.addEventListener(
      'change',
      handleSettingsChange
    );
    llmPromptWritingGuidelinesResetButton?.addEventListener(
      'click',
      handleLLMPromptWritingGuidelinesReset
    );

    const showGalleryWidgetCheckbox = document.getElementById(
      UI_ELEMENT_IDS.SHOW_GALLERY_WIDGET
    ) as HTMLInputElement;
    const showProgressWidgetCheckbox = document.getElementById(
      UI_ELEMENT_IDS.SHOW_PROGRESS_WIDGET
    ) as HTMLInputElement;
    const showStreamingPreviewWidgetCheckbox = document.getElementById(
      UI_ELEMENT_IDS.SHOW_STREAMING_PREVIEW_WIDGET
    ) as HTMLInputElement;
    const showFloatingPanelLauncherCheckbox = document.getElementById(
      UI_ELEMENT_IDS.SHOW_FLOATING_PANEL_LAUNCHER
    ) as HTMLInputElement;
    const openFloatingPanelButton = document.getElementById(
      UI_ELEMENT_IDS.OPEN_FLOATING_PANEL
    );
    showGalleryWidgetCheckbox?.addEventListener('change', handleSettingsChange);
    showProgressWidgetCheckbox?.addEventListener(
      'change',
      handleSettingsChange
    );
    showStreamingPreviewWidgetCheckbox?.addEventListener(
      'change',
      handleSettingsChange
    );
    showFloatingPanelLauncherCheckbox?.addEventListener(
      'change',
      handleSettingsChange
    );
    openFloatingPanelButton?.addEventListener('click', () => {
      openFloatingPanel();
    });
    // Image retention days
    const imageRetentionDaysInput = document.getElementById(
      UI_ELEMENT_IDS.IMAGE_RETENTION_DAYS
    );
    imageRetentionDaysInput?.addEventListener('change', handleSettingsChange);

    // Independent LLM API settings
    const useIndependentLlmApiCheckbox = document.getElementById(
      UI_ELEMENT_IDS.USE_INDEPENDENT_LLM_API
    ) as HTMLInputElement;
    const independentLlmApiUrlInput = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_API_URL
    ) as HTMLInputElement;
    const independentLlmApiKeyInput = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_API_KEY
    ) as HTMLInputElement;
    const independentLlmModelInput = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL
    ) as HTMLInputElement;
    const independentLlmModelSelect = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_MODEL_SELECT
    ) as HTMLSelectElement;
    const independentLlmFetchModelsButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_FETCH_MODELS
    );
    const independentLlmTestConnectionButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_TEST_CONNECTION
    );

    useIndependentLlmApiCheckbox?.addEventListener(
      'change',
      handleSettingsChange
    );
    independentLlmApiUrlInput?.addEventListener('change', handleSettingsChange);
    independentLlmApiKeyInput?.addEventListener('change', handleSettingsChange);
    independentLlmModelInput?.addEventListener('change', handleSettingsChange);

    // Model select → sync to text input on change
    independentLlmModelSelect?.addEventListener('change', () => {
      const selectedModel = independentLlmModelSelect.value;
      if (selectedModel && independentLlmModelInput) {
        independentLlmModelInput.value = selectedModel;
        handleSettingsChange();
      }
    });

    independentLlmFetchModelsButton?.addEventListener(
      'click',
      handleFetchModels
    );

    const independentLlmMaxTokensInput = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_MAX_TOKENS
    );
    independentLlmMaxTokensInput?.addEventListener(
      'change',
      handleSettingsChange
    );

    // Context injection checkboxes
    const injectCharDescCheckbox = document.getElementById(
      UI_ELEMENT_IDS.INJECT_CHARACTER_DESCRIPTION
    ) as HTMLInputElement;
    const injectUserPersonaCheckbox = document.getElementById(
      UI_ELEMENT_IDS.INJECT_USER_PERSONA
    ) as HTMLInputElement;
    const injectScenarioCheckbox = document.getElementById(
      UI_ELEMENT_IDS.INJECT_SCENARIO
    ) as HTMLInputElement;
    injectCharDescCheckbox?.addEventListener('change', handleSettingsChange);
    injectUserPersonaCheckbox?.addEventListener('change', handleSettingsChange);
    injectScenarioCheckbox?.addEventListener('change', handleSettingsChange);

    // World info injection
    const injectWorldInfoCheckbox = document.getElementById(
      UI_ELEMENT_IDS.INJECT_WORLD_INFO
    ) as HTMLInputElement;
    injectWorldInfoCheckbox?.addEventListener('change', handleSettingsChange);

    // Content filter tags
    const contentFilterTagsTextarea = document.getElementById(
      UI_ELEMENT_IDS.CONTENT_FILTER_TAGS
    ) as HTMLTextAreaElement;
    const contentFilterTagsResetButton = document.getElementById(
      UI_ELEMENT_IDS.CONTENT_FILTER_TAGS_RESET
    );
    contentFilterTagsTextarea?.addEventListener('change', handleSettingsChange);
    contentFilterTagsResetButton?.addEventListener('click', () => {
      if (contentFilterTagsTextarea) {
        contentFilterTagsTextarea.value =
          DEFAULT_CONTENT_FILTER_TAGS.join('\n');
        handleSettingsChange();
      }
    });

    independentLlmTestConnectionButton?.addEventListener(
      'click',
      handleTestIndependentLlmConnection
    );

    // Independent LLM preset management
    const ilmPresetSelect = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SELECT
    );
    const ilmPresetEditButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_EDIT
    );
    const ilmPresetSaveButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SAVE
    );
    const ilmPresetSaveAsButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_SAVE_AS
    );
    const ilmPresetDeleteButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_DELETE
    );
    const ilmPresetCancelButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_PRESET_CANCEL
    );
    ilmPresetSelect?.addEventListener(
      'change',
      handleIndependentLlmPresetChange
    );
    ilmPresetEditButton?.addEventListener(
      'click',
      handleIndependentLlmPresetEdit
    );
    ilmPresetSaveButton?.addEventListener(
      'click',
      handleIndependentLlmPresetSave
    );
    ilmPresetSaveAsButton?.addEventListener(
      'click',
      handleIndependentLlmPresetSaveAs
    );
    ilmPresetDeleteButton?.addEventListener(
      'click',
      handleIndependentLlmPresetDelete
    );
    ilmPresetCancelButton?.addEventListener(
      'click',
      handleIndependentLlmPresetCancel
    );

    const independentLlmViewLastRequestButton = document.getElementById(
      UI_ELEMENT_IDS.INDEPENDENT_LLM_VIEW_LAST_REQUEST
    );
    independentLlmViewLastRequestButton?.addEventListener(
      'click',
      handleViewLastRequest
    );

    // API Profile management
    const apiProfileSelect = document.getElementById(
      UI_ELEMENT_IDS.API_PROFILE_SELECT
    );
    const apiProfileSaveButton = document.getElementById(
      UI_ELEMENT_IDS.API_PROFILE_SAVE
    );
    const apiProfileDeleteButton = document.getElementById(
      UI_ELEMENT_IDS.API_PROFILE_DELETE
    );
    apiProfileSelect?.addEventListener('change', handleApiProfileChange);
    apiProfileSaveButton?.addEventListener('click', handleApiProfileSave);
    apiProfileDeleteButton?.addEventListener('click', handleApiProfileDelete);

    // Image display width slider
    const imageDisplayWidthInput = document.getElementById(
      UI_ELEMENT_IDS.IMAGE_DISPLAY_WIDTH
    ) as HTMLInputElement;
    // Use 'input' event for live updates while dragging slider
    imageDisplayWidthInput?.addEventListener('input', handleSettingsChange);
    // Also listen to 'change' for compatibility
    imageDisplayWidthInput?.addEventListener('change', handleSettingsChange);

    resetButton?.addEventListener('click', handleResetSettings);

    // Image subfolder label (per-chat, saved to chat metadata)
    const imageSubfolderLabelInput = document.getElementById(
      UI_ELEMENT_IDS.IMAGE_SUBFOLDER_LABEL
    ) as HTMLInputElement;
    imageSubfolderLabelInput?.addEventListener('change', () => {
      const label = imageSubfolderLabelInput.value.trim();
      try {
        const metadata = getMetadata();
        metadata.imageSubfolderLabel = label || undefined;
        saveMetadata();
        setImageSubfolderLabel(label || null);
        logger.info(`Image subfolder label updated: "${label || '(default)'}"`);
      } catch (error) {
        logger.warn('Could not save subfolder label (no active chat?):', error);
      }
    });

    // Update UI with loaded settings
    updateUI();

    // Check for updates (non-blocking)
    checkForUpdates().catch(error => {
      logger.debug('Update check failed:', error);
    });

    // Register world info event listeners and initialize panel (non-blocking)
    registerWorldInfoEventListeners();
    initializeWorldInfoPanel().catch(error => {
      logger.warn('World info panel initialization failed:', error);
    });

    // Initialize character fixed tags panel
    initializeCharacterTagsPanel(settings, () =>
      saveSettings(settings, context)
    );

    // Initialize standalone generation panel
    try {
      const standaloneMetadata = getMetadata();
      initializeStandaloneGeneration(context, settings, standaloneMetadata);
    } catch {
      // No active chat - initialize without metadata
      initializeStandaloneGeneration(context, settings, undefined);
    }

    // Initialize prompt library panel
    initializePromptLibrary(context, settings);

    // Mount the floating panel after all source controls and submodules are ready.
    initializeFloatingPanel();
    setFloatingPanelLauncherVisible(settings.showFloatingPanelLauncher);
  }

  logger.info('Extension initialized successfully');

  // Note: CHAT_CHANGED is now handled by chat_changed_handler module
  // which orchestrates all chat change operations in the correct order

  // Add click handlers to existing images
  addImageClickHandlers(settings);
  extensionInitialized = true;

  // Run startup cleanup for expired images
  try {
    const metadata = getMetadata();
    runStartupCleanup(context, metadata, settings);
  } catch (error) {
    logger.warn('Startup cleanup skipped (metadata not ready):', error);
  }
}

// Initialize when extension loads
initialize();

// Expose gallery toggle function globally for easy access
// Users can call window.toggleImageGallery() from console
(window as any).toggleImageGallery = () => {
  const gallery = getGalleryWidget();
  if (gallery) {
    gallery.toggleVisibility();
    logger.info('Gallery visibility toggled via global function');
  } else {
    logger.warn('Gallery widget not initialized');
  }
};

// Expose gallery show function
(window as any).showImageGallery = () => {
  const gallery = getGalleryWidget();
  if (gallery) {
    gallery.show();
    logger.info('Gallery shown via global function');
  } else {
    logger.warn('Gallery widget not initialized');
  }
};

// Expose gallery hide function
(window as any).hideImageGallery = () => {
  const gallery = getGalleryWidget();
  if (gallery) {
    gallery.hide();
    logger.info('Gallery hidden via global function');
  } else {
    logger.warn('Gallery widget not initialized');
  }
};
