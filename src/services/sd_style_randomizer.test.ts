/**
 * Tests for SD Style Randomizer Service
 */

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  pickRandomStyle,
  snapshotSdPrefixes,
  applySdStyle,
  restoreSdSnapshot,
  withRandomSdStyle,
  listAvailableStyleNames,
  buildSdStyleConfigFromSettings,
  _resetMutationChainForTests,
  type SdStyleRandomConfig,
  type SdStyleSnapshot,
} from './sd_style_randomizer';

vi.mock('../logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

interface MockJqElement {
  val: ReturnType<typeof vi.fn>;
  trigger: ReturnType<typeof vi.fn>;
}

function makeJqMock() {
  const calls: Array<{selector: string; value?: string; event?: string}> = [];
  const factory = (selector: string): MockJqElement => {
    let lastValue: string | undefined;
    const obj: MockJqElement = {
      val: vi.fn((v?: string) => {
        if (v !== undefined) {
          lastValue = v;
          calls.push({selector, value: v});
        }
        return obj;
      }),
      trigger: vi.fn((event: string) => {
        calls.push({selector, event, value: lastValue});
        return obj;
      }),
    };
    return obj;
  };
  return {factory, calls};
}

function makeContext(
  sd: Record<string, unknown> | null = {
    styles: [],
    prompt_prefix: '',
    negative_prompt: '',
  }
): SillyTavernContext {
  return {
    extensionSettings: sd === null ? {} : {sd},
  } as unknown as SillyTavernContext;
}

const baseConfig: SdStyleRandomConfig = {
  enabled: true,
  whitelist: [],
  restoreAfter: true,
};

beforeEach(() => {
  _resetMutationChainForTests();
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (global as any).$;
});

describe('pickRandomStyle', () => {
  it('returns null when config.enabled is false', () => {
    const ctx = makeContext({
      styles: [{name: 'a', prefix: 'p', negative: 'n'}],
      prompt_prefix: '',
      negative_prompt: '',
    });
    expect(pickRandomStyle(ctx, {...baseConfig, enabled: false})).toBeNull();
  });

  it('returns null when extension_settings.sd is missing', () => {
    expect(pickRandomStyle(makeContext(null), baseConfig)).toBeNull();
  });

  it('returns null when sd.styles is empty', () => {
    expect(pickRandomStyle(makeContext({styles: []}), baseConfig)).toBeNull();
  });

  it('returns null when sd.styles is not an array', () => {
    expect(
      pickRandomStyle(
        makeContext({styles: 'oops' as unknown as unknown[]}),
        baseConfig
      )
    ).toBeNull();
  });

  it('returns one of the styles when whitelist is empty', () => {
    const styles = [
      {name: 'a', prefix: 'pa', negative: 'na'},
      {name: 'b', prefix: 'pb', negative: 'nb'},
    ];
    const ctx = makeContext({styles, prompt_prefix: '', negative_prompt: ''});
    const picked = pickRandomStyle(ctx, baseConfig);
    expect(picked).not.toBeNull();
    expect(['a', 'b']).toContain(picked!.name);
  });

  it('returns only whitelisted styles when whitelist non-empty', () => {
    const styles = [
      {name: 'a', prefix: 'pa', negative: 'na'},
      {name: 'b', prefix: 'pb', negative: 'nb'},
      {name: 'c', prefix: 'pc', negative: 'nc'},
    ];
    const ctx = makeContext({styles, prompt_prefix: '', negative_prompt: ''});
    for (let i = 0; i < 20; i++) {
      const picked = pickRandomStyle(ctx, {
        ...baseConfig,
        whitelist: ['b'],
      });
      expect(picked!.name).toBe('b');
    }
  });

  it('returns null when whitelist filters out everything', () => {
    const styles = [{name: 'a', prefix: 'pa', negative: 'na'}];
    const ctx = makeContext({styles, prompt_prefix: '', negative_prompt: ''});
    expect(
      pickRandomStyle(ctx, {...baseConfig, whitelist: ['nonexistent']})
    ).toBeNull();
  });

  it('whitelist of size 1 (exists in styles): deterministically returns that one style every call', () => {
    const styles = [
      {name: 'alpha', prefix: 'pA', negative: 'nA'},
      {name: 'beta', prefix: 'pB', negative: 'nB'},
      {name: 'gamma', prefix: 'pG', negative: 'nG'},
    ];
    const ctx = makeContext({styles, prompt_prefix: '', negative_prompt: ''});
    for (let i = 0; i < 100; i++) {
      const picked = pickRandomStyle(ctx, {
        ...baseConfig,
        whitelist: ['beta'],
      });
      expect(picked).not.toBeNull();
      expect(picked!.name).toBe('beta');
      expect(picked!.prefix).toBe('pB');
      expect(picked!.negative).toBe('nB');
    }
  });

  it('whitelist of size 1 (does NOT exist in styles): falls back to null safely (no crash)', () => {
    const styles = [
      {name: 'alpha', prefix: 'pA', negative: 'nA'},
      {name: 'beta', prefix: 'pB', negative: 'nB'},
    ];
    const ctx = makeContext({styles, prompt_prefix: '', negative_prompt: ''});
    expect(
      pickRandomStyle(ctx, {...baseConfig, whitelist: ['deleted-style']})
    ).toBeNull();
  });

  it('skips malformed style entries', () => {
    const styles = [
      {name: 'good', prefix: 'p', negative: 'n'},
      {name: 'no-prefix'} as unknown,
      null,
      'string-not-object' as unknown,
    ];
    const ctx = makeContext({styles, prompt_prefix: '', negative_prompt: ''});
    const picked = pickRandomStyle(ctx, baseConfig);
    expect(picked!.name).toBe('good');
  });
});

describe('snapshotSdPrefixes', () => {
  it('captures both fields verbatim', () => {
    const ctx = makeContext({
      styles: [],
      prompt_prefix: 'orig-prefix',
      negative_prompt: 'orig-neg',
    });
    expect(snapshotSdPrefixes(ctx)).toEqual({
      promptPrefix: 'orig-prefix',
      negativePrompt: 'orig-neg',
    });
  });

  it('returns empty strings when sd namespace is missing', () => {
    expect(snapshotSdPrefixes(makeContext(null))).toEqual({
      promptPrefix: '',
      negativePrompt: '',
    });
  });
});

describe('applySdStyle', () => {
  it('writes both fields and triggers jQuery input events', () => {
    const sd = {styles: [], prompt_prefix: 'old-p', negative_prompt: 'old-n'};
    const ctx = makeContext(sd);
    const {factory, calls} = makeJqMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).$ = factory;

    applySdStyle(ctx, {prefix: 'new-p', negative: 'new-n'});

    expect(sd.prompt_prefix).toBe('new-p');
    expect(sd.negative_prompt).toBe('new-n');
    expect(calls).toContainEqual({
      selector: '#sd_prompt_prefix',
      value: 'new-p',
    });
    expect(calls).toContainEqual({
      selector: '#sd_negative_prompt',
      value: 'new-n',
    });
    expect(
      calls.some(c => c.selector === '#sd_prompt_prefix' && c.event === 'input')
    ).toBe(true);
  });

  it('is a no-op when extension_settings.sd is missing', () => {
    const ctx = makeContext(null);
    expect(() => applySdStyle(ctx, {prefix: 'x', negative: 'y'})).not.toThrow();
  });
});

