import {UI_ELEMENT_IDS, UI_SECTION_IDS} from './constants';
import {t} from './i18n';
import {createLogger} from './logger';

const logger = createLogger('StRegexSanitizer');

export type ManagedRegexKey = 'imgPrompt' | 'autoIllustrator' | 'imgTag';

type StRegexScript = {
  id: string;
  scriptName: string;
  disabled: boolean;
  runOnEdit: boolean;
  findRegex: string;
  trimStrings: string[];
  replaceString: string;
  placement: number[];
  substituteRegex: number;
  minDepth: number;
  maxDepth: number | null;
  markdownOnly: boolean;
  promptOnly: boolean;
};

type ManagedRegexDefinition = {
  key: ManagedRegexKey;
  id: string;
  nameKey: string;
  findRegex: string;
};

type ManagedRegexRuleState = {
  key: ManagedRegexKey;
  installed: boolean;
  enabled: boolean;
};

export type ManagedRegexState = {
  rules: ManagedRegexRuleState[];
  allInstalled: boolean;
  allEnabled: boolean;
  anyEnabled: boolean;
  regexExtensionDisabled: boolean;
};

const USER_INPUT_PLACEMENT = 1;
const AI_OUTPUT_PLACEMENT = 2;
const FIND_REGEX_SUBSTITUTE_NONE = 0;

export const MANAGED_REGEX_DEFINITIONS: ManagedRegexDefinition[] = [
  {
    key: 'imgPrompt',
    id: 'conso-regex-img-prompt-sanitizer',
    nameKey: 'regex.rule.imgPrompt',
    findRegex: '/<!--\\s*img-prompt=[\\s\\S]*?-->/g',
  },
  {
    key: 'autoIllustrator',
    id: 'conso-regex-auto-illustrator-sanitizer',
    nameKey: 'regex.rule.autoIllustrator',
    findRegex: '/<!--\\s*auto-illustrator:[\\s\\S]*?-->/g',
  },
  {
    key: 'imgTag',
    id: 'conso-regex-img-tag-sanitizer',
    nameKey: 'regex.rule.imgTag',
    findRegex: '/<img\\b[^>]*>/gi',
  },
];

function getRegexList(context: SillyTavernContext): StRegexScript[] {
  const extensionSettings = context.extensionSettings as Record<
    string,
    unknown
  >;
  if (!Array.isArray(extensionSettings.regex)) {
    extensionSettings.regex = [];
  }
  return extensionSettings.regex as StRegexScript[];
}

function isRegexExtensionDisabled(context: SillyTavernContext): boolean {
  const disabledExtensions = context.extensionSettings.disabledExtensions;
  return (
    Array.isArray(disabledExtensions) && disabledExtensions.includes('regex')
  );
}

function buildScript(definition: ManagedRegexDefinition): StRegexScript {
  return {
    id: definition.id,
    scriptName: t(definition.nameKey),
    disabled: false,
    runOnEdit: true,
    findRegex: definition.findRegex,
    trimStrings: [],
    replaceString: '',
    placement: [USER_INPUT_PLACEMENT, AI_OUTPUT_PLACEMENT],
    substituteRegex: FIND_REGEX_SUBSTITUTE_NONE,
    minDepth: 0,
    maxDepth: null,
    markdownOnly: false,
    promptOnly: true,
  };
}

function saveRegexSettings(context: SillyTavernContext): void {
  context.saveSettingsDebounced();
}

function findScript(
  scripts: StRegexScript[],
  definition: ManagedRegexDefinition
): StRegexScript | undefined {
  return scripts.find(script => script.id === definition.id);
}

export function syncManagedRegexScripts(
  context: SillyTavernContext,
  options: {overwriteExisting?: boolean} = {}
): boolean {
  const scripts = getRegexList(context);
  let changed = false;

  for (const definition of MANAGED_REGEX_DEFINITIONS) {
    const existingIndex = scripts.findIndex(
      script => script.id === definition.id
    );
    const builtInScript = buildScript(definition);

    if (existingIndex === -1) {
      scripts.push(builtInScript);
      changed = true;
      continue;
    }

    if (options.overwriteExisting) {
      const existing = scripts[existingIndex];
      scripts[existingIndex] = {
        ...existing,
        ...builtInScript,
        disabled: existing.disabled,
      };
      changed = true;
    }
  }

  if (changed) {
    saveRegexSettings(context);
  }
  return changed;
}

export function getManagedRegexState(
  context: SillyTavernContext
): ManagedRegexState {
  const scripts = getRegexList(context);
  const rules = MANAGED_REGEX_DEFINITIONS.map(definition => {
    const script = findScript(scripts, definition);
    return {
      key: definition.key,
      installed: Boolean(script),
      enabled: Boolean(script && !script.disabled),
    };
  });
  return {
    rules,
    allInstalled: rules.every(rule => rule.installed),
    allEnabled: rules.every(rule => rule.enabled),
    anyEnabled: rules.some(rule => rule.enabled),
    regexExtensionDisabled: isRegexExtensionDisabled(context),
  };
}

