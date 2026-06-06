/**
 * External preset adapter UI.
 *
 * Imported JSON is parsed locally and converted into Conso's own preset fields.
 * The original external output format is not used directly for generation.
 */
type ImportTarget = 'independent' | 'shared' | 'both';
type Draft = {
    name: string;
    sharedMetaPrompt: string;
    promptWritingGuidelines: string;
};
type AdapterResponse = {
    name: string;
    promptWritingGuidelines?: string;
    sharedPromptProfile?: string;
    independentPromptWritingGuidelines?: string;
};
type SourceText = {
    name?: string;
    text: string;
    count: number;
};
type AdapterPrompts = {
    systemPrompt: string;
    userPrompt: string;
};
export declare function createPresetImportContent(): string;
declare function sourceText(): SourceText;
declare function buildSourceExcerpt(source: string): string;
declare function renderAnalysis(): void;
declare function parseAdapterResponse(raw: string, fallbackName?: string): AdapterResponse;
declare function composeIndependentGuidelines(adaptedGuidelines: string): string;
declare function composeSharedMetaPrompt(adaptedGuidelines: string): string;
declare function sanitizeAdaptedProfile(profile: string, target: 'shared' | 'independent'): string;
declare function buildAdapterPrompts(input: {
    requestedName: string;
    selectedTarget: ImportTarget;
    requirement: string;
    sourceText: string;
}): AdapterPrompts;
declare function buildDraft(adapterResponse: AdapterResponse): Draft;
export declare const presetImportTestHooks: {
    parseAdapterResponse: typeof parseAdapterResponse;
    composeIndependentGuidelines: typeof composeIndependentGuidelines;
    composeSharedMetaPrompt: typeof composeSharedMetaPrompt;
    buildSourceExcerpt: typeof buildSourceExcerpt;
    buildAdapterPrompts: typeof buildAdapterPrompts;
    buildDraft: typeof buildDraft;
    sanitizeAdaptedProfile: typeof sanitizeAdaptedProfile;
    renderAnalysis: typeof renderAnalysis;
    sourceText: typeof sourceText;
};
export declare function initializePresetImport(context: SillyTavernContext, settings: AutoIllustratorSettings, saveFn: () => void, refreshFn: () => void): void;
export {};