describe('restoreSdSnapshot', () => {
  it('restores both fields when current values still equal what we wrote', () => {
    const sd = {
      styles: [],
      prompt_prefix: 'we-wrote-p',
      negative_prompt: 'we-wrote-n',
    };
    const ctx = makeContext(sd);

    restoreSdSnapshot(
      ctx,
      {promptPrefix: 'orig-p', negativePrompt: 'orig-n'},
      {promptPrefix: 'we-wrote-p', negativePrompt: 'we-wrote-n'}
    );

    expect(sd.prompt_prefix).toBe('orig-p');
    expect(sd.negative_prompt).toBe('orig-n');
  });

  it('preserves user edits when current value differs from what we wrote', () => {
    const sd = {
      styles: [],
      prompt_prefix: 'user-edited-p',
      negative_prompt: 'we-wrote-n',
    };
    const ctx = makeContext(sd);

    restoreSdSnapshot(
      ctx,
      {promptPrefix: 'orig-p', negativePrompt: 'orig-n'},
      {promptPrefix: 'we-wrote-p', negativePrompt: 'we-wrote-n'}
    );

    expect(sd.prompt_prefix).toBe('user-edited-p'); // user edit preserved
    expect(sd.negative_prompt).toBe('orig-n'); // negative not edited, restored
  });
});

