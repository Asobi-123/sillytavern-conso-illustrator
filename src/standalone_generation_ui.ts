/**
 * Standalone Generation UI Module
 * Provides a workbench for generating images independently of chat messages
 */

import {UI_ELEMENT_IDS, STANDALONE_PROMPT_COUNT} from './constants';
import {t} from './i18n';
import {createLogger} from './logger';
import {generateStandalonePrompts} from './services/prompt_generation_service';
import {generateImage, setImageSubfolderLabel} from './image_generator';
import {applyCharacterFixedTags} from './services/character_fixed_tags_service';
import {
  AutoIllustratorError,
  getUserFacingErrorReason,
} from './utils/error_utils';
import type {
  AutoIllustratorChatMetadata,
  StandalonePromptResult,
} from './types';

const logger = createLogger('StandaloneGen');
let standaloneGenerationInitialized = false;
const STANDALONE_SUBFOLDER_STORAGE_KEY =
  'auto_illustrator_conso_standalone_subfolder_label';

function renderStandaloneError(
  container: HTMLElement,
  key: 'standalone.imageFailed' | 'standalone.promptFailed'
): void {
  container.innerHTML = `<div class="standalone-error">${t(key)}</div>`;
}

function showStandaloneToast(
  key:
    | 'toast.standalonePromptGenerationFailedWithReason'
    | 'toast.standaloneImageGenerationFailedWithReason',
  error: unknown
): void {
  toastr.error(
    t(key, {reason: getUserFacingErrorReason(error)}),
    t('extensionName')
  );
}

/**
 * Creates the HTML content for the standalone generation drawer.
 */
export function createStandaloneGenerationContent(): string {
  return `
    <div>
      <div style="display: flex; gap: 1rem; margin-bottom: 0.75rem;">
        <label class="checkbox_label" for="${UI_ELEMENT_IDS.STANDALONE_MODE_AI}">
          <input id="${UI_ELEMENT_IDS.STANDALONE_MODE_AI}" type="radio" name="standalone_mode" value="ai" checked />
          <span>${t('standalone.modeAi')}</span>
        </label>
        <label class="checkbox_label" for="${UI_ELEMENT_IDS.STANDALONE_MODE_MANUAL}">
          <input id="${UI_ELEMENT_IDS.STANDALONE_MODE_MANUAL}" type="radio" name="standalone_mode" value="manual" />
          <span>${t('standalone.modeManual')}</span>
        </label>
      </div>

      <div id="standalone_ai_panel">
        <label for="${UI_ELEMENT_IDS.STANDALONE_SCENE_INPUT}">
          <span>${t('standalone.sceneDescription')}</span>
          <textarea id="${UI_ELEMENT_IDS.STANDALONE_SCENE_INPUT}" class="text_pole textarea_compact" rows="5" placeholder="${t('standalone.sceneDescriptionPlaceholder')}"></textarea>
        </label>

        <div class="standalone-options-row">
          <label for="${UI_ELEMENT_IDS.STANDALONE_PROMPT_COUNT}" style="display: flex; align-items: center; gap: 0.5rem;">
            <span>${t('standalone.promptCount')}</span>
            <input id="${UI_ELEMENT_IDS.STANDALONE_PROMPT_COUNT}" class="text_pole" type="number"
                   min="${STANDALONE_PROMPT_COUNT.MIN}" max="${STANDALONE_PROMPT_COUNT.MAX}" step="${STANDALONE_PROMPT_COUNT.STEP}"
                   value="${STANDALONE_PROMPT_COUNT.DEFAULT}" style="width: 60px;" />
          </label>
          <label class="checkbox_label" for="${UI_ELEMENT_IDS.STANDALONE_INCLUDE_CHAR_INFO}">
            <input id="${UI_ELEMENT_IDS.STANDALONE_INCLUDE_CHAR_INFO}" type="checkbox" checked />
            <span>${t('standalone.includeCharInfo')}</span>
          </label>
          <label class="checkbox_label" for="${UI_ELEMENT_IDS.STANDALONE_INCLUDE_WORLD_INFO}">
            <input id="${UI_ELEMENT_IDS.STANDALONE_INCLUDE_WORLD_INFO}" type="checkbox" checked />
            <span>${t('standalone.includeWorldInfo')}</span>
          </label>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; margin-bottom: 0.75rem;">
          <button id="${UI_ELEMENT_IDS.STANDALONE_GENERATE_PROMPTS_BTN}" class="menu_button">
            <i class="fa-solid fa-wand-magic-sparkles"></i> ${t('standalone.generatePrompts')}
          </button>
          <button id="${UI_ELEMENT_IDS.STANDALONE_AUTO_BTN}" class="menu_button">
            <i class="fa-solid fa-bolt"></i> ${t('standalone.autoGenerate')}
          </button>
        </div>

        <div id="${UI_ELEMENT_IDS.STANDALONE_RESULTS}" class="standalone-results-container" style="display:none;"></div>

        <div id="standalone_ai_batch_actions" style="display:none; margin-top: 0.5rem; display: flex; gap: 0.5rem;">
          <button id="${UI_ELEMENT_IDS.STANDALONE_GENERATE_ALL_BTN}" class="menu_button" style="display:none;">
            <i class="fa-solid fa-images"></i> ${t('standalone.generateAll')}
          </button>
          <button id="${UI_ELEMENT_IDS.STANDALONE_CLEAR_BTN}" class="menu_button" style="display:none;">
            <i class="fa-solid fa-trash"></i> ${t('standalone.clear')}
          </button>
        </div>
      </div>

      <div id="standalone_manual_panel" style="display:none;">
        <label for="${UI_ELEMENT_IDS.STANDALONE_MANUAL_PROMPT_INPUT}">
          <span>Prompt</span>
          <textarea id="${UI_ELEMENT_IDS.STANDALONE_MANUAL_PROMPT_INPUT}" class="text_pole textarea_compact" rows="3" placeholder="${t('standalone.manualPromptPlaceholder')}"></textarea>
        </label>
        <button id="${UI_ELEMENT_IDS.STANDALONE_MANUAL_GENERATE_BTN}" class="menu_button" style="margin-top: 0.5rem;">
          <i class="fa-solid fa-image"></i> ${t('standalone.generateImage')}
        </button>
        <div id="${UI_ELEMENT_IDS.STANDALONE_MANUAL_IMAGE}" class="standalone-image-container" style="margin-top: 0.5rem;"></div>
      </div>

      <label for="${UI_ELEMENT_IDS.STANDALONE_SUBFOLDER_LABEL}" style="margin-top: 0.75rem;">
        <span>${t('standalone.subfolderLabel')}</span>
        <small>${t('standalone.subfolderLabelHint')}</small>
        <input id="${UI_ELEMENT_IDS.STANDALONE_SUBFOLDER_LABEL}" class="text_pole" type="text" placeholder="e.g., test_outputs" />
      </label>
    </div>`;
}

