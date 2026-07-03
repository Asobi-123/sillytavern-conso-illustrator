/**
 * SD Style Randomizer Service
 *
 * Picks a random Style entry from SillyTavern's stable-diffusion extension
 * (`extension_settings.sd.styles[]`) before each `/sd` invocation, temporarily
 * overwrites `extension_settings.sd.prompt_prefix` and
 * `extension_settings.sd.negative_prompt`, then restores the originals after
 * generation completes.
 *
 * The whole snapshot → apply → generate → restore sequence is serialized via
 * a module-level Promise chain, so it remains correct even when the outer
 * image generation limiter has `maxConcurrent > 1`.
 */

import {createLogger} from '../logger';

const logger = createLogger('SdStyleRandomizer');

/**
 * Captured SD prefix state at the moment we started a generation.
 */
export interface SdStyleSnapshot {
  promptPrefix: string;
  negativePrompt: string;
}

/**
 * Runtime config derived from AutoIllustratorSettings.
 */
export interface SdStyleRandomConfig {
  enabled: boolean;
  /** Whitelist of style names eligible for the random pick. Empty = all. */
  whitelist: string[];
  /** Whether to write originals back after generation completes. */
  restoreAfter: boolean;
}

/**
 * One row from `extension_settings.sd.styles[]`.
 */
interface SdStyleEntry {
  name: string;
  prefix: string;
  negative: string;
}

function readSdNamespace(
  context: SillyTavernContext
): Record<string, unknown> | null {
  const sd = context.extensionSettings?.sd;
  if (!sd || typeof sd !== 'object') return null;
  return sd as Record<string, unknown>;
}

function readStyles(context: SillyTavernContext): SdStyleEntry[] {
  const sd = readSdNamespace(context);
  if (!sd) return [];
  const raw = sd.styles;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (entry): entry is SdStyleEntry =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as SdStyleEntry).name === 'string' &&
        typeof (entry as SdStyleEntry).prefix === 'string' &&
        typeof (entry as SdStyleEntry).negative === 'string'
    )
    .map(entry => ({
      name: entry.name,
      prefix: entry.prefix,
      negative: entry.negative,
    }));
}

/**
 * Returns a random eligible style or null if random selection is not possible
 * (disabled, no SD namespace, no styles, or whitelist filters everything out).
 */
export function pickRandomStyle(
  context: SillyTavernContext,
  config: SdStyleRandomConfig
): SdStyleEntry | null {
  if (!config.enabled) return null;
  const allStyles = readStyles(context);
  if (allStyles.length === 0) return null;

  const eligible =
    config.whitelist.length === 0
      ? allStyles
      : allStyles.filter(s => config.whitelist.includes(s.name));

  if (eligible.length === 0) return null;

  const idx = Math.floor(Math.random() * eligible.length);
  return eligible[idx];
}

/**
 * Captures the current `prompt_prefix` / `negative_prompt` verbatim.
 */
export function snapshotSdPrefixes(
  context: SillyTavernContext
): SdStyleSnapshot {
  const sd = readSdNamespace(context);
  return {
    promptPrefix:
      sd && typeof sd.prompt_prefix === 'string' ? sd.prompt_prefix : '',
    negativePrompt:
      sd && typeof sd.negative_prompt === 'string' ? sd.negative_prompt : '',
  };
}

/**
 * Writes prefix / negative onto `extension_settings.sd.*` and triggers the
 * jQuery `input` event on the corresponding textareas so the SD extension UI
 * reflects the change.
 */
export function applySdStyle(
  context: SillyTavernContext,
  style: {prefix: string; negative: string}
): void {
  const sd = readSdNamespace(context);
  if (!sd) {
    logger.warn(
      'extension_settings.sd is missing; cannot apply random SD style.'
    );
    return;
  }
  sd.prompt_prefix = style.prefix;
  sd.negative_prompt = style.negative;

  // Trigger UI sync if jQuery is available.
  try {
    if (typeof $ === 'function') {
      $('#sd_prompt_prefix').val(style.prefix).trigger('input');
      $('#sd_negative_prompt').val(style.negative).trigger('input');
    }
  } catch (err) {
    logger.debug('jQuery UI sync skipped:', err);
  }
}

/**
 * Restores a snapshot only if the current value still equals what we wrote.
 * If the user manually edited the textarea mid-generation, leave their edit
 * alone.
 */
