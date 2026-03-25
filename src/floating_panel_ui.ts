import {UI_ELEMENT_IDS, UI_SECTION_IDS, EXTENSION_NAME} from './constants';
import {t} from './i18n';
import {createLogger} from './logger';
import {getGalleryWidget, initializeGalleryWidget} from './gallery_widget';
import {progressManager} from './progress_manager';

const logger = createLogger('FloatingPanel');

const ROOT_ID = 'auto_illustrator_conso_floating_panel_root';
const STYLE_ID = 'auto_illustrator_conso_floating_panel_style';
const THEME_STORAGE_KEY = `${EXTENSION_NAME}_floating_panel_theme`;
const POSITION_STORAGE_KEY = `${EXTENSION_NAME}_floating_panel_position`;

const SLOT_IDS = {
  mainEnabled: 'ai-floating-panel-slot-main-enabled',
  mainMode: 'ai-floating-panel-slot-main-mode',
  mainSubfolder: 'ai-floating-panel-slot-main-subfolder',
  mainInfo: 'ai-floating-panel-slot-main-info',
  sharedMeta: 'ai-floating-panel-slot-shared-meta',
  independentBase: 'ai-floating-panel-slot-independent-base',
  guidelines: 'ai-floating-panel-slot-guidelines',
  independentLlm: 'ai-floating-panel-slot-independent-llm',
  promptStyle: 'ai-floating-panel-slot-prompt-style',
  standalone: 'ai-floating-panel-slot-standalone',
  contextOverlay: 'ai-floating-panel-slot-context-overlay',
  worldOverlay: 'ai-floating-panel-slot-world-overlay',
  characterOverlay: 'ai-floating-panel-slot-character-overlay',
  gallery: 'ai-floating-panel-slot-gallery',
  promptLibrary: 'ai-floating-panel-slot-prompt-library',
} as const;

const PANEL_IDS = {
  launcher: 'ai-floating-panel-launcher',
  panel: 'ai-floating-panel',
  close: 'ai-floating-panel-close',
  mainPage: 'ai-floating-panel-page-main',
  promptPage: 'ai-floating-panel-page-prompt',
  galleryPage: 'ai-floating-panel-page-gallery',
  standalonePage: 'ai-floating-panel-page-standalone',
  promptLibraryPage: 'ai-floating-panel-page-prompt-library',
  sharedSection: 'ai-floating-panel-shared-section',
  independentSection: 'ai-floating-panel-independent-section',
  contextTogglePrompt: 'ai-floating-panel-context-toggle-prompt',
  contextToggleStandalone: 'ai-floating-panel-context-toggle-standalone',
  worldTogglePrompt: 'ai-floating-panel-world-toggle-prompt',
  worldToggleStandalone: 'ai-floating-panel-world-toggle-standalone',
  contextOverlay: 'ai-floating-panel-overlay-context',
  worldOverlay: 'ai-floating-panel-overlay-world',
  characterOverlay: 'ai-floating-panel-overlay-character',
  textOverlay: 'ai-floating-panel-overlay-text',
  textOverlayTitle: 'ai-floating-panel-text-overlay-title',
  textOverlayTextarea: 'ai-floating-panel-text-overlay-textarea',
  textOverlayApply: 'ai-floating-panel-text-overlay-apply',
} as const;

type PanelTheme =
  | 'slate'
  | 'graphite'
  | 'ocean'
  | 'amber'
  | 'mist'
  | 'ivory'
  | 'frost'
  | 'rose'
  | 'jade'
  | 'lavender'
  | 'citrus'
  | 'obsidian'
  | 'snow'
  | 'sapphire'
  | 'mocha'
  | 'sakura'
  | 'dusk';