const STANDALONE_FOLDER_PREFIX = 'auto_illustrator_standalone';

/**
 * Builds the standalone folder name.
 * Format: auto_illustrator_standalone or auto_illustrator_standalone_{label}
 */
function getStandaloneFolderName(): string {
  const input = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_SUBFOLDER_LABEL
  ) as HTMLInputElement | null;
  const label = input?.value?.trim();
  if (label) {
    return `${STANDALONE_FOLDER_PREFIX}_${label}`;
  }
  return STANDALONE_FOLDER_PREFIX;
}

/**
 * Generates a single image with standalone folder override.
 * Uses fullOverride to replace ch_name entirely (no CharName prefix).
 * Restores the original label after generation.
 */
async function generateImageWithStandaloneFolder(
  prompt: string,
  context: SillyTavernContext,
  settings: AutoIllustratorSettings
): Promise<string | null> {
  const folderName = getStandaloneFolderName();

  // Save original label from metadata if available
  let originalLabel: string | null = null;
  try {
    const {getMetadata} = await import('./metadata');
    const metadata = getMetadata();
    originalLabel = metadata.imageSubfolderLabel ?? null;
  } catch {
    // No active chat — no original label to restore
  }

  // Set standalone folder with full override (replaces ch_name entirely)
  setImageSubfolderLabel(folderName, true);

  try {
    return await generateImage(
      prompt,
      context,
      settings.commonStyleTags,
      settings.commonStyleTagsPosition
    );
  } finally {
    // Restore original label (normal mode, no full override)
    setImageSubfolderLabel(originalLabel);
  }
}

/**
 * Renders prompt result cards into the results container.
 */
