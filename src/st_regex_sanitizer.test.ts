import {beforeEach, describe, expect, it, vi} from 'vitest';
import {initializeI18n} from './i18n';
import {
  getManagedRegexState,
  MANAGED_REGEX_DEFINITIONS,
  setManagedRegexRuleEnabled,
  syncManagedRegexScripts,
} from './st_regex_sanitizer';
import {createMockContext} from './test_helpers';

type TestRegexScript = {
  id: string;
  scriptName: string;
  disabled: boolean;
  findRegex: string;
  placement: number[];
  minDepth: number;
  promptOnly: boolean;
};

function createContext(extensionSettings: Record<string, unknown> = {}): {
  context: SillyTavernContext;
  saveSettingsDebounced: ReturnType<typeof vi.fn>;
} {
  const saveSettingsDebounced = vi.fn();
  const context = createMockContext({
    extensionSettings,
    saveSettingsDebounced,
    translate: (_text: string, key?: string | null) => key ?? _text,
  });
  initializeI18n(context);
  return {context, saveSettingsDebounced};
}

function scripts(context: SillyTavernContext): TestRegexScript[] {
  return context.extensionSettings.regex as TestRegexScript[];
}

describe('st_regex_sanitizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create missing ST Regex scripts enabled by default', () => {
    const {context, saveSettingsDebounced} = createContext({});

    const changed = syncManagedRegexScripts(context);
    const created = scripts(context);

    expect(changed).toBe(true);
    expect(created).toHaveLength(3);
    expect(created.map(script => script.id)).toEqual(
      MANAGED_REGEX_DEFINITIONS.map(definition => definition.id)
    );
    expect(created.every(script => script.disabled === false)).toBe(true);
    expect(created.every(script => script.promptOnly === true)).toBe(true);
    expect(created.every(script => script.minDepth === 0)).toBe(true);
    expect(created.every(script => script.placement.join(',') === '1,2')).toBe(
      true
    );
    expect(getManagedRegexState(context).allEnabled).toBe(true);
    expect(saveSettingsDebounced).toHaveBeenCalledTimes(1);
  });

  it('should toggle a managed regex rule through the ST Regex disabled flag', () => {
    const {context, saveSettingsDebounced} = createContext({});
    syncManagedRegexScripts(context);
    saveSettingsDebounced.mockClear();

    setManagedRegexRuleEnabled(context, 'imgTag', false);

    expect(
      scripts(context).find(script => script.id.includes('img-tag'))?.disabled
    ).toBe(true);
    expect(getManagedRegexState(context).allEnabled).toBe(false);
    expect(getManagedRegexState(context).anyEnabled).toBe(true);
    expect(saveSettingsDebounced).toHaveBeenCalledTimes(1);

    setManagedRegexRuleEnabled(context, 'imgTag', true);

    expect(
      scripts(context).find(script => script.id.includes('img-tag'))?.disabled
    ).toBe(false);
    expect(getManagedRegexState(context).allEnabled).toBe(true);
  });

  it('should refresh managed templates while preserving enabled state', () => {
    const definition = MANAGED_REGEX_DEFINITIONS[0];
    const {context} = createContext({
      regex: [
        {
          id: definition.id,
          scriptName: 'old name',
          disabled: true,
          findRegex: '/old/g',
          placement: [],
          minDepth: 0,
          promptOnly: false,
        },
      ],
    });

    syncManagedRegexScripts(context, {overwriteExisting: true});

    const refreshed = scripts(context).find(
      script => script.id === definition.id
    );
    expect(refreshed?.disabled).toBe(true);
    expect(refreshed?.findRegex).toBe(definition.findRegex);
    expect(refreshed?.promptOnly).toBe(true);
    expect(refreshed?.minDepth).toBe(0);
  });
});