const THEME_PRESETS: Record<PanelTheme, Record<string, string>> = {
  slate: {
    '--bg-top': '#10141b',
    '--bg-bottom': '#171d28',
    '--panel': '#202633',
    '--panel-2': '#2a3141',
    '--panel-3': '#323b4f',
    '--panel-soft': 'rgba(0, 0, 0, 0.08)',
    '--overlay-bg': 'rgba(20, 24, 32, 0.98)',
    '--field-bg': '#1a202b',
    '--line': '#465067',
    '--text': '#eef2f8',
    '--text-2': '#bcc5d8',
    '--text-3': '#8892a9',
    '--accent': '#7aaef5',
    '--accent-soft': 'rgba(122, 174, 245, 0.15)',
    '--switch-off': '#3f495e',
    '--switch-on': '#5f88c3',
    '--switch-knob': '#dfe6f6',
  },
  graphite: {
    '--bg-top': '#161616',
    '--bg-bottom': '#222222',
    '--panel': '#242424',
    '--panel-2': '#313131',
    '--panel-3': '#3b3b3b',
    '--panel-soft': 'rgba(0, 0, 0, 0.08)',
    '--overlay-bg': 'rgba(24, 24, 24, 0.98)',
    '--field-bg': '#1e1e1e',
    '--line': '#505050',
    '--text': '#f2f2f2',
    '--text-2': '#c7c7c7',
    '--text-3': '#989898',
    '--accent': '#a8b0bf',
    '--accent-soft': 'rgba(168, 176, 191, 0.16)',
    '--switch-off': '#4b4b4b',
    '--switch-on': '#7c8799',
    '--switch-knob': '#efefef',
  },
  ocean: {
    '--bg-top': '#0d1721',
    '--bg-bottom': '#152433',
    '--panel': '#152534',
    '--panel-2': '#1f3850',
    '--panel-3': '#274766',
    '--panel-soft': 'rgba(0, 0, 0, 0.08)',
    '--overlay-bg': 'rgba(14, 24, 36, 0.98)',
    '--field-bg': '#122330',
    '--line': '#3f607f',
    '--text': '#edf6ff',
    '--text-2': '#bfd4e9',
    '--text-3': '#86a3c0',
    '--accent': '#69b8ff',
    '--accent-soft': 'rgba(105, 184, 255, 0.16)',
    '--switch-off': '#38556e',
    '--switch-on': '#63a9e6',
    '--switch-knob': '#edf6ff',
  },
  amber: {
    '--bg-top': '#17130f',
    '--bg-bottom': '#241b14',
    '--panel': '#2a221b',
    '--panel-2': '#3a2d23',
    '--panel-3': '#47362a',
    '--panel-soft': 'rgba(0, 0, 0, 0.08)',
    '--overlay-bg': 'rgba(28, 21, 16, 0.98)',
    '--field-bg': '#211913',
    '--line': '#655242',
    '--text': '#f8efe7',
    '--text-2': '#dbc8b8',
    '--text-3': '#a78f7a',
    '--accent': '#e0a85f',
    '--accent-soft': 'rgba(224, 168, 95, 0.18)',
    '--switch-off': '#665243',
    '--switch-on': '#c98d4a',
    '--switch-knob': '#f7efe8',
  },
  mist: {
    '--bg-top': '#dfe6ee',
    '--bg-bottom': '#eef3f8',
    '--panel': '#dde3ec',
    '--panel-2': '#e8edf4',
    '--panel-3': '#f2f5f9',
    '--panel-soft': 'rgba(255, 255, 255, 0.65)',
    '--overlay-bg': 'rgba(236, 242, 248, 0.98)',
    '--field-bg': '#f7fafe',
    '--line': '#b6c1cf',
    '--text': '#243043',
    '--text-2': '#4d5c72',
    '--text-3': '#718197',
    '--accent': '#7a94c9',
    '--accent-soft': 'rgba(122, 148, 201, 0.18)',
    '--switch-off': '#b7c4d3',
    '--switch-on': '#7d97ca',
    '--switch-knob': '#ffffff',
  },
  ivory: {
    '--bg-top': '#efe6dc',
    '--bg-bottom': '#faf5ee',
    '--panel': '#f2eadf',
    '--panel-2': '#f7f0e6',
    '--panel-3': '#fbf6ef',
    '--panel-soft': 'rgba(255, 255, 255, 0.72)',
    '--overlay-bg': 'rgba(249, 243, 234, 0.98)',
    '--field-bg': '#fffaf4',
    '--line': '#d7c7b6',
    '--text': '#332a22',
    '--text-2': '#665546',
    '--text-3': '#8e7a68',
    '--accent': '#c48c52',
    '--accent-soft': 'rgba(196, 140, 82, 0.18)',
    '--switch-off': '#d3c2b0',
    '--switch-on': '#c69157',
    '--switch-knob': '#fffdf9',
  },
  frost: {
    '--bg-top': '#dceaf2',
    '--bg-bottom': '#f2f8fc',
    '--panel': '#d9e8f4',
    '--panel-2': '#e7f0f7',
    '--panel-3': '#f3f8fb',
    '--panel-soft': 'rgba(255, 255, 255, 0.68)',
    '--overlay-bg': 'rgba(240, 247, 252, 0.98)',
    '--field-bg': '#fbfeff',
    '--line': '#b4c9d7',
    '--text': '#20313f',
    '--text-2': '#466275',
    '--text-3': '#6f8b9d',
    '--accent': '#5d9fd6',
    '--accent-soft': 'rgba(93, 159, 214, 0.18)',
    '--switch-off': '#b8cedc',
    '--switch-on': '#659fd2',
    '--switch-knob': '#ffffff',
  },
  rose: {
    '--bg-top': '#1d1821',
    '--bg-bottom': '#2a202c',
    '--panel': '#3a2f3a',
    '--panel-2': '#4d3e4e',
    '--panel-3': '#5d4c5e',
    '--panel-soft': 'rgba(0, 0, 0, 0.08)',
    '--overlay-bg': 'rgba(37, 30, 38, 0.98)',
    '--field-bg': '#2d2430',
    '--line': '#756277',
    '--text': '#f6edf3',
    '--text-2': '#d7c1cd',
    '--text-3': '#af95a3',
    '--accent': '#d28faf',
    '--accent-soft': 'rgba(210, 143, 175, 0.18)',
    '--switch-off': '#69566a',
    '--switch-on': '#cf8dac',
    '--switch-knob': '#fff8fc',
  },
  jade: {
    '--bg-top': '#10201d',
    '--bg-bottom': '#17302b',
    '--panel': '#1d2e2a',
    '--panel-2': '#27423c',
    '--panel-3': '#30524b',
    '--panel-soft': 'rgba(0, 0, 0, 0.08)',
    '--overlay-bg': 'rgba(16, 33, 29, 0.98)',
    '--field-bg': '#152723',
    '--line': '#44685f',
    '--text': '#edf9f5',
    '--text-2': '#bad8d0',
    '--text-3': '#88aaa1',
    '--accent': '#6dc7b0',
    '--accent-soft': 'rgba(109, 199, 176, 0.18)',
    '--switch-off': '#43665f',
    '--switch-on': '#68c3ac',
    '--switch-knob': '#f2fffb',
  },
  lavender: {
    '--bg-top': '#171726',
    '--bg-bottom': '#222138',
    '--panel': '#25243b',
    '--panel-2': '#353357',
    '--panel-3': '#45426d',
    '--panel-soft': 'rgba(0, 0, 0, 0.08)',
    '--overlay-bg': 'rgba(25, 24, 40, 0.98)',
    '--field-bg': '#1d1c2f',
    '--line': '#605d86',
    '--text': '#f0eefc',
    '--text-2': '#c7c1e5',
    '--text-3': '#9890bd',
    '--accent': '#a89ae6',
    '--accent-soft': 'rgba(168, 154, 230, 0.18)',
    '--switch-off': '#57537e',
    '--switch-on': '#9f92df',
    '--switch-knob': '#fbfaff',
  },
  citrus: {
    '--bg-top': '#e7ead2',
    '--bg-bottom': '#f7f9ea',
    '--panel': '#eef0db',
    '--panel-2': '#f4f6e5',
    '--panel-3': '#fafbed',
    '--panel-soft': 'rgba(255, 255, 255, 0.72)',
    '--overlay-bg': 'rgba(245, 248, 232, 0.98)',
    '--field-bg': '#fffff6',
    '--line': '#c9cfb0',
    '--text': '#2b3220',
    '--text-2': '#586248',
    '--text-3': '#7f8967',
    '--accent': '#9bad57',
    '--accent-soft': 'rgba(155, 173, 87, 0.18)',
    '--switch-off': '#c5cda7',
    '--switch-on': '#93aa55',
    '--switch-knob': '#ffffff',
  },
  obsidian: {
    '--bg-top': '#0a0a0a',
    '--bg-bottom': '#111111',
    '--panel': '#161616',
    '--panel-2': '#1e1e1e',
    '--panel-3': '#262626',
    '--panel-soft': 'rgba(0, 0, 0, 0.12)',
    '--overlay-bg': 'rgba(10, 10, 10, 0.98)',
    '--field-bg': '#0f0f0f',
    '--line': '#333333',
    '--text': '#e8e8e8',
    '--text-2': '#b0b0b0',
    '--text-3': '#787878',
    '--accent': '#8a8a8a',
    '--accent-soft': 'rgba(138, 138, 138, 0.14)',
    '--switch-off': '#3a3a3a',
    '--switch-on': '#6e6e6e',
    '--switch-knob': '#e0e0e0',
  },
  snow: {
    '--bg-top': '#f0f0f0',
    '--bg-bottom': '#fafafa',
    '--panel': '#f5f5f5',
    '--panel-2': '#fafafa',
    '--panel-3': '#ffffff',
    '--panel-soft': 'rgba(255, 255, 255, 0.85)',
    '--overlay-bg': 'rgba(250, 250, 250, 0.98)',
    '--field-bg': '#ffffff',
    '--line': '#d5d5d5',
    '--text': '#1a1a1a',
    '--text-2': '#555555',
    '--text-3': '#888888',
    '--accent': '#555555',
    '--accent-soft': 'rgba(85, 85, 85, 0.12)',
    '--switch-off': '#cccccc',
    '--switch-on': '#666666',
    '--switch-knob': '#ffffff',
  },
  sapphire: {
    '--bg-top': '#0b1628',
    '--bg-bottom': '#0f1f3a',
    '--panel': '#132748',
    '--panel-2': '#1a3460',
    '--panel-3': '#224178',
    '--panel-soft': 'rgba(0, 0, 0, 0.10)',
    '--overlay-bg': 'rgba(12, 20, 40, 0.98)',
    '--field-bg': '#0e1a32',
    '--line': '#2d5090',
    '--text': '#e8f0ff',
    '--text-2': '#a8c4f0',
    '--text-3': '#7096cc',
    '--accent': '#4d8aff',
    '--accent-soft': 'rgba(77, 138, 255, 0.18)',
    '--switch-off': '#2c4a78',
    '--switch-on': '#4c85f2',
    '--switch-knob': '#e8f0ff',
  },
  mocha: {
    '--bg-top': '#1a1412',
    '--bg-bottom': '#261d18',
    '--panel': '#2e231d',
    '--panel-2': '#3d302a',
    '--panel-3': '#4a3b33',
    '--panel-soft': 'rgba(0, 0, 0, 0.10)',
    '--overlay-bg': 'rgba(26, 20, 16, 0.98)',
    '--field-bg': '#221a15',
    '--line': '#5e4b3e',
    '--text': '#f2e8e0',
    '--text-2': '#cdb8a8',
    '--text-3': '#9e8878',
    '--accent': '#c09070',
    '--accent-soft': 'rgba(192, 144, 112, 0.18)',
    '--switch-off': '#5a483c',
    '--switch-on': '#b58568',
    '--switch-knob': '#f5ede6',
  },
  sakura: {
    '--bg-top': '#f5e8ee',
    '--bg-bottom': '#fdf4f8',
    '--panel': '#f8ecf2',
    '--panel-2': '#fbf2f6',
    '--panel-3': '#fef8fb',
    '--panel-soft': 'rgba(255, 255, 255, 0.75)',
    '--overlay-bg': 'rgba(252, 244, 248, 0.98)',
    '--field-bg': '#fffafc',
    '--line': '#e0c4d2',
    '--text': '#3a222e',
    '--text-2': '#6b4a5a',
    '--text-3': '#997080',
    '--accent': '#d4738e',
    '--accent-soft': 'rgba(212, 115, 142, 0.16)',
    '--switch-off': '#d6bfc9',
    '--switch-on': '#d07590',
    '--switch-knob': '#ffffff',
  },
  dusk: {
    '--bg-top': '#18141e',
    '--bg-bottom': '#221c2c',
    '--panel': '#2a2338',
    '--panel-2': '#372e48',
    '--panel-3': '#433858',
    '--panel-soft': 'rgba(0, 0, 0, 0.10)',
    '--overlay-bg': 'rgba(24, 20, 32, 0.98)',
    '--field-bg': '#1e1828',
    '--line': '#554872',
    '--text': '#f0e8f8',
    '--text-2': '#c8b8da',
    '--text-3': '#9888b0',
    '--accent': '#b088e0',
    '--accent-soft': 'rgba(176, 136, 224, 0.18)',
    '--switch-off': '#504468',
    '--switch-on': '#a880d8',
    '--switch-knob': '#f5f0fa',
  },
};

