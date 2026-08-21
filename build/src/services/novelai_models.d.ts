export declare const NOVELAI_SOURCE = "novel";
export declare const NOVELAI_MODELS: {
    readonly V5_CURATED: "nai-diffusion-5-curated";
    readonly V5_FULL: "nai-diffusion-5-full";
};
export type NovelAiV5ModelId = (typeof NOVELAI_MODELS)[keyof typeof NOVELAI_MODELS];
export interface NovelAiModelCapability {
    id: NovelAiV5ModelId;
    label: string;
    supportsVibeTransfer: false;
    inpaintingModel: string;
    recommended: {
        width: number;
        height: number;
        steps: number;
        scale: number;
        sampler: string;
        scheduler: string;
        paramsVersion: number;
    };
}
export declare const NOVELAI_V5_CAPABILITIES: readonly NovelAiModelCapability[];
export interface NovelAiSettingsNormalizationResult {
    upscaleRatioChanged: boolean;
    previousUpscaleRatio?: unknown;
}
export declare function isNovelAiV5Model(model: unknown): model is NovelAiV5ModelId;
export declare function getNovelAiV5Capability(model: unknown): NovelAiModelCapability | undefined;
export declare function normalizeNovelAiGenerationSettings(context: SillyTavernContext): NovelAiSettingsNormalizationResult;
export declare function reconcileNovelAiV5ModelOptions(context: SillyTavernContext, select?: HTMLSelectElement | null): void;
export declare function initializeNovelAiV5ModelCompatibility(context: SillyTavernContext): () => void;