export function restoreSdSnapshot(
  context: SillyTavernContext,
  snapshot: SdStyleSnapshot,
  weWrote: SdStyleSnapshot
): void {
  const sd = readSdNamespace(context);
  if (!sd) return;

  const current: SdStyleSnapshot = {
    promptPrefix: typeof sd.prompt_prefix === 'string' ? sd.prompt_prefix : '',
    negativePrompt:
      typeof sd.negative_prompt === 'string' ? sd.negative_prompt : '',
  };

  if (current.promptPrefix === weWrote.promptPrefix) {
    sd.prompt_prefix = snapshot.promptPrefix;
    try {
      if (typeof $ === 'function') {
        $('#sd_prompt_prefix').val(snapshot.promptPrefix).trigger('input');
      }
    } catch {
      /* noop */
    }
  } else {
    logger.debug(
      'Prompt prefix changed mid-flight; preserving user edit instead of restoring.'
    );
  }

  if (current.negativePrompt === weWrote.negativePrompt) {
    sd.negative_prompt = snapshot.negativePrompt;
    try {
      if (typeof $ === 'function') {
        $('#sd_negative_prompt').val(snapshot.negativePrompt).trigger('input');
      }
    } catch {
      /* noop */
    }
  } else {
    logger.debug(
      'Negative prompt changed mid-flight; preserving user edit instead of restoring.'
    );
  }
}

/**
 * Returns the names of every style currently saved in the SD extension.
 * Used by the conso settings UI to render the whitelist checklist.
 */
export function listAvailableStyleNames(context: SillyTavernContext): string[] {
  return readStyles(context).map(s => s.name);
}

/**
 * Module-level chain ensuring snapshot → apply → generateFn → restore is
 * strictly serialized across the entire session.
 */
let mutationChain: Promise<unknown> = Promise.resolve();

/**
 * Wraps `generateFn` with optional random SD style application.
 *
 * - If `config.enabled` is false OR no eligible style is available, calls
 *   `generateFn()` directly with zero side effects (fast-path).
 * - Otherwise, snapshots current SD prefixes, applies a random pick, awaits
 *   `generateFn()`, then restores (when `restoreAfter` is true).
 * - All four steps are serialized via the module-level chain so concurrent
 *   image generations don't trample each other's prefix mutations.
 */
export function withRandomSdStyle<T>(
  context: SillyTavernContext,
  config: SdStyleRandomConfig,
  generateFn: () => Promise<T>,
  onPicked?: (styleName: string) => void
): Promise<T> {
  if (!config.enabled) {
    return generateFn();
  }

  const job = mutationChain.then(async () => {
    const picked = pickRandomStyle(context, config);
    if (!picked) {
      // Fast-path: no eligible style; behave as if disabled.
      return generateFn();
    }

    const snapshot = snapshotSdPrefixes(context);
    const weWrote: SdStyleSnapshot = {
      promptPrefix: picked.prefix,
      negativePrompt: picked.negative,
    };

    logger.debug(
      `Applying random SD style "${picked.name}" (snapshot retained for restore=${config.restoreAfter})`
    );
    onPicked?.(picked.name);
    applySdStyle(context, picked);

    try {
      return await generateFn();
    } finally {
      if (config.restoreAfter) {
        restoreSdSnapshot(context, snapshot, weWrote);
      }
    }
  });

  // Keep the chain advancing even if this job throws, so the next caller
  // doesn't get stuck behind a rejected promise.
  mutationChain = job.catch(() => {
    /* swallow for chain progression; job's own caller still gets the rejection */
  });

  return job;
}

/**
 * Test-only helper: reset the serialization chain between tests.
 * @internal
 */
export function _resetMutationChainForTests(): void {
  mutationChain = Promise.resolve();
}

/**
 * Builds runtime config from persisted settings.
 */
export function buildSdStyleConfigFromSettings(
  s: AutoIllustratorSettings
): SdStyleRandomConfig {
  if (s.generationStyleMode === 'fixed') {
    const preset = Array.isArray(s.generationStylePresets)
      ? s.generationStylePresets.find(
          entry => entry.id === s.currentGenerationStylePresetId
        )
      : undefined;
    const fixedStyle =
      typeof preset?.sdStyleName === 'string'
        ? preset.sdStyleName.trim()
        : typeof s.fixedSdStyleName === 'string'
          ? s.fixedSdStyleName.trim()
          : '';
    return {
      enabled: !!fixedStyle,
      whitelist: fixedStyle ? [fixedStyle] : [],
      restoreAfter: s.restoreSdStyleAfter !== false,
    };
  }

  if (s.generationStyleMode === 'off') {
    return {
      enabled: false,
      whitelist: [],
      restoreAfter: s.restoreSdStyleAfter !== false,
    };
  }

  return {
    enabled: !!s.randomizeSdStylePerGeneration,
    whitelist: Array.isArray(s.sdStylePoolWhitelist)
      ? [...s.sdStylePoolWhitelist]
      : [],
    restoreAfter: s.restoreSdStyleAfter !== false,
  };
}