let currentTextTarget:
  | HTMLTextAreaElement
  | HTMLPreElement
  | HTMLInputElement
  | null = null;
let textOverlayReadonly = false;
let textEnhancerObserver: MutationObserver | null = null;
let suppressLauncherClick = false;
let launcherAnchor = defaultPosition();

function panelHtml(): string {
  return `
    <div id="${ROOT_ID}" class="ai-floating-panel-root">
      <button id="${PANEL_IDS.launcher}" class="ai-floating-panel-launcher" title="${t('panel.open')}">
        <i class="fa-solid fa-images"></i>
      </button>
      <aside id="${PANEL_IDS.panel}" class="ai-floating-panel">
        <header class="ai-floating-panel-header">
          <div class="ai-floating-panel-header-copy">
            <strong>${t('extensionName')}</strong>
            <span>${t('panel.promptSettings')}</span>
          </div>
          <button id="${PANEL_IDS.close}" class="ai-floating-panel-icon-btn" title="${t('panel.close')}">×</button>
        </header>

        <nav class="ai-floating-panel-tabs">
          <button class="ai-floating-panel-tab active" data-panel-tab="main">${t('panel.main')}</button>
          <button class="ai-floating-panel-tab" data-panel-tab="prompt">${t('panel.promptSettings')}</button>
          <button class="ai-floating-panel-tab" data-panel-tab="gallery">${t('gallery.title')}</button>
          <button class="ai-floating-panel-tab" data-panel-tab="standalone">${t('drawer.standaloneGeneration')}</button>
          <button class="ai-floating-panel-tab" data-panel-tab="prompt-library">${t('promptLibrary.title')}</button>
        </nav>

        <div class="ai-floating-panel-body">
          <section id="${PANEL_IDS.mainPage}" class="ai-floating-panel-page active" data-page="main">
            <section class="ai-floating-panel-card no-collapse">
              <div class="ai-floating-panel-card-head">
                <strong>${t('settings.enable')}</strong>
              </div>
              <div id="${SLOT_IDS.mainEnabled}"></div>
            </section>

            <section class="ai-floating-panel-card no-collapse">
              <div class="ai-floating-panel-card-head">
                <strong>${t('settings.promptGenerationMode')}</strong>
              </div>
              <div id="${SLOT_IDS.mainMode}"></div>
            </section>

            <section class="ai-floating-panel-card no-collapse">
              <div class="ai-floating-panel-card-head">
                <strong>${t('panel.currentChat')}</strong>
              </div>
              <div id="${SLOT_IDS.mainSubfolder}"></div>
            </section>

            <section class="ai-floating-panel-card">
              <div class="ai-floating-panel-card-head">
                <strong>${t('panel.theme')}</strong>
              </div>
              <div class="ai-floating-panel-theme-grid">
                ${themeButtonHtml('slate')}
                ${themeButtonHtml('graphite')}
                ${themeButtonHtml('ocean')}
                ${themeButtonHtml('amber')}
                ${themeButtonHtml('mist')}
                ${themeButtonHtml('ivory')}
                ${themeButtonHtml('frost')}
                ${themeButtonHtml('rose')}
                ${themeButtonHtml('jade')}
                ${themeButtonHtml('lavender')}
                ${themeButtonHtml('citrus')}
                ${themeButtonHtml('obsidian')}
                ${themeButtonHtml('snow')}
                ${themeButtonHtml('sapphire')}
                ${themeButtonHtml('mocha')}
                ${themeButtonHtml('sakura')}
                ${themeButtonHtml('dusk')}
              </div>
            </section>

            <section class="ai-floating-panel-card no-collapse">
              <div class="ai-floating-panel-card-head">
                <strong>${t('panel.info')}</strong>
              </div>
              <div id="${SLOT_IDS.mainInfo}"></div>
            </section>
          </section>

          <section id="${PANEL_IDS.promptPage}" class="ai-floating-panel-page" data-page="prompt">
            <section id="${PANEL_IDS.sharedSection}" class="ai-floating-panel-card no-collapse">
              <div class="ai-floating-panel-card-head">
                <strong>${t('panel.sharedModeSection')}</strong>
              </div>
              <div id="${SLOT_IDS.sharedMeta}"></div>
            </section>

            <section id="${PANEL_IDS.independentSection}" class="ai-floating-panel-card no-collapse">
              <div class="ai-floating-panel-card-head">
                <strong>${t('panel.independentModeSection')}</strong>
              </div>
              <div class="ai-floating-panel-stack">
                <div class="ai-floating-panel-subcard no-collapse">
                  <div class="ai-floating-panel-subcard-head">
                    <strong>${t('panel.baseParams')}</strong>
                  </div>
                  <div id="${SLOT_IDS.independentBase}"></div>
                </div>

                <div class="ai-floating-panel-subcard no-collapse">
                  <div class="ai-floating-panel-subcard-head">
                    <strong>${t('settings.contextInjectionTitle')}</strong>
                  </div>
                  <div class="ai-floating-panel-action-row">
                    <div class="ai-floating-panel-action-copy">
                      <strong>${t('settings.injectCharacterDescription')}</strong>
                      <span>${t('settings.injectCharacterDescriptionDesc')}</span>
                    </div>
                    <div class="ai-floating-panel-action-controls">
                      <input id="${PANEL_IDS.contextTogglePrompt}" type="checkbox" class="ai-floating-panel-toggle" />
                      <button class="ai-floating-panel-ghost-btn" data-open-overlay="${PANEL_IDS.contextOverlay}">${t('panel.settings')}</button>
                    </div>
                  </div>
                </div>

                <div class="ai-floating-panel-subcard no-collapse">
                  <div class="ai-floating-panel-subcard-head">
                    <strong>${t('settings.worldInfoTitle')}</strong>
                  </div>
                  <div class="ai-floating-panel-action-row">
                    <div class="ai-floating-panel-action-copy">
                      <strong>${t('settings.injectWorldInfo')}</strong>
                      <span>${t('settings.injectWorldInfoDesc')}</span>
                    </div>
                    <div class="ai-floating-panel-action-controls">
                      <input id="${PANEL_IDS.worldTogglePrompt}" type="checkbox" class="ai-floating-panel-toggle" />
                      <button class="ai-floating-panel-ghost-btn" data-open-overlay="${PANEL_IDS.worldOverlay}">${t('panel.manage')}</button>
                    </div>
                  </div>
                </div>

                <div class="ai-floating-panel-subcard">
                  <div class="ai-floating-panel-subcard-head">
                    <strong>${t('drawer.guidelinesPreset')}</strong>
                  </div>
                  <div id="${SLOT_IDS.guidelines}"></div>
                </div>

                <div class="ai-floating-panel-subcard">
                  <div class="ai-floating-panel-subcard-head">
                    <strong>${t('drawer.independentLlmApi')}</strong>
                  </div>
                  <div id="${SLOT_IDS.independentLlm}"></div>
                </div>
              </div>
            </section>

            <section class="ai-floating-panel-card no-collapse">
              <div class="ai-floating-panel-card-head">
                <strong>${t('panel.commonSection')}</strong>
              </div>
              <div class="ai-floating-panel-stack">
                <div class="ai-floating-panel-subcard no-collapse">
                  <div class="ai-floating-panel-subcard-head">
                    <strong>${t('drawer.promptDetectionAndStyle')}</strong>
                  </div>
                  <div id="${SLOT_IDS.promptStyle}"></div>
                </div>
                <div class="ai-floating-panel-subcard no-collapse">
                  <div class="ai-floating-panel-subcard-head">
                    <strong>${t('drawer.characterFixedTags')}</strong>
                  </div>
                  <div class="ai-floating-panel-action-row">
                    <div class="ai-floating-panel-action-copy">
                      <strong>${t('drawer.characterFixedTags')}</strong>
                      <span>${t('settings.characterFixedTags.desc')}</span>
                    </div>
                    <button class="ai-floating-panel-ghost-btn" data-open-overlay="${PANEL_IDS.characterOverlay}">${t('panel.openLabel')}</button>
                  </div>
                </div>
              </div>
            </section>
          </section>

          <section id="${PANEL_IDS.galleryPage}" class="ai-floating-panel-page" data-page="gallery">
            <section class="ai-floating-panel-card no-collapse">
              <div class="ai-floating-panel-card-head">
                <strong>${t('gallery.title')}</strong>
              </div>
              <div id="${SLOT_IDS.gallery}" class="ai-floating-panel-gallery-host"></div>
            </section>
          </section>

          <section id="${PANEL_IDS.standalonePage}" class="ai-floating-panel-page" data-page="standalone">
            <section class="ai-floating-panel-card no-collapse">
              <div class="ai-floating-panel-card-head">
                <strong>${t('drawer.standaloneGeneration')}</strong>
              </div>
              <div id="${SLOT_IDS.standalone}"></div>
            </section>

            <section class="ai-floating-panel-card no-collapse">
              <div class="ai-floating-panel-card-head">
                <strong>${t('settings.contextInjectionTitle')}</strong>
              </div>
              <div class="ai-floating-panel-action-row">
                <div class="ai-floating-panel-action-copy">
                  <strong>${t('settings.injectCharacterDescription')}</strong>
                  <span>${t('standalone.includeCharInfo')}</span>
                </div>
                <div class="ai-floating-panel-action-controls">
                  <input id="${PANEL_IDS.contextToggleStandalone}" type="checkbox" class="ai-floating-panel-toggle" />
                  <button class="ai-floating-panel-ghost-btn" data-open-overlay="${PANEL_IDS.contextOverlay}">${t('panel.settings')}</button>
                </div>
              </div>
              <div class="ai-floating-panel-action-row" style="margin-top:8px;">
                <div class="ai-floating-panel-action-copy">
                  <strong>${t('settings.injectWorldInfo')}</strong>
                  <span>${t('standalone.includeWorldInfo')}</span>
                </div>
                <div class="ai-floating-panel-action-controls">
                  <input id="${PANEL_IDS.worldToggleStandalone}" type="checkbox" class="ai-floating-panel-toggle" />
                  <button class="ai-floating-panel-ghost-btn" data-open-overlay="${PANEL_IDS.worldOverlay}">${t('panel.manage')}</button>
                </div>
              </div>
            </section>
          </section>

          <section id="${PANEL_IDS.promptLibraryPage}" class="ai-floating-panel-page" data-page="prompt-library">
            <section class="ai-floating-panel-card no-collapse">
              <div class="ai-floating-panel-card-head">
                <strong>${t('promptLibrary.title')}</strong>
              </div>
              <div id="${SLOT_IDS.promptLibrary}"></div>
            </section>
          </section>
        </div>

        <div id="${PANEL_IDS.contextOverlay}" class="ai-floating-panel-overlay">
          <div class="ai-floating-panel-overlay-head">
            <strong>${t('panel.contextSettings')}</strong>
            <button class="ai-floating-panel-icon-btn" data-close-overlay="${PANEL_IDS.contextOverlay}">×</button>
          </div>
          <div class="ai-floating-panel-overlay-body">
            <div id="${SLOT_IDS.contextOverlay}"></div>
          </div>
        </div>

        <div id="${PANEL_IDS.worldOverlay}" class="ai-floating-panel-overlay">
          <div class="ai-floating-panel-overlay-head">
            <strong>${t('panel.worldManager')}</strong>
            <button class="ai-floating-panel-icon-btn" data-close-overlay="${PANEL_IDS.worldOverlay}">×</button>
          </div>
          <div class="ai-floating-panel-overlay-body">
            <div id="${SLOT_IDS.worldOverlay}"></div>
          </div>
        </div>

        <div id="${PANEL_IDS.characterOverlay}" class="ai-floating-panel-overlay">
          <div class="ai-floating-panel-overlay-head">
            <strong>${t('drawer.characterFixedTags')}</strong>
            <button class="ai-floating-panel-icon-btn" data-close-overlay="${PANEL_IDS.characterOverlay}">×</button>
          </div>
          <div class="ai-floating-panel-overlay-body">
            <div id="${SLOT_IDS.characterOverlay}"></div>
          </div>
        </div>

        <div id="${PANEL_IDS.textOverlay}" class="ai-floating-panel-overlay">
          <div class="ai-floating-panel-overlay-head">
            <strong id="${PANEL_IDS.textOverlayTitle}">${t('panel.fullscreenEditor')}</strong>
            <button class="ai-floating-panel-icon-btn" data-close-overlay="${PANEL_IDS.textOverlay}">×</button>
          </div>
          <div class="ai-floating-panel-overlay-body">
            <div class="ai-floating-panel-text-overlay">
              <textarea id="${PANEL_IDS.textOverlayTextarea}" class="text_pole textarea_compact" rows="18"></textarea>
              <div class="ai-floating-panel-text-overlay-actions">
                <button class="ai-floating-panel-ghost-btn" data-close-overlay="${PANEL_IDS.textOverlay}">${t('settings.cancel')}</button>
                <button id="${PANEL_IDS.textOverlayApply}" class="ai-floating-panel-ghost-btn">${t('panel.apply')}</button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  `;
}