describe('listAvailableStyleNames', () => {
  it('returns empty array when no styles', () => {
    expect(listAvailableStyleNames(makeContext({styles: []}))).toEqual([]);
  });

  it('returns names in stored order', () => {
    const styles = [
      {name: 'first', prefix: '', negative: ''},
      {name: 'second', prefix: '', negative: ''},
    ];
    expect(
      listAvailableStyleNames(
        makeContext({styles, prompt_prefix: '', negative_prompt: ''})
      )
    ).toEqual(['first', 'second']);
  });
});

describe('withRandomSdStyle', () => {
  function setupCtx(
    overrides: Partial<{
      styles: unknown[];
      prompt_prefix: string;
      negative_prompt: string;
    }> = {}
  ) {
    const sd = {
      styles: overrides.styles ?? [{name: 's1', prefix: 'p1', negative: 'n1'}],
      prompt_prefix: overrides.prompt_prefix ?? 'orig-p',
      negative_prompt: overrides.negative_prompt ?? 'orig-n',
    };
    const ctx = makeContext(sd);
    return {sd, ctx};
  }

  it('disabled: calls generateFn directly without touching sd fields', async () => {
    const {sd, ctx} = setupCtx();
    const gen = vi.fn().mockResolvedValue('image-url');

    const result = await withRandomSdStyle(
      ctx,
      {...baseConfig, enabled: false},
      gen
    );

    expect(result).toBe('image-url');
    expect(gen).toHaveBeenCalledOnce();
    expect(sd.prompt_prefix).toBe('orig-p');
    expect(sd.negative_prompt).toBe('orig-n');
  });

  it('enabled but no styles: fast-path, fields untouched', async () => {
    const {sd, ctx} = setupCtx({styles: []});
    const gen = vi.fn().mockResolvedValue('image-url');

    const result = await withRandomSdStyle(ctx, baseConfig, gen);

    expect(result).toBe('image-url');
    expect(sd.prompt_prefix).toBe('orig-p');
    expect(sd.negative_prompt).toBe('orig-n');
  });

  it('enabled with styles: snapshot → apply → generate → restore', async () => {
    const {sd, ctx} = setupCtx();
    const observed: SdStyleSnapshot[] = [];
    const onPicked = vi.fn();
    const gen = vi.fn().mockImplementation(async () => {
      observed.push({
        promptPrefix: sd.prompt_prefix,
        negativePrompt: sd.negative_prompt,
      });
      return 'image-url';
    });

    await withRandomSdStyle(ctx, baseConfig, gen, onPicked);

    expect(observed[0]).toEqual({promptPrefix: 'p1', negativePrompt: 'n1'});
    expect(onPicked).toHaveBeenCalledWith('s1');
    // restored after
    expect(sd.prompt_prefix).toBe('orig-p');
    expect(sd.negative_prompt).toBe('orig-n');
  });

  it('restoreAfter=false: leaves picked style applied', async () => {
    const {sd, ctx} = setupCtx();
    const gen = vi.fn().mockResolvedValue('image-url');

    await withRandomSdStyle(ctx, {...baseConfig, restoreAfter: false}, gen);

    expect(sd.prompt_prefix).toBe('p1');
    expect(sd.negative_prompt).toBe('n1');
  });

  it('serialization: two parallel calls run snapshot/apply/restore strictly in order', async () => {
    const sd = {
      styles: [{name: 's1', prefix: 'P', negative: 'N'}],
      prompt_prefix: 'orig-p',
      negative_prompt: 'orig-n',
    };
    const ctx = makeContext(sd);

    const log: string[] = [];
    const makeGen = (label: string, ms: number) =>
      vi.fn(async () => {
        log.push(`${label}:enter:${sd.prompt_prefix}`);
        await new Promise(r => setTimeout(r, ms));
        log.push(`${label}:exit`);
        return label;
      });

    const a = withRandomSdStyle(ctx, baseConfig, makeGen('A', 30));
    const b = withRandomSdStyle(ctx, baseConfig, makeGen('B', 10));

    await Promise.all([a, b]);

    // A must fully complete before B starts (no interleaving)
    expect(log).toEqual(['A:enter:P', 'A:exit', 'B:enter:P', 'B:exit']);
    // Final state: restored
    expect(sd.prompt_prefix).toBe('orig-p');
    expect(sd.negative_prompt).toBe('orig-n');
  });

  it('generateFn throws → restore still runs (finally semantics)', async () => {
    const {sd, ctx} = setupCtx();
    const gen = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(withRandomSdStyle(ctx, baseConfig, gen)).rejects.toThrow(
      'boom'
    );

    expect(sd.prompt_prefix).toBe('orig-p');
    expect(sd.negative_prompt).toBe('orig-n');
  });

  it('generateFn throws → next call still proceeds (chain not stuck)', async () => {
    const {sd, ctx} = setupCtx();
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const succeeding = vi.fn().mockResolvedValue('ok');

    await expect(withRandomSdStyle(ctx, baseConfig, failing)).rejects.toThrow();
    const result = await withRandomSdStyle(ctx, baseConfig, succeeding);

    expect(result).toBe('ok');
    expect(sd.prompt_prefix).toBe('orig-p');
  });

  it('whitelist points to a deleted style: fast-path, generateFn still runs with current SD prefixes', async () => {
    // User picked "the-favorite-style" yesterday, then deleted it from SD
    // extension today. Today's generation must still work — falling back to
    // whatever SD extension currently has selected.
    const sd = {
      styles: [
        {name: 'still-here-A', prefix: 'pA', negative: 'nA'},
        {name: 'still-here-B', prefix: 'pB', negative: 'nB'},
      ],
      prompt_prefix: 'manually-selected-p',
      negative_prompt: 'manually-selected-n',
    };
    const ctx = makeContext(sd);
    const observed: {prefix: string; negative: string}[] = [];
    const gen = vi.fn(async () => {
      observed.push({
        prefix: sd.prompt_prefix,
        negative: sd.negative_prompt,
      });
      return 'http://ok/img.png';
    });

    const result = await withRandomSdStyle(
      ctx,
      {enabled: true, whitelist: ['the-favorite-style'], restoreAfter: true},
      gen
    );

    expect(result).toBe('http://ok/img.png');
    expect(gen).toHaveBeenCalledOnce();
    // Fields should NOT have been touched — fast-path bypasses snapshot/apply.
    expect(observed[0]).toEqual({
      prefix: 'manually-selected-p',
      negative: 'manually-selected-n',
    });
    expect(sd.prompt_prefix).toBe('manually-selected-p');
    expect(sd.negative_prompt).toBe('manually-selected-n');
  });

  it('whitelist of size 1 with a present style: every generation uses that one style and restores cleanly', async () => {
    const sd = {
      styles: [
        {name: 'alpha', prefix: 'pA', negative: 'nA'},
        {name: 'lock-me', prefix: 'pLOCK', negative: 'nLOCK'},
        {name: 'beta', prefix: 'pB', negative: 'nB'},
      ],
      prompt_prefix: 'orig-p',
      negative_prompt: 'orig-n',
    };
    const ctx = makeContext(sd);

    const observed: string[] = [];
    const gen = vi.fn(async () => {
      observed.push(sd.prompt_prefix);
      return 'ok';
    });

    for (let i = 0; i < 5; i++) {
      const result = await withRandomSdStyle(
        ctx,
        {enabled: true, whitelist: ['lock-me'], restoreAfter: true},
        gen
      );
      expect(result).toBe('ok');
    }

    // Every single generation observed the locked-style's prefix mid-flight.
    expect(observed).toEqual(['pLOCK', 'pLOCK', 'pLOCK', 'pLOCK', 'pLOCK']);
    // Final state: original restored.
    expect(sd.prompt_prefix).toBe('orig-p');
    expect(sd.negative_prompt).toBe('orig-n');
  });
});

