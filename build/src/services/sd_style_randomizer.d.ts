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
/**
 * Returns a random eligible style or null if random selection is not possible
 * (disabled, no SD namespace, no styles, or whitelist filters everything out).
 */
export declare function pickRandomStyle(context: SillyTavernContext, config: SdStyleRandomConfig): SdStyleEntry | null;
/**
 * Captures the current `prompt_prefix` / `negative_prompt` verbatim.
 */
export declare function snapshotSdPrefixes(context: SillyTavernContext): SdStyleSnapshot;
/**
 * Writes prefix / negative onto `extension_settings.sd.*` and triggers the
 * jQuery `input` event on the corresponding textareas so the SD extension UI
 * reflects the change.
 */
export declare function applySdStyle(context: SillyTavernContext, style: {
    prefix: string;
    negative: string;
}): void;
/**
 * Restores a snapshot only if the current value still equals what we wrote.
 * If the user manually edited the textarea mid-generation, leave their edit
 * alone.
 */
export declare function restoreSdSnapshot(context: SillyTavernContext, snapshot: SdStyleSnapshot, weWrote: SdStyleSnapshot): void;
/**
 * Returns the names of every style currently saved in the SD extension.
 * Used by the conso settings UI to render the whitelist checklist.
 */
export declare function listAvailableStyleNames(context: SillyTavernContext): string[];
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
export declare function withRandomSdStyle<T>(context: SillyTavernContext, config: SdStyleRandomConfig, generateFn: () => Promise<T>, onPicked?: (styleName: string) => void): Promise<T>;
/**
 * Test-only helper: reset the serialization chain between tests.
 * @internal
 */
export declare function _resetMutationChainForTests(): void;
/**
 * Builds runtime config from persisted settings.
 */
export declare function buildSdStyleConfigFromSettings(s: AutoIllustratorSettings): SdStyleRandomConfig;
export {};