function themeButtonHtml(theme: PanelTheme): string {
  return `
    <button class="ai-floating-panel-theme-btn" data-panel-theme="${theme}">
      <span class="ai-floating-panel-theme-name">${t(`panel.theme.${theme}`)}</span>
      <span class="ai-floating-panel-theme-preview">${theme}</span>
    </button>
  `;
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      --bg-top: #10141b;
      --bg-bottom: #171d28;
      --panel: #202633;
      --panel-2: #2a3141;
      --panel-3: #323b4f;
      --panel-soft: rgba(0, 0, 0, 0.08);
      --overlay-bg: rgba(20, 24, 32, 0.98);
      --field-bg: #1a202b;
      --line: #465067;
      --text: #eef2f8;
      --text-2: #bcc5d8;
      --text-3: #8892a9;
      --accent: #7aaef5;
      --accent-soft: rgba(122, 174, 245, 0.15);
      --switch-off: #3f495e;
      --switch-on: #5f88c3;
      --switch-knob: #dfe6f6;
      position: fixed;
      left: 16px;
      top: 16px;
      z-index: 9998;
      color: var(--text);
      font-family: "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
    }

    .ai-floating-panel-launcher {
      position: relative;
      display: none;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      cursor: grab;
      box-shadow: 0 14px 32px rgba(0, 0, 0, 0.28);
      font-size: 14px;
      touch-action: none;
    }

    .ai-floating-panel-launcher:active {
      cursor: grabbing;
    }

    .ai-floating-panel-root:not(.open) .ai-floating-panel-launcher {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ai-floating-panel-root:not(.open) .ai-floating-panel {
      display: none;
    }

    .ai-floating-panel-root:not(.open) {
      width: 44px;
      height: 44px;
    }

    .ai-floating-panel-root.launcher-hidden:not(.open) {
      display: none;
    }

    .ai-floating-panel {
      position: relative;
      width: min(430px, calc(100vw - 24px));
      height: min(820px, calc(100dvh - 24px));
      border: 1px solid var(--line);
      border-radius: 20px;
      overflow: hidden;
      background: var(--panel);
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
    }

    .ai-floating-panel-header {
      padding: 13px 14px 11px;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: rgba(255, 255, 255, 0.02);
    }

    .ai-floating-panel-header-copy strong {
      display: block;
      font-size: 15px;
      margin-bottom: 3px;
    }

    .ai-floating-panel-header-copy span {
      display: block;
      font-size: 11px;
      line-height: 1.35;
      color: var(--text-3);
    }

    .ai-floating-panel-icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 9px;
      border: 1px solid var(--line);
      background: var(--panel-3);
      color: var(--text);
      cursor: pointer;
    }

    .ai-floating-panel-tabs {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
    }

    .ai-floating-panel-tab {
      border: 1px solid var(--line);
      border-radius: 9px;
      background: var(--panel-2);
      color: var(--text-2);
      padding: 8px 0;
      font-size: 12px;
      cursor: pointer;
    }

    .ai-floating-panel-tab.active {
      background: var(--accent-soft);
      border-color: rgba(122, 174, 245, 0.35);
      color: var(--text);
    }

    .ai-floating-panel-body {
      flex: 1;
      overflow: auto;
      padding: 14px;
    }

    .ai-floating-panel-page {
      display: none;
    }

    .ai-floating-panel-page.active {
      display: block;
    }

    .ai-floating-panel-card,
    .ai-floating-panel-subcard {
      border: 2px solid var(--line);
      border-radius: 12px;
      background: var(--panel-2);
      padding: 12px;
    }

    .ai-floating-panel-subcard {
      border-width: 1px;
      background: var(--panel-soft);
    }

    .ai-floating-panel-card.collapsible,
    .ai-floating-panel-subcard.collapsible {
      padding: 0;
      overflow: hidden;
    }

    .ai-floating-panel-card.collapsible .ai-floating-panel-card-head,
    .ai-floating-panel-subcard.collapsible .ai-floating-panel-subcard-head {
      margin: 0;
      padding: 12px;
      cursor: pointer;
      user-select: none;
    }

    .ai-floating-panel-card.collapsible .ai-floating-panel-card-content,
    .ai-floating-panel-subcard.collapsible .ai-floating-panel-subcard-content {
      padding: 0 12px 12px;
      border-top: 1px solid var(--line);
    }

    .ai-floating-panel-card.collapsible.collapsed .ai-floating-panel-card-content,
    .ai-floating-panel-subcard.collapsible.collapsed .ai-floating-panel-subcard-content {
      display: none;
    }

    .ai-floating-panel-card + .ai-floating-panel-card,
    .ai-floating-panel-subcard + .ai-floating-panel-subcard {
      margin-top: 10px;
    }

    .ai-floating-panel-stack {
      display: grid;
      gap: 8px;
    }

    .ai-floating-panel-card-head,
    .ai-floating-panel-subcard-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }

    .ai-floating-panel-card-head strong,
    .ai-floating-panel-subcard-head strong {
      font-size: 13px;
    }

    .ai-floating-panel-head-main {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .ai-floating-panel-caret {
      width: 14px;
      text-align: center;
      font-size: 10px;
      color: var(--text-3);
      transition: transform 120ms ease;
    }

    .ai-floating-panel-card.collapsible:not(.collapsed) .ai-floating-panel-caret,
    .ai-floating-panel-subcard.collapsible:not(.collapsed) .ai-floating-panel-caret {
      transform: rotate(90deg);
    }

    .ai-floating-panel-action-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: var(--panel-3);
    }

    .ai-floating-panel-action-row + .ai-floating-panel-action-row {
      margin-top: 8px;
    }

    .ai-floating-panel-action-copy strong {
      display: block;
      font-size: 12px;
      margin-bottom: 3px;
    }

    .ai-floating-panel-action-copy span {
      display: block;
      font-size: 11px;
      line-height: 1.35;
      color: var(--text-3);
    }

    .ai-floating-panel-action-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }

    .ai-floating-panel-toggle {
      width: 18px;
      height: 18px;
      accent-color: var(--accent);
      cursor: pointer;
    }

    .ai-floating-panel-ghost-btn {
      padding: 7px 9px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: var(--panel-3);
      color: var(--text);
      font-size: 12px;
      cursor: pointer;
    }

    .ai-floating-panel-theme-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .ai-floating-panel-theme-btn {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel-2);
      color: var(--text);
      padding: 10px;
      text-align: left;
      cursor: pointer;
    }

    .ai-floating-panel-theme-btn.active {
      background: var(--accent-soft);
      border-color: rgba(122, 174, 245, 0.45);
    }

    .ai-floating-panel-theme-name {
      display: block;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .ai-floating-panel-theme-preview {
      display: block;
      color: var(--text-3);
      font-size: 10px;
    }

    .ai-floating-panel-overlay {
      position: absolute;
      inset: 0;
      background: var(--overlay-bg);
      display: none;
      flex-direction: column;
      z-index: 5;
    }

    .ai-floating-panel-overlay.open {
      display: flex;
    }

    .ai-floating-panel-overlay-head {
      padding: 14px;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .ai-floating-panel-overlay-head strong {
      font-size: 14px;
    }

    .ai-floating-panel-overlay-body {
      flex: 1;
      overflow: auto;
      padding: 14px;
    }

    .ai-floating-panel-text-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 6px;
    }

    .ai-floating-panel-text-overlay {
      display: grid;
      gap: 10px;
      height: 100%;
    }

    .ai-floating-panel-text-overlay textarea {
      flex: 1 1 auto;
      min-height: min(55dvh, 420px);
      resize: vertical;
    }

    .ai-floating-panel-text-overlay-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .ai-floating-panel-root .text_pole,
    .ai-floating-panel-root .input,
    .ai-floating-panel-root textarea,
    .ai-floating-panel-root select {
      background: var(--field-bg) !important;
      color: var(--text) !important;
      border: 1px solid var(--line) !important;
      border-radius: 10px !important;
    }

    .ai-floating-panel-root label {
      color: var(--text-2);
      font-size: 11px;
    }

    .ai-floating-panel-root small {
      color: var(--text-3);
    }

    .ai-floating-panel-root .checkbox_label {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .ai-floating-panel-root .checkbox_label input {
      margin-top: 2px;
    }

    .ai-floating-panel-root .menu_button,
    .ai-floating-panel-root .menu_button_icon {
      border-radius: 10px !important;
      background: var(--panel-3) !important;
      color: var(--text) !important;
      border: 1px solid var(--line) !important;
    }

    .ai-floating-panel-root .pattern-validation-status,
    .ai-floating-panel-root .character-tag-desc,
    .ai-floating-panel-root .world-info-empty,
    .ai-floating-panel-root .standalone-status,
    .ai-floating-panel-root .standalone-reasoning {
      color: var(--text-3);
    }

    .ai-floating-panel-gallery-host > .ai-img-gallery-widget-global {
      position: static !important;
      inset: auto !important;
      width: 100% !important;
      max-width: none !important;
      min-width: 0 !important;
      box-shadow: none !important;
      margin: 0 !important;
      border: 0 !important;
      background: transparent !important;
    }

    .ai-floating-panel-gallery-host .ai-img-gallery-header,
    .ai-floating-panel-gallery-host .ai-img-gallery-content,
    .ai-floating-panel-gallery-host .ai-img-gallery-message-group {
      background: var(--panel-2) !important;
      border-color: var(--line) !important;
      color: var(--text) !important;
    }

    .ai-floating-panel-gallery-host .ai-img-gallery-content {
      max-height: 420px;
    }

    .ai-floating-panel-gallery-host .ai-img-gallery-empty,
    .ai-floating-panel-gallery-host .ai-img-gallery-message-preview,
    .ai-floating-panel-gallery-host .ai-img-gallery-message-count {
      color: var(--text-3) !important;
    }

    #${SLOT_IDS.standalone} label[for="${UI_ELEMENT_IDS.STANDALONE_INCLUDE_CHAR_INFO}"],
    #${SLOT_IDS.standalone} label[for="${UI_ELEMENT_IDS.STANDALONE_INCLUDE_WORLD_INFO}"] {
      display: none !important;
    }

    @media (max-width: 768px) {
      #${ROOT_ID} {
        inset: 0;
        right: 0;
        top: 0;
      }

      .ai-floating-panel {
        width: 100vw;
        height: 100dvh;
        border-radius: 0;
        border-left: 0;
        border-right: 0;
      }

      .ai-floating-panel-tabs {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 5px;
        padding: 8px 12px;
      }

      .ai-floating-panel-body,
      .ai-floating-panel-overlay-body {
        padding: 12px;
      }

      .ai-floating-panel-theme-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

function root(): HTMLElement | null {
  return document.getElementById(ROOT_ID);
}

function sourceSection(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function slot(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function defaultPosition(): {x: number; y: number} {
  return {
    x: Math.max(12, window.innerWidth - 56),
    y: Math.max(12, window.innerHeight - 56),
  };
}

function setLauncherAnchor(x: number, y: number, persist = true): void {
  launcherAnchor = {
    x: Math.round(x),
    y: Math.round(y),
  };

  if (!persist) return;

  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(launcherAnchor));
  } catch (error) {
    logger.debug('Failed to persist floating panel position', error);
  }
}

function applyRootPosition(x: number, y: number): void {
  const panelRoot = root();
  if (!panelRoot) return;
  panelRoot.style.left = `${Math.round(x)}px`;
  panelRoot.style.top = `${Math.round(y)}px`;
}

function getClampedPosition(
  x: number,
  y: number,
  width: number,
  height: number
): {x: number; y: number} {
  const maxX = Math.max(12, window.innerWidth - width - 12);
  const maxY = Math.max(12, window.innerHeight - height - 12);
  return {
    x: Math.min(Math.max(12, x), maxX),
    y: Math.min(Math.max(12, y), maxY),
  };
}

function clampRootPosition(forOpen: boolean): void {
  const panel = document.getElementById(PANEL_IDS.panel);
  const launcher = document.getElementById(PANEL_IDS.launcher);
  if (!panel || !launcher) return;
  const width = forOpen ? panel.offsetWidth : launcher.offsetWidth;
  const height = forOpen ? panel.offsetHeight : launcher.offsetHeight;
  const {x, y} = getClampedPosition(
    parseFloat(root()?.style.left || '16'),
    parseFloat(root()?.style.top || '16'),
    width,
    height
  );
  applyRootPosition(x, y);
}

function applyLauncherAnchorPosition(): void {
  const launcher = document.getElementById(PANEL_IDS.launcher);
  if (!launcher) return;
  const {x, y} = getClampedPosition(
    launcherAnchor.x,
    launcherAnchor.y,
    launcher.offsetWidth,
    launcher.offsetHeight
  );
  setLauncherAnchor(x, y, false);
  applyRootPosition(x, y);
}

function applyPanelPositionFromLauncherAnchor(): void {
  const panel = document.getElementById(PANEL_IDS.panel);
  if (!panel) return;
  const {x, y} = getClampedPosition(
    launcherAnchor.x,
    launcherAnchor.y,
    panel.offsetWidth,
    panel.offsetHeight
  );
  applyRootPosition(x, y);
}

function restoreRootPosition(isOpen: boolean): void {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {x?: number; y?: number};
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        launcherAnchor = {x: parsed.x, y: parsed.y};
      } else {
        launcherAnchor = defaultPosition();
      }
    } else {
      launcherAnchor = defaultPosition();
    }
  } catch (error) {
    logger.debug('Failed to restore floating panel position', error);
    launcherAnchor = defaultPosition();
  }
  requestAnimationFrame(() => {
    if (isOpen) {
      applyPanelPositionFromLauncherAnchor();
    } else {
      applyLauncherAnchorPosition();
    }
  });
}