describe('buildSdStyleConfigFromSettings', () => {
  it('maps settings fields with safe fallbacks', () => {
    const cfg = buildSdStyleConfigFromSettings({
      randomizeSdStylePerGeneration: true,
      sdStylePoolWhitelist: ['a', 'b'],
      restoreSdStyleAfter: true,
    } as unknown as AutoIllustratorSettings);
    expect(cfg).toEqual({
      enabled: true,
      whitelist: ['a', 'b'],
      restoreAfter: true,
    });
  });

  it('coerces missing whitelist to empty array', () => {
    const cfg = buildSdStyleConfigFromSettings({
      randomizeSdStylePerGeneration: true,
      sdStylePoolWhitelist: undefined,
      restoreSdStyleAfter: true,
    } as unknown as AutoIllustratorSettings);
    expect(cfg.whitelist).toEqual([]);
  });

  it('clones the whitelist array (no shared reference)', () => {
    const settings = {
      randomizeSdStylePerGeneration: true,
      sdStylePoolWhitelist: ['x'],
      restoreSdStyleAfter: true,
    } as unknown as AutoIllustratorSettings;
    const cfg = buildSdStyleConfigFromSettings(settings);
    cfg.whitelist.push('y');
    expect(settings.sdStylePoolWhitelist).toEqual(['x']);
  });

  it('uses fixed SD Style when generation style mode is fixed', () => {
    const cfg = buildSdStyleConfigFromSettings({
      generationStyleMode: 'fixed',
      fixedSdStyleName: 'Oil Style',
      randomizeSdStylePerGeneration: true,
      sdStylePoolWhitelist: ['Random Style'],
      restoreSdStyleAfter: true,
    } as unknown as AutoIllustratorSettings);
    expect(cfg).toEqual({
      enabled: true,
      whitelist: ['Oil Style'],
      restoreAfter: true,
    });
  });

  it('uses selected saved generation style preset before fixed fallback', () => {
    const cfg = buildSdStyleConfigFromSettings({
      generationStyleMode: 'fixed',
      generationStylePresets: [
        {
          id: 'preset-1',
          name: 'Oil + aaa',
          sdStyleName: 'Preset Oil',
          vibeCombinationId: 'combo1',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      currentGenerationStylePresetId: 'preset-1',
      fixedSdStyleName: 'Fallback Oil',
      restoreSdStyleAfter: true,
    } as unknown as AutoIllustratorSettings);
    expect(cfg).toEqual({
      enabled: true,
      whitelist: ['Preset Oil'],
      restoreAfter: true,
    });
  });

  it('disables SD Style mutation when generation style mode is off', () => {
    const cfg = buildSdStyleConfigFromSettings({
      generationStyleMode: 'off',
      fixedSdStyleName: 'Oil Style',
      randomizeSdStylePerGeneration: true,
      sdStylePoolWhitelist: ['Random Style'],
      restoreSdStyleAfter: true,
    } as unknown as AutoIllustratorSettings);
    expect(cfg.enabled).toBe(false);
    expect(cfg.whitelist).toEqual([]);
  });
});