export function setManagedRegexRuleEnabled(
  context: SillyTavernContext,
  key: ManagedRegexKey,
  enabled: boolean
): void {
  syncManagedRegexScripts(context);
  const scripts = getRegexList(context);
  const definition = MANAGED_REGEX_DEFINITIONS.find(rule => rule.key === key);
  if (!definition) return;

  const script = findScript(scripts, definition);
  if (!script) return;
  script.disabled = !enabled;
  saveRegexSettings(context);
}

export function setAllManagedRegexRulesEnabled(
  context: SillyTavernContext,
  enabled: boolean
): void {
  syncManagedRegexScripts(context);
  const scripts = getRegexList(context);

  for (const definition of MANAGED_REGEX_DEFINITIONS) {
    const script = findScript(scripts, definition);
    if (script) {
      script.disabled = !enabled;
    }
  }

  saveRegexSettings(context);
}

function input(id: string): HTMLInputElement | null {
  return document.getElementById(id) as HTMLInputElement | null;
}

function setRuleInput(
  id: string,
  state: ManagedRegexState,
  key: ManagedRegexKey
): void {
  const target = input(id);
  const rule = state.rules.find(item => item.key === key);
  if (target && rule) {
    target.checked = rule.enabled;
    target.disabled = state.regexExtensionDisabled;
  }
}

function syncPanelState(context: SillyTavernContext): void {
  const state = getManagedRegexState(context);
  const master = input(UI_ELEMENT_IDS.REGEX_MASTER);

  if (master) {
    master.checked = state.allEnabled;
    master.indeterminate = state.anyEnabled && !state.allEnabled;
    master.disabled = state.regexExtensionDisabled;
  }

  setRuleInput(UI_ELEMENT_IDS.REGEX_IMG_PROMPT, state, 'imgPrompt');
  setRuleInput(UI_ELEMENT_IDS.REGEX_AUTO_ILLUSTRATOR, state, 'autoIllustrator');
  setRuleInput(UI_ELEMENT_IDS.REGEX_IMG_TAG, state, 'imgTag');

  const status = document.getElementById(UI_ELEMENT_IDS.REGEX_STATUS);
  if (!status) return;

  if (state.regexExtensionDisabled) {
    status.textContent = t('regex.statusExtensionDisabled');
  } else if (!state.allInstalled) {
    status.textContent = t('regex.statusMissing');
  } else if (state.allEnabled) {
    status.textContent = t('regex.statusAllEnabled');
  } else if (state.anyEnabled) {
    status.textContent = t('regex.statusPartial');
  } else {
    status.textContent = t('regex.statusAllDisabled');
  }
}

function bindCheckbox(
  id: string,
  context: SillyTavernContext,
  key: ManagedRegexKey
): void {
  const target = input(id);
  if (!target || target.dataset.regexSanitizerBound === 'true') return;
  target.dataset.regexSanitizerBound = 'true';
  target.addEventListener('change', () => {
    setManagedRegexRuleEnabled(context, key, target.checked);
    syncPanelState(context);
  });
}

export function initializeRegexSanitizerPanel(
  context: SillyTavernContext
): void {
  const section = document.getElementById(UI_SECTION_IDS.MAIN_REGEX);
  if (!section) return;

  syncManagedRegexScripts(context);
  syncPanelState(context);

  const master = input(UI_ELEMENT_IDS.REGEX_MASTER);
  if (master && master.dataset.regexSanitizerBound !== 'true') {
    master.dataset.regexSanitizerBound = 'true';
    master.addEventListener('change', () => {
      setAllManagedRegexRulesEnabled(context, master.checked);
      syncPanelState(context);
    });
  }

  bindCheckbox(UI_ELEMENT_IDS.REGEX_IMG_PROMPT, context, 'imgPrompt');
  bindCheckbox(
    UI_ELEMENT_IDS.REGEX_AUTO_ILLUSTRATOR,
    context,
    'autoIllustrator'
  );
  bindCheckbox(UI_ELEMENT_IDS.REGEX_IMG_TAG, context, 'imgTag');

  const syncButton = document.getElementById(UI_ELEMENT_IDS.REGEX_SYNC);
  if (syncButton && syncButton.dataset.regexSanitizerBound !== 'true') {
    syncButton.dataset.regexSanitizerBound = 'true';
    syncButton.addEventListener('click', () => {
      syncManagedRegexScripts(context, {overwriteExisting: true});
      syncPanelState(context);
      logger.info('Synchronized managed ST Regex scripts');
      toastr.success(t('regex.synced'), t('extensionName'));
    });
  }
}