function mountSection(sectionId: string, slotId: string): void {
  const source = sourceSection(sectionId);
  const target = slot(slotId);
  if (!source || !target) return;
  if (source.parentElement !== target) {
    target.appendChild(source);
  }
}

function showPage(page: string): void {
  root()
    ?.querySelectorAll<HTMLElement>('.ai-floating-panel-page')
    .forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  root()
    ?.querySelectorAll<HTMLButtonElement>('.ai-floating-panel-tab')
    .forEach(button => {
      button.classList.toggle('active', button.dataset.panelTab === page);
    });

  if (page === 'gallery') {
    attachGalleryToHost();
  }
}

function setOpen(isOpen: boolean): void {
  const panelRoot = root();
  if (!panelRoot) return;
  if (!isOpen) {
    closeAllOverlays();
    currentTextTarget = null;
    textOverlayReadonly = false;
  }
  panelRoot.classList.toggle('open', isOpen);
  requestAnimationFrame(() => {
    if (isOpen) {
      applyPanelPositionFromLauncherAnchor();
    } else {
      applyLauncherAnchorPosition();
    }
  });
}

export function openFloatingPanel(): void {
  setOpen(true);
}

export function setFloatingPanelLauncherVisible(visible: boolean): void {
  const panelRoot = root();
  if (!panelRoot) return;
  panelRoot.classList.toggle('launcher-hidden', !visible);
}

