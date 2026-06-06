import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createMockContext} from './test_helpers';
import {initializeI18n} from './i18n';
import {createSettingsUI} from './settings';
import {initializeFloatingPanel, openFloatingPanel} from './floating_panel_ui';
import {UI_ELEMENT_IDS, UI_SECTION_IDS} from './constants';

const galleryMock = {
  setHostContainer: vi.fn(),
  expand: vi.fn(),
  show: vi.fn(),
  refreshGallery: vi.fn(),
};

vi.mock('./gallery_widget', () => ({
  initializeGalleryWidget: vi.fn(),
  getGalleryWidget: vi.fn(() => galleryMock),
}));

describe('floating_panel_ui', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();

    if (typeof localStorage.setItem !== 'function') {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(),
          clear: vi.fn(),
          removeItem: vi.fn(),
        },
      });
    }

    initializeI18n(
      createMockContext({
        translate: (_text: string, key?: string | null) => key ?? _text,
      })
    );
  });

  it('should create the floating panel root when source sections exist', () => {
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();

    expect(
      document.getElementById('auto_illustrator_conso_floating_panel_root')
    ).not.toBeNull();
  });

  it('should be closed by default when there is no persisted open state', () => {
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();

    expect(
      document
        .getElementById('auto_illustrator_conso_floating_panel_root')
        ?.classList.contains('open')
    ).toBe(false);
  });

  it('should still start closed even if old open-state storage exists', () => {
    localStorage.setItem('auto_illustrator_conso_floating_panel_open', '1');
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();

    expect(
      document
        .getElementById('auto_illustrator_conso_floating_panel_root')
        ?.classList.contains('open')
    ).toBe(false);
  });

  it('should move floating panel source sections into panel slots', () => {
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();

    const sourceContainer = document.getElementById(
      UI_SECTION_IDS.FLOATING_PANEL_SOURCE
    );
    const movedMainEnabled = document.getElementById(
      UI_SECTION_IDS.MAIN_ENABLED
    );

    expect(sourceContainer).not.toBeNull();
    expect(movedMainEnabled).not.toBeNull();
    expect(sourceContainer?.contains(movedMainEnabled)).toBe(false);
  });

  it('should create fullscreen text editor overlay and decorate long text fields', () => {
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();

    expect(
      document.getElementById('ai-floating-panel-overlay-text')
    ).not.toBeNull();
    expect(
      document.querySelector('.ai-floating-panel-text-actions')
    ).not.toBeNull();
  });

  it('should make the fullscreen text editor fill the viewport with horizontal action buttons', () => {
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();

    const styleText = document.getElementById(
      'auto_illustrator_conso_floating_panel_style'
    )?.textContent;
    expect(styleText).toContain('#ai-floating-panel-overlay-text');
    expect(styleText).toContain('position: fixed');
    expect(styleText).toContain('width: 100vw');
    expect(styleText).toContain('height: 100dvh');
    expect(styleText).toContain('.ai-floating-panel-text-overlay textarea');
    expect(styleText).toContain('height: 100%');
    expect(styleText).toContain('resize: none');
    expect(styleText).toContain('.ai-floating-panel-text-overlay-actions');
    expect(styleText).toContain('flex-direction: row');
    expect(styleText).toContain('writing-mode: horizontal-tb !important');
    expect(styleText).toContain('white-space: nowrap');
  });

  it('should bridge plugin UI colors to floating panel theme variables', () => {
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();

    const styleText = document.getElementById(
      'auto_illustrator_conso_floating_panel_style'
    )?.textContent;
    expect(styleText).toContain('--ai-panel-bg: var(--panel);');
    expect(styleText).toContain('--ai-panel-overlay: var(--overlay-bg);');
    expect(styleText).toContain('--ai-panel-text: var(--text);');
    expect(styleText).toContain('--ai-panel-warning: var(--warning);');
    expect(styleText).toContain('--ai-panel-danger: var(--danger);');
    expect(styleText).toContain('--ai-control-bg: var(--field-bg);');
    expect(styleText).not.toContain(['Smart', 'Theme'].join(''));
  });

  it('should open and apply the fullscreen editor without vertical action buttons', () => {
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();

    const original = document.getElementById(
      UI_ELEMENT_IDS.PROMPT_PATTERNS
    ) as HTMLTextAreaElement;
    original.value = 'before';

    const expandButton = document.querySelector(
      `#${UI_ELEMENT_IDS.PROMPT_PATTERNS} + .ai-floating-panel-text-actions button`
    ) as HTMLButtonElement;
    expandButton.click();

    const root = document.getElementById(
      'auto_illustrator_conso_floating_panel_root'
    ) as HTMLElement;
    const overlay = document.getElementById(
      'ai-floating-panel-overlay-text'
    ) as HTMLElement;
    const editor = document.getElementById(
      'ai-floating-panel-text-overlay-textarea'
    ) as HTMLTextAreaElement;
    const actionRow = document.querySelector(
      '.ai-floating-panel-text-overlay-actions'
    ) as HTMLElement;
    const actionButtons = actionRow.querySelectorAll('button');

    expect(root.classList.contains('text-overlay-open')).toBe(true);
    expect(overlay.classList.contains('open')).toBe(true);
    expect(editor.value).toBe('before');
    expect(actionButtons).toHaveLength(2);

    editor.value = 'after';
    document.getElementById('ai-floating-panel-text-overlay-apply')?.click();

    expect(original.value).toBe('after');
    expect(root.classList.contains('text-overlay-open')).toBe(false);
    expect(overlay.classList.contains('open')).toBe(false);
  });

  it('should decorate dynamically rendered preset import draft textareas', async () => {
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();

    const result = document.getElementById(
      UI_ELEMENT_IDS.PRESET_IMPORT_RESULT
    ) as HTMLElement;
    result.innerHTML = `
      <textarea class="text_pole textarea_compact" data-draft-field="sharedMetaPrompt">shared</textarea>
      <textarea class="text_pole textarea_compact" data-draft-field="promptWritingGuidelines">independent</textarea>
    `;

    await new Promise(resolve => setTimeout(resolve, 0));

    const draftFields = result.querySelectorAll('[data-draft-field]');
    expect(draftFields).toHaveLength(2);
    expect(
      result.querySelectorAll('.ai-floating-panel-text-actions button')
    ).toHaveLength(2);
  });

  it('should sync prompt mode visibility with the shared/independent radio buttons', () => {
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();

    const sharedSection = document.getElementById(
      'ai-floating-panel-shared-section'
    ) as HTMLElement;
    const independentSection = document.getElementById(
      'ai-floating-panel-independent-section'
    ) as HTMLElement;
    const sharedRadio = document.getElementById(
      UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_SHARED
    ) as HTMLInputElement;
    const independentRadio = document.getElementById(
      UI_ELEMENT_IDS.PROMPT_GENERATION_MODE_INDEPENDENT
    ) as HTMLInputElement;

    expect(independentSection.style.display).not.toBe('none');
    expect(sharedSection.style.display).toBe('none');

    sharedRadio.checked = true;
    independentRadio.checked = false;
    sharedRadio.dispatchEvent(new Event('change', {bubbles: true}));

    expect(sharedSection.style.display).not.toBe('none');
    expect(independentSection.style.display).toBe('none');
  });

  it('should sync standalone toggles with standalone source checkboxes only', () => {
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();

    const standaloneCharCheckbox = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_INCLUDE_CHAR_INFO
    ) as HTMLInputElement;
    const standaloneWorldCheckbox = document.getElementById(
      UI_ELEMENT_IDS.STANDALONE_INCLUDE_WORLD_INFO
    ) as HTMLInputElement;
    const standaloneCharToggle = document.getElementById(
      'ai-floating-panel-context-toggle-standalone'
    ) as HTMLInputElement;
    const standaloneWorldToggle = document.getElementById(
      'ai-floating-panel-world-toggle-standalone'
    ) as HTMLInputElement;

    expect(standaloneCharToggle.checked).toBe(true);
    expect(standaloneWorldToggle.checked).toBe(true);

    standaloneCharToggle.checked = false;
    standaloneCharToggle.dispatchEvent(new Event('change', {bubbles: true}));
    standaloneWorldToggle.checked = false;
    standaloneWorldToggle.dispatchEvent(new Event('change', {bubbles: true}));

    expect(standaloneCharCheckbox.checked).toBe(false);
    expect(standaloneWorldCheckbox.checked).toBe(false);
  });

  it('should close open overlays when the panel is closed', () => {
    document.body.insertAdjacentHTML('beforeend', createSettingsUI());

    initializeFloatingPanel();
    openFloatingPanel();

    const overlay = document.getElementById(
      'ai-floating-panel-overlay-context'
    ) as HTMLElement;
    const openButton = document.querySelector(
      '[data-open-overlay="ai-floating-panel-overlay-context"]'
    ) as HTMLButtonElement;
    const closeButton = document.getElementById(
      'ai-floating-panel-close'
    ) as HTMLButtonElement;

    openButton.click();
    expect(overlay.classList.contains('open')).toBe(true);

    closeButton.click();
    expect(overlay.classList.contains('open')).toBe(false);
  });
});
