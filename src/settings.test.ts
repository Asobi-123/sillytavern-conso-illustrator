import {describe, it, expect, beforeEach, vi} from 'vitest';
import {createMockContext} from './test_helpers';
import {
  getDefaultSettings,
  loadSettings,
  saveSettings,
  EXTENSION_NAME,
  createSettingsUI,
} from './settings';
import {UI_SECTION_IDS, UI_ELEMENT_IDS, VIBE_TRANSFER} from './constants';

describe('settings', () => {
  describe('createSettingsUI', () => {
    it('should render the floating panel source container with core sections', () => {
      const html = createSettingsUI();

      expect(html).toContain(UI_SECTION_IDS.FLOATING_PANEL_SOURCE);
      expect(html).toContain(UI_SECTION_IDS.MAIN_ENABLED);
      expect(html).toContain(UI_SECTION_IDS.PROMPT_MODE_SELECTOR);
      expect(html).toContain(UI_SECTION_IDS.MAIN_REGEX);
      expect(html).toContain(UI_SECTION_IDS.MAIN_VIBE_TRANSFER);
      expect(html).toContain(UI_SECTION_IDS.VIBE_MANAGER);
      expect(html).toContain(UI_SECTION_IDS.SHARED_META_DISPLAY);
      expect(html).toContain(UI_SECTION_IDS.STANDALONE);
      expect(html).toContain(UI_ELEMENT_IDS.ENABLED);
      expect(html).toContain(UI_ELEMENT_IDS.REGEX_MASTER);
      expect(html).toContain(UI_ELEMENT_IDS.REGEX_SYNC);
      expect(html).toContain(UI_ELEMENT_IDS.IMAGE_SUBFOLDER_LABEL);
      expect(html).toContain(UI_ELEMENT_IDS.GENERATION_STYLE_PRESET_SELECT);
      expect(html).toContain(UI_ELEMENT_IDS.GENERATION_STYLE_PRESET_SAVE);
      expect(html).toContain('settings.vibeTransferHelpTitle');
      expect(html).toContain('settings.vibeTransferDeleteSelected');
    });
  });

  describe('getDefaultSettings', () => {
    it('should return default settings with correct values', () => {
      const defaults = getDefaultSettings();

      expect(defaults.enabled).toBe(true);
      expect(defaults.metaPrompt).toBeTruthy();
      expect(typeof defaults.metaPrompt).toBe('string');
      expect(defaults.currentPresetId).toBe('default');
      expect(Array.isArray(defaults.customPresets)).toBe(true);
      expect(defaults.customPresets).toEqual([]);
      expect(defaults.showGalleryWidget).toBe(true);
      expect(defaults.showProgressWidget).toBe(true);
      expect(defaults.showStreamingPreviewWidget).toBe(false);
      expect(defaults.promptGenerationMode).toBe('shared-api');
      expect(defaults.maxPromptsPerMessage).toBe(5);
      expect(defaults.standalonePromptCount).toBe(3);
      expect(defaults.llmFrequencyGuidelines).toBeTruthy();
      expect(defaults.llmPromptWritingGuidelines).toBeTruthy();
    });

    it('should return fresh array and object instances on each call', () => {
      const defaultsA = getDefaultSettings();
      const defaultsB = getDefaultSettings();

      expect(defaultsA.customPresets).not.toBe(defaultsB.customPresets);
      expect(defaultsA.customIndependentLlmPresets).not.toBe(
        defaultsB.customIndependentLlmPresets
      );
      expect(defaultsA.apiProfiles).not.toBe(defaultsB.apiProfiles);
      expect(defaultsA.characterFixedTags).not.toBe(
        defaultsB.characterFixedTags
      );
      expect(defaultsA.promptDetectionPatterns).not.toBe(
        defaultsB.promptDetectionPatterns
      );
      expect(defaultsA.contentFilterTags).not.toBe(defaultsB.contentFilterTags);
      expect(defaultsA.promptLibraryEntries).not.toBe(
        defaultsB.promptLibraryEntries
      );
      expect(defaultsA.generationStylePresets).not.toBe(
        defaultsB.generationStylePresets
      );
      expect(defaultsA.sdStylePoolWhitelist).not.toBe(
        defaultsB.sdStylePoolWhitelist
      );
      expect(defaultsA.vibeCombinationPoolWhitelist).not.toBe(
        defaultsB.vibeCombinationPoolWhitelist
      );
      expect(defaultsA.vibeTransferLibraryItems).not.toBe(
        defaultsB.vibeTransferLibraryItems
      );
      expect(defaultsA.vibeTransferCombinations).not.toBe(
        defaultsB.vibeTransferCombinations
      );
      expect(defaultsA.vibeTransferReferenceImages).not.toBe(
        defaultsB.vibeTransferReferenceImages
      );
    });
  });

  describe('loadSettings', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should load existing settings from context', () => {
      const existingSettings: AutoIllustratorSettings = {
        ...getDefaultSettings(),
        enabled: false,
        metaPrompt: 'custom prompt',
        currentPresetId: 'custom-123',
        customPresets: [],
        streamingPollInterval: 500,
        maxConcurrentGenerations: 2,
        minGenerationInterval: 100,
        monitorPollingInterval: 100,
        logLevel: 'debug',
        manualGenerationMode: 'append',
        promptDetectionPatterns: [],
        commonStyleTags: 'test, tags',
        commonStyleTagsPosition: 'suffix',
        showGalleryWidget: false,
        showProgressWidget: false,
        enableClickToRegenerate: true,
        promptGenerationMode: 'regex',
        maxPromptsPerMessage: 5,
        contextMessageCount: 10,
        llmFrequencyGuidelines: 'test frequency',
        llmPromptWritingGuidelines: 'test writing',
      };

      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: existingSettings,
        },
      });

      const loaded = loadSettings(mockContext);

      expect(loaded.enabled).toEqual(existingSettings.enabled);
      expect(loaded.currentPresetId).toEqual(existingSettings.currentPresetId);
      expect(loaded.customPresets).toEqual(existingSettings.customPresets);
      expect(loaded.showGalleryWidget).toEqual(
        existingSettings.showGalleryWidget
      );
      expect(loaded.showProgressWidget).toEqual(
        existingSettings.showProgressWidget
      );
    });

    it('should return defaults if no settings exist', () => {
      const mockContext = createMockContext({
        extensionSettings: {},
      });

      const loaded = loadSettings(mockContext);

      expect(loaded.enabled).toBe(true);
      expect(loaded.metaPrompt).toBeTruthy();
    });

    it('should write defaults to extensionSettings on first load', () => {
      const mockContext = createMockContext({
        extensionSettings: {},
      });

      const loaded = loadSettings(mockContext);

      // extensionSettings should now contain defaults so saveSettingsDebounced persists them
      expect(mockContext.extensionSettings[EXTENSION_NAME]).toBeDefined();
      expect(mockContext.extensionSettings[EXTENSION_NAME]).toEqual(loaded);
    });

    it('should merge partial settings with defaults', () => {
      const partialSettings = {
        enabled: false,
      };

      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: partialSettings,
        },
      });

      const loaded = loadSettings(mockContext);

      expect(loaded.enabled).toBe(false);
      expect(loaded.metaPrompt).toBeTruthy(); // Should use default
    });

    it('should clamp persisted numeric settings to safe ranges on load', () => {
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {
            imageRetentionDays: 999,
            independentLlmMaxTokens: 999999,
            standalonePromptCount: 999,
            imageDisplayWidth: -1,
            finalReconciliationDelayMs: 999999,
            promptLibraryMaxEntries: 1,
          },
        },
      });

      const loaded = loadSettings(mockContext);

      expect(loaded.imageRetentionDays).toBe(7);
      expect(loaded.independentLlmMaxTokens).toBe(32000);
      expect(loaded.standalonePromptCount).toBe(10);
      expect(loaded.imageDisplayWidth).toBe(10);
      expect(loaded.finalReconciliationDelayMs).toBe(30000);
      expect(loaded.promptLibraryMaxEntries).toBe(10);
    });

    it('should default random SD style settings to safe values when missing', () => {
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {},
        },
      });
      const loaded = loadSettings(mockContext);
      expect(loaded.randomizeSdStylePerGeneration).toBe(false);
      expect(loaded.generationStyleMode).toBe('off');
      expect(loaded.generationStylePresets).toEqual([]);
      expect(loaded.currentGenerationStylePresetId).toBe('');
      expect(loaded.fixedSdStyleName).toBe('');
      expect(loaded.fixedVibeCombinationId).toBe('');
      expect(loaded.sdStylePoolWhitelist).toEqual([]);
      expect(loaded.restoreSdStyleAfter).toBe(true);
      expect(loaded.randomizeVibeCombinationPerGeneration).toBe(false);
      expect(loaded.vibeCombinationPoolWhitelist).toEqual([]);
    });

    it('should round-trip random SD style settings', () => {
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {
            randomizeSdStylePerGeneration: true,
            sdStylePoolWhitelist: ['Style A', 'Style B'],
            restoreSdStyleAfter: false,
          },
        },
      });
      const loaded = loadSettings(mockContext);
      expect(loaded.randomizeSdStylePerGeneration).toBe(true);
      expect(loaded.generationStyleMode).toBe('random');
      expect(loaded.sdStylePoolWhitelist).toEqual(['Style A', 'Style B']);
      expect(loaded.restoreSdStyleAfter).toBe(false);
    });

    it('should round-trip fixed generation style settings', () => {
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {
            generationStyleMode: 'fixed',
            fixedSdStyleName: 'Style A',
            fixedVibeCombinationId: 'combo1',
            vibeTransferLibraryItems: [
              {
                id: 'item1',
                name: 'Item 1',
                enabled: true,
                tags: [],
                createdAt: 1,
                updatedAt: 1,
                encodings: {},
              },
            ],
            vibeTransferCombinations: [
              {
                id: 'combo1',
                name: 'Combo 1',
                itemIds: ['item1'],
                createdAt: 1,
                updatedAt: 1,
              },
            ],
          },
        },
      });
      const loaded = loadSettings(mockContext);
      expect(loaded.generationStyleMode).toBe('fixed');
      expect(loaded.fixedSdStyleName).toBe('Style A');
      expect(loaded.fixedVibeCombinationId).toBe('combo1');
      expect(loaded.generationStylePresets).toHaveLength(1);
      expect(loaded.generationStylePresets[0]).toMatchObject({
        name: 'Fixed combination',
        sdStyleName: 'Style A',
        vibeCombinationId: 'combo1',
      });
      expect(loaded.currentGenerationStylePresetId).toBe(
        loaded.generationStylePresets[0].id
      );
    });

    it('round-trips saved generation style presets', () => {
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {
            generationStyleMode: 'fixed',
            generationStylePresets: [
              {
                id: 'style-combo-1',
                name: 'Oil + aaa',
                sdStyleName: 'Oil Style',
                vibeCombinationId: 'combo1',
                createdAt: 1,
                updatedAt: 2,
              },
            ],
            currentGenerationStylePresetId: 'style-combo-1',
            fixedSdStyleName: '',
            fixedVibeCombinationId: '',
          },
        },
      });
      const loaded = loadSettings(mockContext);
      expect(loaded.generationStylePresets).toEqual([
        {
          id: 'style-combo-1',
          name: 'Oil + aaa',
          sdStyleName: 'Oil Style',
          vibeCombinationId: 'combo1',
          createdAt: 1,
          updatedAt: 2,
        },
      ]);
      expect(loaded.currentGenerationStylePresetId).toBe('style-combo-1');
    });

    it('should round-trip random Vibe combination settings and drop deleted IDs', () => {
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {
            randomizeVibeCombinationPerGeneration: true,
            vibeCombinationPoolWhitelist: ['combo1', 'deleted'],
            vibeTransferLibraryItems: [
              {
                id: 'item1',
                name: 'Item 1',
                enabled: true,
                tags: [],
                createdAt: 1,
                updatedAt: 1,
                encodings: {},
              },
            ],
            vibeTransferCombinations: [
              {
                id: 'combo1',
                name: 'Combo 1',
                itemIds: ['item1'],
                createdAt: 1,
                updatedAt: 1,
              },
            ],
          },
        },
      });

      const loaded = loadSettings(mockContext);

      expect(loaded.randomizeVibeCombinationPerGeneration).toBe(true);
      expect(loaded.generationStyleMode).toBe('random');
      expect(loaded.vibeCombinationPoolWhitelist).toEqual(['combo1']);
    });

    it('should sanitize custom tag bridge trigger overrides on load', () => {
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {
            customTagBridgeTriggers: {
              hair_ornament: [' 发饰 ', '', '头饰', '发饰'],
              bad: 'not-array',
            },
          },
        },
      });

      const loaded = loadSettings(mockContext);

      expect(loaded.customTagBridgeTriggers).toEqual({
        hair_ornament: ['发饰', '头饰'],
      });
    });

    it('should sanitize Vibe Transfer fields on load', () => {
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {
            ...getDefaultSettings(),
            vibeTransferEnabled: 'yes',
            vibeTransferReferenceImages: [
              {
                id: 'ref1',
                name: 'ref.png',
                dataUrl: 'data:image/png;base64,AAAA',
                tags: [' cyber ', '', 'blue', 'cyber', 123],
                addedAt: 1,
                encodedVibes: [
                  {
                    model: 'nai-diffusion-4-5-full',
                    informationExtracted: 1,
                    sourceFingerprint: 'abc',
                    encoded: 'ENCODED',
                    createdAt: 2,
                  },
                  {bad: 'cache'},
                ],
              },
              {id: 'bad'},
            ],
            vibeTransferPresets: [
              {
                id: 'preset1',
                name: 'Style A',
                referenceIds: ['ref1', 'missing'],
                createdAt: 1,
                updatedAt: 1,
              },
            ],
            currentVibeTransferPresetId: 'preset1',
            vibeTransferReferenceStrength: 9,
            vibeTransferInformationExtracted: -2,
          },
        },
      });
      const loaded = loadSettings(mockContext);

      expect(loaded.vibeTransferEnabled).toBe(false);
      expect(loaded.vibeTransferReferenceImages).toHaveLength(1);
      expect(loaded.vibeTransferReferenceImages[0].enabled).toBe(true);
      expect(loaded.vibeTransferReferenceImages[0].tags).toEqual([
        'cyber',
        'blue',
      ]);
      expect(loaded.vibeTransferReferenceImages[0].encodedVibes).toHaveLength(
        1
      );
      expect(loaded.vibeTransferPresets).toHaveLength(1);
      expect(loaded.vibeTransferPresets[0].referenceIds).toEqual(['ref1']);
      expect(loaded.currentVibeTransferPresetId).toBe('preset1');
      expect(loaded.vibeTransferLibraryItems).toHaveLength(1);
      expect(loaded.vibeTransferLibraryItems[0]).toMatchObject({
        id: 'ref1',
        legacyReferenceId: 'ref1',
        encodings: {
          'v4-5full': {
            unknown: {
              encoding: 'ENCODED',
              params: {information_extracted: 1},
            },
          },
        },
        generation: {
          inheritGlobalStrength: false,
          strength: 1,
          inheritGlobalInformationExtracted: false,
          information_extracted: 0,
        },
      });
      expect(loaded.vibeTransferCombinations).toHaveLength(1);
      expect(loaded.vibeTransferCombinations[0]).toMatchObject({
        id: 'preset1',
        itemIds: ['ref1'],
        legacyPresetId: 'preset1',
      });
      expect(loaded.currentVibeTransferCombinationId).toBe('preset1');
      expect(loaded.vibeTransferReferenceStrength).toBe(1);
      expect(loaded.vibeTransferInformationExtracted).toBe(0);
    });

    it('should sanitize bundle-compatible Vibe library fields on load', () => {
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {
            ...getDefaultSettings(),
            vibeTransferManagerEditMode: true,
            vibeTransferManagerFilter: 'pending',
            vibeTransferLibraryItems: [
              {
                id: 'item1',
                externalId: 'external1',
                name: 'Bundle Item',
                enabled: 'bad',
                tags: [' oil ', 'oil', 123],
                createdAt: 1,
                updatedAt: 2,
                source: {
                  dataUrl: 'data:image/jpeg;base64,AAAA',
                  fingerprint: 'abc',
                  mimeType: 'image/jpeg',
                },
                previewImage: 'data:image/jpeg;base64,AAAA',
                encodings: {
                  'v4-5full': {
                    unknown: {
                      encoding: 'ENCODED',
                      params: {information_extracted: 3},
                    },
                  },
                },
                importInfo: {
                  model: 'nai-diffusion-4-5-full',
                  information_extracted: -1,
                  strength: 2,
                  externalId: 'external1',
                  sourceName: 'bundle.json',
                  importedAt: 3,
                },
                generation: {
                  inheritGlobalStrength: false,
                  strength: 2,
                  inheritGlobalInformationExtracted: false,
                  information_extracted: -1,
                },
              },
              {id: 'bad'},
            ],
            vibeTransferCombinations: [
              {
                id: 'combo1',
                name: 'Combo',
                itemIds: ['item1', 'missing'],
                referenceStrength: 2,
                informationExtracted: -1,
                itemGenerations: {
                  item1: {
                    inheritGlobalStrength: false,
                    strength: 0.4,
                    inheritGlobalInformationExtracted: false,
                    information_extracted: 0.8,
                  },
                  missing: {
                    strength: 0.2,
                  },
                },
                createdAt: 1,
                updatedAt: 1,
              },
            ],
            currentVibeTransferCombinationId: 'combo1',
          },
        },
      });

      const loaded = loadSettings(mockContext);

      expect(loaded.vibeTransferManagerEditMode).toBe(true);
      expect(loaded.vibeTransferManagerView).toBe('pending');
      expect(loaded.vibeTransferManagerFilter).toBeUndefined();
      expect(loaded.vibeTransferLibraryItems).toHaveLength(1);
      expect(loaded.vibeTransferLibraryItems[0]).toMatchObject({
        id: 'item1',
        enabled: true,
        tags: ['oil'],
        encodings: {
          'v4-5full': {
            unknown: {
              encoding: 'ENCODED',
              params: {information_extracted: 1},
            },
          },
        },
        importInfo: {
          information_extracted: 0,
          strength: 1,
        },
        generation: {
          inheritGlobalStrength: false,
          strength: 1,
          inheritGlobalInformationExtracted: false,
          information_extracted: 0,
        },
      });
      expect(loaded.vibeTransferCombinations[0].itemIds).toEqual(['item1']);
      expect(loaded.vibeTransferCombinations[0]).toMatchObject({
        referenceStrength: 1,
        informationExtracted: 0,
        itemGenerations: {
          item1: {
            inheritGlobalStrength: false,
            strength: 0.4,
            inheritGlobalInformationExtracted: false,
            information_extracted: 0.8,
          },
        },
      });
      expect(loaded.currentVibeTransferCombinationId).toBe('combo1');
    });

    it('should migrate missing per-vibe parameters from legacy global values', () => {
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {
            ...getDefaultSettings(),
            vibeTransferReferenceStrength: 0.35,
            vibeTransferInformationExtracted: 0.65,
            vibeTransferLibraryItems: [
              {
                id: 'item1',
                name: 'Legacy Item',
                enabled: true,
                tags: [],
                createdAt: 1,
                updatedAt: 1,
                source: {
                  dataUrl: 'data:image/jpeg;base64,AAAA',
                },
                encodings: {},
              },
            ],
          },
        },
      });

      const loaded = loadSettings(mockContext);

      expect(loaded.vibeTransferLibraryItems[0].generation).toMatchObject({
        inheritGlobalStrength: false,
        strength: 0.35,
        inheritGlobalInformationExtracted: false,
        information_extracted: 0.65,
      });
    });

    it('should cap persisted Vibe Transfer references on load', () => {
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {
            ...getDefaultSettings(),
            vibeTransferReferenceImages: Array.from(
              {length: VIBE_TRANSFER.MAX_REFERENCES + 3},
              (_value, index) => ({
                id: `ref${index}`,
                name: `ref${index}.png`,
                dataUrl: 'data:image/png;base64,AAAA',
                tags: [],
                addedAt: index,
              })
            ),
          },
        },
      });
      const loaded = loadSettings(mockContext);

      expect(loaded.vibeTransferReferenceImages).toHaveLength(
        VIBE_TRANSFER.MAX_REFERENCES
      );
      expect(loaded.vibeTransferLibraryItems).toHaveLength(
        VIBE_TRANSFER.MAX_REFERENCES
      );
    });
  });

  describe('saveSettings', () => {
    it('should save settings to context and call saveSettingsDebounced', () => {
      const mockSaveDebounced = vi.fn();
      const mockContext = createMockContext({
        extensionSettings: {},
        saveSettingsDebounced: mockSaveDebounced,
      });

      const settings: AutoIllustratorSettings = {
        ...getDefaultSettings(),
        enabled: true,
        metaPrompt: 'test prompt',
        currentPresetId: 'default',
        customPresets: [],
        streamingPollInterval: 300,
        maxConcurrentGenerations: 1,
        minGenerationInterval: 0,
        monitorPollingInterval: 100,
        logLevel: 'info',
        manualGenerationMode: 'replace',
        promptDetectionPatterns: [],
        commonStyleTags: '',
        commonStyleTagsPosition: 'prefix',
        showGalleryWidget: true,
        showProgressWidget: true,
        enableClickToRegenerate: true,
        promptGenerationMode: 'regex',
        maxPromptsPerMessage: 5,
        contextMessageCount: 10,
        llmFrequencyGuidelines: '',
        llmPromptWritingGuidelines: '',
      };

      saveSettings(settings, mockContext);

      expect(mockContext.extensionSettings[EXTENSION_NAME]).toEqual(settings);
      expect(mockSaveDebounced).toHaveBeenCalled();
    });

    it('should update existing settings', () => {
      const mockSaveDebounced = vi.fn();
      const mockContext = createMockContext({
        extensionSettings: {
          [EXTENSION_NAME]: {
            enabled: true,
            metaPrompt: 'old',
          },
        },
        saveSettingsDebounced: mockSaveDebounced,
      });

      const newSettings: AutoIllustratorSettings = {
        ...getDefaultSettings(),
        enabled: false,
        metaPrompt: 'new',
        currentPresetId: 'custom-456',
        customPresets: [],
        streamingPollInterval: 500,
        maxConcurrentGenerations: 2,
        minGenerationInterval: 100,
        monitorPollingInterval: 100,
        logLevel: 'warn',
        manualGenerationMode: 'append',
        promptDetectionPatterns: [],
        commonStyleTags: '',
        commonStyleTagsPosition: 'prefix',
        showGalleryWidget: false,
        showProgressWidget: false,
        enableClickToRegenerate: true,
        promptGenerationMode: 'llm-post',
        maxPromptsPerMessage: 3,
        contextMessageCount: 15,
        llmFrequencyGuidelines: 'new frequency',
        llmPromptWritingGuidelines: 'new writing',
      };

      saveSettings(newSettings, mockContext);

      expect(mockContext.extensionSettings[EXTENSION_NAME]).toEqual(
        newSettings
      );
      expect(mockSaveDebounced).toHaveBeenCalled();
    });

    it('should handle widget visibility settings correctly', () => {
      const mockSaveDebounced = vi.fn();
      const mockContext = createMockContext({
        extensionSettings: {},
        saveSettingsDebounced: mockSaveDebounced,
      });

      const settingsGalleryOnly: Partial<AutoIllustratorSettings> = {
        showGalleryWidget: true,
        showProgressWidget: false,
      };

      const settingsProgressOnly: Partial<AutoIllustratorSettings> = {
        showGalleryWidget: false,
        showProgressWidget: true,
      };

      const settingsNone: Partial<AutoIllustratorSettings> = {
        showGalleryWidget: false,
        showProgressWidget: false,
      };

      // Test each combination
      const defaults = getDefaultSettings();

      saveSettings({...defaults, ...settingsGalleryOnly}, mockContext);
      expect(
        mockContext.extensionSettings[EXTENSION_NAME].showGalleryWidget
      ).toBe(true);
      expect(
        mockContext.extensionSettings[EXTENSION_NAME].showProgressWidget
      ).toBe(false);

      saveSettings({...defaults, ...settingsProgressOnly}, mockContext);
      expect(
        mockContext.extensionSettings[EXTENSION_NAME].showGalleryWidget
      ).toBe(false);
      expect(
        mockContext.extensionSettings[EXTENSION_NAME].showProgressWidget
      ).toBe(true);

      saveSettings({...defaults, ...settingsNone}, mockContext);
      expect(
        mockContext.extensionSettings[EXTENSION_NAME].showGalleryWidget
      ).toBe(false);
      expect(
        mockContext.extensionSettings[EXTENSION_NAME].showProgressWidget
      ).toBe(false);
    });

    it('should handle prompt generation mode correctly', () => {
      const mockSaveDebounced = vi.fn();
      const mockContext = createMockContext({
        extensionSettings: {},
        saveSettingsDebounced: mockSaveDebounced,
      });

      const defaults = getDefaultSettings();

      // Test regex mode (default)
      const regexSettings = {
        ...defaults,
        promptGenerationMode: 'regex' as const,
      };
      saveSettings(regexSettings, mockContext);
      expect(
        mockContext.extensionSettings[EXTENSION_NAME].promptGenerationMode
      ).toBe('regex');

      // Test LLM mode
      const llmSettings = {
        ...defaults,
        promptGenerationMode: 'llm-post' as const,
      };
      saveSettings(llmSettings, mockContext);
      expect(
        mockContext.extensionSettings[EXTENSION_NAME].promptGenerationMode
      ).toBe('llm-post');
    });

    it('should save LLM guidelines correctly', () => {
      const mockSaveDebounced = vi.fn();
      const mockContext = createMockContext({
        extensionSettings: {},
        saveSettingsDebounced: mockSaveDebounced,
      });

      const defaults = getDefaultSettings();
      const customGuidelines = {
        ...defaults,
        llmFrequencyGuidelines: 'Custom frequency guidelines',
        llmPromptWritingGuidelines: 'Custom writing guidelines',
      };

      saveSettings(customGuidelines, mockContext);

      expect(
        mockContext.extensionSettings[EXTENSION_NAME].llmFrequencyGuidelines
      ).toBe('Custom frequency guidelines');
      expect(
        mockContext.extensionSettings[EXTENSION_NAME].llmPromptWritingGuidelines
      ).toBe('Custom writing guidelines');
    });
  });
});