function applyTheme(theme: PanelTheme): void {
  const panelRoot = root();
  if (!panelRoot) return;
  const preset = THEME_PRESETS[theme];
  Object.entries(preset).forEach(([key, value]) => {
    panelRoot.style.setProperty(key, value);
  });
  panelRoot
    .querySelectorAll<HTMLButtonElement>('[data-panel-theme]')
    .forEach(button => {
      button.classList.toggle('active', button.dataset.panelTheme === theme);
    });
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    logger.debug('Failed to persist floating panel theme', error);
  }
}

function getCurrentPromptMode(): 'shared' | 'independent' {
  const sharedRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_SHARED
  ) as HTMLInputElement | null;
  return sharedRadio?.checked ? 'shared' : 'independent';
}

function syncPromptModeVisibility(): void {
  const shared = document.getElementById(PANEL_IDS.sharedSection);
  const independent = document.getElementById(PANEL_IDS.independentSection);
  const mode = getCurrentPromptMode();
  if (shared) shared.style.display = mode === 'shared' ? '' : 'none';
  if (independent)
    independent.style.display = mode === 'independent' ? '' : 'none';
}

function syncContextMasterToggles(): void {
  const charBox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_CHARACTER_DESCRIPTION
  ) as HTMLInputElement | null;
  const personaBox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_USER_PERSONA
  ) as HTMLInputElement | null;
  const scenarioBox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_SCENARIO
  ) as HTMLInputElement | null;
  const checked = Boolean(
    charBox?.checked || personaBox?.checked || scenarioBox?.checked
  );
  [PANEL_IDS.contextTogglePrompt, PANEL_IDS.contextToggleStandalone].forEach(
    id => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (input) input.checked = checked;
    }
  );
}

function syncWorldMasterToggles(): void {
  const worldBox = document.getElementById(
    UI_ELEMENT_IDS.INJECT_WORLD_INFO
  ) as HTMLInputElement | null;
  const checked = Boolean(worldBox?.checked);
  [PANEL_IDS.worldTogglePrompt, PANEL_IDS.worldToggleStandalone].forEach(id => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.checked = checked;
  });
}

function syncStandaloneContextToggle(): void {
  const input = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_INCLUDE_CHAR_INFO
  ) as HTMLInputElement | null;
  const toggle = document.getElementById(
    PANEL_IDS.contextToggleStandalone
  ) as HTMLInputElement | null;
  if (toggle) {
    toggle.checked = Boolean(input?.checked);
  }
}