function renderPromptCards(
  results: StandalonePromptResult[],
  container: HTMLElement
): void {
  container.innerHTML = '';
  container.style.display = 'block';

  const statusDiv = document.createElement('div');
  statusDiv.className = 'standalone-status';
  statusDiv.textContent = t('standalone.promptsGenerated', {
    count: String(results.length),
  });
  container.appendChild(statusDiv);

  results.forEach((result, index) => {
    const card = document.createElement('div');
    card.className = 'standalone-prompt-card';
    card.dataset.index = String(index);

    const textarea = document.createElement('textarea');
    textarea.className = 'text_pole textarea_compact';
    textarea.rows = 3;
    textarea.value = result.text;
    card.appendChild(textarea);

    if (result.reasoning) {
      const reasoning = document.createElement('div');
      reasoning.className = 'standalone-reasoning';
      reasoning.textContent = `${t('standalone.reasoning')}: ${result.reasoning}`;
      card.appendChild(reasoning);
    }

    const actions = document.createElement('div');
    actions.className = 'standalone-card-actions';

    const genBtn = document.createElement('button');
    genBtn.className = 'menu_button standalone-card-gen-btn';
    genBtn.innerHTML = `<i class="fa-solid fa-image"></i> ${t('standalone.generateImage')}`;
    genBtn.dataset.cardIndex = String(index);
    actions.appendChild(genBtn);

    card.appendChild(actions);

    const imageContainer = document.createElement('div');
    imageContainer.className = 'standalone-image-container';
    card.appendChild(imageContainer);

    container.appendChild(card);
  });

  // Show batch action buttons
  const generateAllBtn = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_GENERATE_ALL_BTN
  );
  const clearBtn = document.getElementById(UI_ELEMENT_IDS.STANDALONE_CLEAR_BTN);
  if (generateAllBtn) generateAllBtn.style.display = '';
  if (clearBtn) clearBtn.style.display = '';
}

/**
 * Generates an image for a single prompt card.
 */
async function generateForCard(
  card: HTMLElement,
  context: SillyTavernContext,
  settings: AutoIllustratorSettings,
  sceneDescription: string
): Promise<void> {
  const textarea = card.querySelector('textarea') as HTMLTextAreaElement;
  const imageContainer = card.querySelector(
    '.standalone-image-container'
  ) as HTMLElement;
  const genBtn = card.querySelector(
    '.standalone-card-gen-btn'
  ) as HTMLButtonElement;

  if (!textarea || !imageContainer) return;

  let prompt = textarea.value.trim();
  if (!prompt) return;

  // Apply character fixed tags using scene description as context
  prompt = applyCharacterFixedTags(
    prompt,
    sceneDescription,
    settings.characterFixedTags
  );

  // Show loading state
  genBtn.disabled = true;
  imageContainer.innerHTML = `<div class="standalone-generating-spinner">${t('standalone.generatingImage')}</div>`;

  try {
    const imageUrl = await generateImageWithStandaloneFolder(
      prompt,
      context,
      settings
    );
    if (imageUrl) {
      imageContainer.innerHTML = `<img src="${imageUrl}" alt="Generated image" style="max-width: 100%; border-radius: 6px; cursor: pointer;" />`;
      // Click to open in new tab
      const img = imageContainer.querySelector('img');
      img?.addEventListener('click', () => {
        window.open(imageUrl, '_blank');
      });
    } else {
      const error = new AutoIllustratorError(
        'image-empty-response',
        'Image generation returned no image'
      );
      renderStandaloneError(imageContainer, 'standalone.imageFailed');
      showStandaloneToast(
        'toast.standaloneImageGenerationFailedWithReason',
        error
      );
    }
  } catch (error) {
    logger.error('Standalone image generation failed:', error);
    renderStandaloneError(imageContainer, 'standalone.imageFailed');
    showStandaloneToast(
      'toast.standaloneImageGenerationFailedWithReason',
      error
    );
  } finally {
    genBtn.disabled = false;
  }
}

/**
 * Initializes all event listeners for the standalone generation panel.
 */