function syncStandaloneWorldToggle(): void {
  const input = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_INCLUDE_WORLD_INFO
  ) as HTMLInputElement | null;
  const toggle = document.getElementById(
    PANEL_IDS.worldToggleStandalone
  ) as HTMLInputElement | null;
  if (toggle) {
    toggle.checked = Boolean(input?.checked);
  }
}

function setContextMaster(enabled: boolean): void {
  const ids = [
    UI_ELEMENT_IDS.INJECT_CHARACTER_DESCRIPTION,
    UI_ELEMENT_IDS.INJECT_USER_PERSONA,
    UI_ELEMENT_IDS.INJECT_SCENARIO,
  ];
  ids.forEach(id => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) {
      input.checked = enabled;
      input.dispatchEvent(new Event('change', {bubbles: true}));
    }
  });
  syncContextMasterToggles();
}

function setWorldMaster(enabled: boolean): void {
  const input = document.getElementById(
    UI_ELEMENT_IDS.INJECT_WORLD_INFO
  ) as HTMLInputElement | null;
  if (input) {
    input.checked = enabled;
    input.dispatchEvent(new Event('change', {bubbles: true}));
  }
  syncWorldMasterToggles();
}

function setStandaloneContextEnabled(enabled: boolean): void {
  const input = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_INCLUDE_CHAR_INFO
  ) as HTMLInputElement | null;
  if (input) {
    input.checked = enabled;
    input.dispatchEvent(new Event('change', {bubbles: true}));
  }
  syncStandaloneContextToggle();
}

function setStandaloneWorldEnabled(enabled: boolean): void {
  const input = document.getElementById(
    UI_ELEMENT_IDS.STANDALONE_INCLUDE_WORLD_INFO
  ) as HTMLInputElement | null;
  if (input) {
    input.checked = enabled;
    input.dispatchEvent(new Event('change', {bubbles: true}));
  }
  syncStandaloneWorldToggle();
}

function openOverlay(id: string): void {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('open');
}

function closeOverlay(id: string): void {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
}

function closeAllOverlays(): void {
  root()
    ?.querySelectorAll<HTMLElement>('.ai-floating-panel-overlay.open')
    .forEach(overlay => {
      overlay.classList.remove('open');
    });
}

function ensureRoot(): HTMLElement {
  const existing = root();
  if (existing) return existing;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = panelHtml().trim();
  const panelRoot = wrapper.firstElementChild as HTMLElement;
  document.body.appendChild(panelRoot);
  return panelRoot;
}

function mountSourceSections(): void {
  mountSection(UI_SECTION_IDS.MAIN_ENABLED, SLOT_IDS.mainEnabled);
  mountSection(UI_SECTION_IDS.PROMPT_MODE_SELECTOR, SLOT_IDS.mainMode);
  mountSection(UI_SECTION_IDS.MAIN_IMAGE_SUBFOLDER, SLOT_IDS.mainSubfolder);
  mountSection(UI_SECTION_IDS.MAIN_INFO, SLOT_IDS.mainInfo);
  mountSection(UI_SECTION_IDS.SHARED_META_DISPLAY, SLOT_IDS.sharedMeta);
  mountSection(UI_SECTION_IDS.INDEPENDENT_BASE, SLOT_IDS.independentBase);
  mountSection(UI_SECTION_IDS.GUIDELINES, SLOT_IDS.guidelines);
  mountSection(UI_SECTION_IDS.INDEPENDENT_LLM, SLOT_IDS.independentLlm);
  mountSection(UI_SECTION_IDS.PROMPT_STYLE, SLOT_IDS.promptStyle);
  mountSection(UI_SECTION_IDS.STANDALONE, SLOT_IDS.standalone);
  mountSection(UI_SECTION_IDS.CONTEXT_INJECTION, SLOT_IDS.contextOverlay);
  mountSection(UI_SECTION_IDS.WORLD_INFO, SLOT_IDS.worldOverlay);
  mountSection(UI_SECTION_IDS.CHARACTER_TAGS, SLOT_IDS.characterOverlay);
  mountSection(UI_SECTION_IDS.PROMPT_LIBRARY, SLOT_IDS.promptLibrary);
}

function bindPanelEvents(): void {
  const panelRoot = root();
  if (!panelRoot) return;
  if (panelRoot.dataset.bound === 'true') return;
  panelRoot.dataset.bound = 'true';

  panelRoot
    .querySelectorAll<HTMLButtonElement>('.ai-floating-panel-tab')
    .forEach(button => {
      button.addEventListener('click', () => {
        const page = button.dataset.panelTab;
        if (page) showPage(page);
      });
    });

  panelRoot
    .querySelectorAll<HTMLButtonElement>('[data-open-overlay]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.openOverlay;
        if (id) openOverlay(id);
      });
    });

  panelRoot
    .querySelectorAll<HTMLButtonElement>('[data-close-overlay]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.closeOverlay;
        if (id) closeOverlay(id);
      });
    });

  panelRoot
    .querySelectorAll<HTMLInputElement>('.ai-floating-panel-toggle')
    .forEach(input => {
      input.addEventListener('change', () => {
        if (input.id === PANEL_IDS.contextTogglePrompt) {
          setContextMaster(input.checked);
        } else if (input.id === PANEL_IDS.worldTogglePrompt) {
          setWorldMaster(input.checked);
        } else if (input.id === PANEL_IDS.contextToggleStandalone) {
          setStandaloneContextEnabled(input.checked);
        } else if (input.id === PANEL_IDS.worldToggleStandalone) {
          setStandaloneWorldEnabled(input.checked);
        }
      });
    });

  panelRoot
    .querySelectorAll<HTMLButtonElement>('[data-panel-theme]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const theme = button.dataset.panelTheme as PanelTheme;
        applyTheme(theme);
      });
    });

  document
    .getElementById(PANEL_IDS.close)
    ?.addEventListener('click', () => setOpen(false));
  document.getElementById(PANEL_IDS.launcher)?.addEventListener('click', () => {
    if (suppressLauncherClick) {
      suppressLauncherClick = false;
      return;
    }
    setOpen(true);
  });
  document
    .getElementById(PANEL_IDS.textOverlayApply)
    ?.addEventListener('click', applyTextOverlayChanges);

  const sharedRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_SHARED
  );
  const independentRadio = document.getElementById(
    UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_INDEPENDENT
  );
  sharedRadio?.addEventListener('change', syncPromptModeVisibility);
  independentRadio?.addEventListener('change', syncPromptModeVisibility);

  [
    UI_ELEMENT_IDS.INJECT_CHARACTER_DESCRIPTION,
    UI_ELEMENT_IDS.INJECT_USER_PERSONA,
    UI_ELEMENT_IDS.INJECT_SCENARIO,
  ].forEach(id => {
    document
      .getElementById(id)
      ?.addEventListener('change', syncContextMasterToggles);
  });
  document
    .getElementById(UI_ELEMENT_IDS.INJECT_WORLD_INFO)
    ?.addEventListener('change', syncWorldMasterToggles);
  document
    .getElementById(UI_ELEMENT_IDS.STANDALONE_INCLUDE_CHAR_INFO)
    ?.addEventListener('change', syncStandaloneContextToggle);
  document
    .getElementById(UI_ELEMENT_IDS.STANDALONE_INCLUDE_WORLD_INFO)
    ?.addEventListener('change', syncStandaloneWorldToggle);

  const launcher = document.getElementById(PANEL_IDS.launcher);
  launcher?.addEventListener('pointerdown', event => {
    const panelRootEl = root();
    if (!panelRootEl) return;
    if (panelRootEl.classList.contains('open')) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = parseFloat(panelRootEl.style.left || '16');
    const originY = parseFloat(panelRootEl.style.top || '16');
    let moved = false;

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
      }
      panelRootEl.style.left = `${originX + dx}px`;
      panelRootEl.style.top = `${originY + dy}px`;
      clampRootPosition(false);
    };

    const handleUp = () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      clampRootPosition(false);

      if (moved) {
        suppressLauncherClick = true;
        const x = parseFloat(panelRootEl.style.left || '16');
        const y = parseFloat(panelRootEl.style.top || '16');
        setLauncherAnchor(x, y);
        setTimeout(() => {
          suppressLauncherClick = false;
        }, 50);
      }
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  });
}