export function initializeStandaloneGeneration(
  context: SillyTavernContext,
  settings: AutoIllustratorSettings,
  metadata: AutoIllustratorChatMetadata | undefined
): void {
  if (standaloneGenerationInitialized) {
    logger.debug('Standalone generation panel already initialized, skipping');
    return;
  }

  const aiRadio = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_MODE_AI
  ) as HTMLInputElement;
  const manualRadio = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_MODE_MANUAL
  ) as HTMLInputElement;
  const aiPanel = document.getElementById('standalone_ai_panel');
  const manualPanel = document.getElementById('standalone_manual_panel');
  const subfolderLabelInput = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_SUBFOLDER_LABEL
  ) as HTMLInputElement | null;

  if (subfolderLabelInput) {
    try {
      subfolderLabelInput.value =
        localStorage.getItem(STANDALONE_SUBFOLDER_STORAGE_KEY) ?? '';
    } catch (error) {
      logger.debug('Failed to restore standalone subfolder label', error);
    }

    const persistSubfolderLabel = () => {
      try {
        const value = subfolderLabelInput.value.trim();
        if (value) {
          localStorage.setItem(STANDALONE_SUBFOLDER_STORAGE_KEY, value);
        } else {
          localStorage.removeItem(STANDALONE_SUBFOLDER_STORAGE_KEY);
        }
      } catch (error) {
        logger.debug('Failed to persist standalone subfolder label', error);
      }
    };

    subfolderLabelInput.addEventListener('input', persistSubfolderLabel);
    subfolderLabelInput.addEventListener('change', persistSubfolderLabel);
  }

  // Mode switching
  const switchMode = () => {
    if (!aiPanel || !manualPanel) return;
    if (aiRadio?.checked) {
      aiPanel.style.display = '';
      manualPanel.style.display = 'none';
    } else {
      aiPanel.style.display = 'none';
      manualPanel.style.display = '';
    }
  };
  aiRadio?.addEventListener('change', switchMode);
  manualRadio?.addEventListener('change', switchMode);

  // Track current prompts for batch operations
  let currentResults: StandalonePromptResult[] = [];

  // Helper to get scene description
  const getSceneDescription = (): string => {
    const input = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_SCENE_INPUT
    ) as HTMLTextAreaElement;
    return input?.value?.trim() || '';
  };

  // Helper to get options
  const getOptions = () => {
    const countInput = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_PROMPT_COUNT
    ) as HTMLInputElement;
    const charCheckbox = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_INCLUDE_CHAR_INFO
    ) as HTMLInputElement;
    const worldCheckbox = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_INCLUDE_WORLD_INFO
    ) as HTMLInputElement;
    return {
      promptCount: parseInt(countInput?.value || '3', 10),
      includeCharInfo: charCheckbox?.checked ?? true,
      includeWorldInfo: worldCheckbox?.checked ?? true,
    };
  };

  // Generate Prompts button
  const generatePromptsBtn = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_GENERATE_PROMPTS_BTN
  );
  generatePromptsBtn?.addEventListener('click', async () => {
    const scene = getSceneDescription();
    if (!scene) {
      toastr.warning(t('standalone.noSceneDescription'), t('extensionName'));
      return;
    }

    const opts = getOptions();
    const resultsContainer = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_RESULTS
    );
    if (!resultsContainer) return;

    // Show loading
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `<div class="standalone-generating-spinner">${t('standalone.generatingPrompts')}</div>`;
    (generatePromptsBtn as HTMLButtonElement).disabled = true;

    try {
      currentResults = await generateStandalonePrompts(
        scene,
        opts.promptCount,
        opts.includeCharInfo,
        opts.includeWorldInfo,
        context,
        settings,
        metadata
      );

      if (currentResults.length > 0) {
        renderPromptCards(currentResults, resultsContainer);
        // Bind individual card generate buttons
        bindCardGenerateButtons(resultsContainer, context, settings, scene);
      } else {
        const error = new AutoIllustratorError(
          'no-valid-prompts',
          'Standalone LLM returned no valid prompts'
        );
        renderStandaloneError(resultsContainer, 'standalone.promptFailed');
        showStandaloneToast(
          'toast.standalonePromptGenerationFailedWithReason',
          error
        );
      }
    } catch (error) {
      logger.error('Failed to generate standalone prompts:', error);
      renderStandaloneError(resultsContainer, 'standalone.promptFailed');
      showStandaloneToast(
        'toast.standalonePromptGenerationFailedWithReason',
        error
      );
    } finally {
      (generatePromptsBtn as HTMLButtonElement).disabled = false;
    }
  });

  // Auto Generate button (generate prompts + images in one go)
  const autoBtn = document.getElementById(UI_ELEMENT_IDS.STANDALONE_AUTO_BTN);
  autoBtn?.addEventListener('click', async () => {
    const scene = getSceneDescription();
    if (!scene) {
      toastr.warning(t('standalone.noSceneDescription'), t('extensionName'));
      return;
    }

    const opts = getOptions();
    const resultsContainer = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_RESULTS
    );
    if (!resultsContainer) return;

    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `<div class="standalone-generating-spinner">${t('standalone.generatingPrompts')}</div>`;
    (autoBtn as HTMLButtonElement).disabled = true;

    try {
      currentResults = await generateStandalonePrompts(
        scene,
        opts.promptCount,
        opts.includeCharInfo,
        opts.includeWorldInfo,
        context,
        settings,
        metadata
      );

      if (currentResults.length > 0) {
        renderPromptCards(currentResults, resultsContainer);
        bindCardGenerateButtons(resultsContainer, context, settings, scene);

        // Auto-generate images for all cards
        const cards = Array.from(
          resultsContainer.querySelectorAll('.standalone-prompt-card')
        );
        for (const card of cards) {
          await generateForCard(card as HTMLElement, context, settings, scene);
        }
      } else {
        const error = new AutoIllustratorError(
          'no-valid-prompts',
          'Standalone LLM returned no valid prompts'
        );
        renderStandaloneError(resultsContainer, 'standalone.promptFailed');
        showStandaloneToast(
          'toast.standalonePromptGenerationFailedWithReason',
          error
        );
      }
    } catch (error) {
      logger.error('Auto generate failed:', error);
      renderStandaloneError(resultsContainer, 'standalone.promptFailed');
      showStandaloneToast(
        'toast.standalonePromptGenerationFailedWithReason',
        error
      );
    } finally {
      (autoBtn as HTMLButtonElement).disabled = false;
    }
  });

  // Generate All button
  const generateAllBtn = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_GENERATE_ALL_BTN
  );
  generateAllBtn?.addEventListener('click', async () => {
    const scene = getSceneDescription();
    const resultsContainer = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_RESULTS
    );
    if (!resultsContainer) return;

    const cards = Array.from(
      resultsContainer.querySelectorAll('.standalone-prompt-card')
    );
    for (const card of cards) {
      await generateForCard(card as HTMLElement, context, settings, scene);
    }
  });

  // Clear button
  const clearBtn = document.getElementById(UI_ELEMENT_IDS.STANDALONE_CLEAR_BTN);
  clearBtn?.addEventListener('click', () => {
    const resultsContainer = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_RESULTS
    );
    if (resultsContainer) {
      resultsContainer.innerHTML = '';
      resultsContainer.style.display = 'none';
    }
    currentResults = [];
    const generateAllBtnEl = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_GENERATE_ALL_BTN
    );
    const clearBtnEl = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_CLEAR_BTN
    );
    if (generateAllBtnEl) generateAllBtnEl.style.display = 'none';
    if (clearBtnEl) clearBtnEl.style.display = 'none';
  });

  // Manual mode generate button
  const manualGenBtn = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_MANUAL_GENERATE_BTN
  );
  manualGenBtn?.addEventListener('click', async () => {
    const promptInput = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_MANUAL_PROMPT_INPUT
    ) as HTMLTextAreaElement;
    const imageContainer = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_MANUAL_IMAGE
    );
    let prompt = promptInput?.value?.trim();

    if (!prompt) {
      toastr.warning(t('standalone.noPrompt'), t('extensionName'));
      return;
    }

    if (!imageContainer) return;

    // In manual mode, use the prompt itself as messageText for character tag matching
    prompt = applyCharacterFixedTags(
      prompt,
      prompt,
      settings.characterFixedTags
    );

    (manualGenBtn as HTMLButtonElement).disabled = true;
    imageContainer.innerHTML = `<div class="standalone-generating-spinner">${t('standalone.generatingImage')}</div>`;

    try {
      const imageUrl = await generateImageWithStandaloneFolder(
        prompt,
        context,
        settings
      );
      if (imageUrl) {
        imageContainer.innerHTML = `<img src="${imageUrl}" alt="Generated image" style="max-width: 100%; border-radius: 6px; cursor: pointer;" />`;
        const img = imageContainer.querySelector('img');
        img?.addEventListener('click', () => {
          window.open(imageUrl, '_blank');
        });
      } else {
        const error = new AutoIllustratorError(
          'image-empty-response',
          'Image generation returned no image'
        );
        renderStandaloneError(imageContainer, 'standalone.imageFailed');
        showStandaloneToast(
          'toast.standaloneImageGenerationFailedWithReason',
          error
        );
      }
    } catch (error) {
      logger.error('Manual generation failed:', error);
      renderStandaloneError(imageContainer, 'standalone.imageFailed');
      showStandaloneToast(
        'toast.standaloneImageGenerationFailedWithReason',
        error
      );
    } finally {
      (manualGenBtn as HTMLButtonElement).disabled = false;
    }
  });

  logger.info('Standalone generation panel initialized');
  standaloneGenerationInitialized = true;
}

/**
 * Binds click handlers to individual card generate buttons.
 */
function bindCardGenerateButtons(
  container: HTMLElement,
  context: SillyTavernContext,
  settings: AutoIllustratorSettings,
  sceneDescription: string
): void {
  const buttons = container.querySelectorAll('.standalone-card-gen-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.standalone-prompt-card') as HTMLElement;
      if (card) {
        await generateForCard(card, context, settings, sceneDescription);
      }
    });
  });
}