function initializeCollapsibleCards(): void {
  const panelRoot = root();
  if (!panelRoot) return;

  panelRoot
    .querySelectorAll<HTMLElement>(
      '.ai-floating-panel-card, .ai-floating-panel-subcard'
    )
    .forEach(card => {
      if (card.dataset.collapsibleBound === 'true') return;
      if (card.classList.contains('no-collapse')) return;

      const head = card.querySelector<HTMLElement>(
        ':scope > .ai-floating-panel-card-head, :scope > .ai-floating-panel-subcard-head'
      );
      if (!head) return;

      const contentClass = card.classList.contains('ai-floating-panel-card')
        ? 'ai-floating-panel-card-content'
        : 'ai-floating-panel-subcard-content';

      const content = document.createElement('div');
      content.className = contentClass;
      const children = Array.from(card.children).filter(
        child => child !== head
      );
      children.forEach(child => content.appendChild(child));

      const badge = head.querySelector('.badge, .chip');
      const headNodes = Array.from(head.childNodes);
      const main = document.createElement('div');
      main.className = 'ai-floating-panel-head-main';
      const caret = document.createElement('span');
      caret.className = 'ai-floating-panel-caret';
      caret.textContent = '>';
      main.appendChild(caret);

      headNodes.forEach(node => {
        if (badge && node.nodeType === Node.ELEMENT_NODE && node === badge) {
          return;
        }
        main.appendChild(node);
      });

      head.innerHTML = '';
      head.appendChild(main);
      if (badge) {
        head.appendChild(badge);
      }

      card.classList.add('collapsible', 'collapsed');
      card.appendChild(content);
      card.dataset.collapsibleBound = 'true';

      head.addEventListener('click', () => {
        card.classList.toggle('collapsed');
      });
    });
}

function openTextOverlay(
  target: HTMLTextAreaElement | HTMLPreElement | HTMLInputElement,
  title: string
): void {
  currentTextTarget = target;
  textOverlayReadonly =
    target instanceof HTMLPreElement ||
    (target instanceof HTMLTextAreaElement && target.readOnly) ||
    (target instanceof HTMLInputElement && target.readOnly);

  const titleEl = document.getElementById(PANEL_IDS.textOverlayTitle);
  const textarea = document.getElementById(
    PANEL_IDS.textOverlayTextarea
  ) as HTMLTextAreaElement | null;
  const applyBtn = document.getElementById(
    PANEL_IDS.textOverlayApply
  ) as HTMLButtonElement | null;

  if (titleEl) {
    titleEl.textContent = title;
  }

  if (textarea) {
    textarea.value =
      target instanceof HTMLPreElement
        ? target.textContent || ''
        : target.value;
    textarea.readOnly = textOverlayReadonly;
  }

  if (applyBtn) {
    applyBtn.style.display = textOverlayReadonly ? 'none' : '';
  }

  openOverlay(PANEL_IDS.textOverlay);
}

function applyTextOverlayChanges(): void {
  if (!currentTextTarget || textOverlayReadonly) {
    closeOverlay(PANEL_IDS.textOverlay);
    return;
  }

  if (!currentTextTarget.isConnected) {
    currentTextTarget = null;
    closeOverlay(PANEL_IDS.textOverlay);
    return;
  }

  const textarea = document.getElementById(
    PANEL_IDS.textOverlayTextarea
  ) as HTMLTextAreaElement | null;
  if (!textarea) return;

  if (currentTextTarget instanceof HTMLPreElement) {
    currentTextTarget.textContent = textarea.value;
  } else {
    currentTextTarget.value = textarea.value;
    currentTextTarget.dispatchEvent(new Event('input', {bubbles: true}));
    currentTextTarget.dispatchEvent(new Event('change', {bubbles: true}));
  }

  closeOverlay(PANEL_IDS.textOverlay);
}

function addExpandButton(
  target: HTMLTextAreaElement | HTMLPreElement | HTMLInputElement,
  title: string
): void {
  if (target.dataset.floatingPanelExpandBound === 'true') return;
  target.dataset.floatingPanelExpandBound = 'true';

  const row = document.createElement('div');
  row.className = 'ai-floating-panel-text-actions';

  const button = document.createElement('button');
  button.className = 'ai-floating-panel-ghost-btn';
  button.type = 'button';
  button.textContent = t('panel.expandText');
  button.addEventListener('click', () => openTextOverlay(target, title));

  row.appendChild(button);
  target.insertAdjacentElement('afterend', row);
}

function enhanceLongTextEditors(): void {
  const mappings: Array<{selector: string; title: string}> = [
    {
      selector: `#${UI_ELEMENT_IDS.PRESET_PREVIEW}`,
      title: t('settings.presetContentPreview'),
    },
    {
      selector: `#${UI_ELEMENT_IDS.META_PROMPT}`,
      title: t('settings.metaPromptTemplate'),
    },
    {
      selector: `#${UI_ELEMENT_IDS.LLM_FREQUENCY_GUIDELINES}`,
      title: t('settings.llmFrequencyGuidelines'),
    },
    {
      selector: `#${UI_ELEMENT_IDS.LLM_PROMPT_WRITING_GUIDELINES}`,
      title: t('settings.llmPromptWritingGuidelines'),
    },
    {
      selector: `#${UI_ELEMENT_IDS.STANDALONE_MANUAL_PROMPT_INPUT}`,
      title: t('standalone.modeManual'),
    },
    {
      selector: '.standalone-prompt-card textarea',
      title: t('standalone.generatePrompts'),
    },
  ];

  mappings.forEach(({selector, title}) => {
    document
      .querySelectorAll<
        HTMLTextAreaElement | HTMLPreElement | HTMLInputElement
      >(selector)
      .forEach(target => addExpandButton(target, title));
  });
}

function observeTextTargets(): void {
  const panelRoot = root();
  if (!panelRoot) return;

  textEnhancerObserver?.disconnect();
  textEnhancerObserver = new MutationObserver(() => {
    enhanceLongTextEditors();
  });

  textEnhancerObserver.observe(panelRoot, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style', 'readonly'],
  });
}

function attachGalleryToHost(): void {
  const host = slot(SLOT_IDS.gallery);
  if (!host) return;

  const showGalleryCheckbox = document.getElementById(
    UI_ELEMENT_IDS.SHOW_GALLERY_WIDGET
  ) as HTMLInputElement | null;
  if (showGalleryCheckbox && !showGalleryCheckbox.checked) {
    host.innerHTML = '';
    return;
  }

  if (!getGalleryWidget()) {
    initializeGalleryWidget(progressManager);
  }

  const gallery = getGalleryWidget();
  if (!gallery) return;

  gallery.setHostContainer(host);
  gallery.expand();
  gallery.show();
  gallery.refreshGallery();
}

export function initializeFloatingPanel(): void {
  if (!document.getElementById(UI_SECTION_IDS.FLOATING_PANEL_SOURCE)) {
    logger.warn('Floating panel source container not found');
    return;
  }

  ensureStyle();
  ensureRoot();
  mountSourceSections();
  bindPanelEvents();
  initializeCollapsibleCards();
  enhanceLongTextEditors();
  observeTextTargets();
  syncPromptModeVisibility();
  syncContextMasterToggles();
  syncWorldMasterToggles();
  syncStandaloneContextToggle();
  syncStandaloneWorldToggle();

  const isOpen = false;
  let theme: PanelTheme = 'slate';
  try {
    const storedTheme = localStorage.getItem(
      THEME_STORAGE_KEY
    ) as PanelTheme | null;
    if (storedTheme && THEME_PRESETS[storedTheme]) {
      theme = storedTheme;
    }
  } catch (error) {
    logger.debug('Failed to read floating panel persisted state', error);
  }

  applyTheme(theme);
  restoreRootPosition(isOpen);
  setOpen(isOpen);
  attachGalleryToHost();
  showPage('main');
}
