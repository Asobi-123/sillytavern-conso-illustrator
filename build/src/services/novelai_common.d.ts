export type SdSettings = Record<string, unknown>;
export interface NovelAiBasePayload {
    prompt: string;
    model: string;
    sampler: string;
    scheduler: string;
    steps: number;
    scale: number;
    width: number;
    height: number;
    negative_prompt: string;
    upscale_ratio: number;
    decrisper: boolean;
    sm: boolean;
    sm_dyn: boolean;
    variety_boost: boolean;
    quality_preset_id?: string;
    uc_preset_id?: string;
    seed?: number;
}
export interface NovelAiImageRouteResponse {
    format?: string;
    data?: string;
    image?: string;
}
export declare function readSdSettings(context: SillyTavernContext): SdSettings;
export declare function readString(source: SdSettings, key: string, fallback?: string): string;
export declare function readNumber(source: SdSettings, key: string, fallback: number): number;
export declare function readBoolean(source: SdSettings, key: string, fallback: boolean): boolean;
export declare function clamp01(value: unknown, fallback: number): number;
export declare function combinePrefixes(str1: string, str2: string, macro?: string): string;
export declare function substituteBasicParams(value: string, context: SillyTavernContext): string;
export declare function getNovelParams(sd: SdSettings): {
    steps: number;
    width: number;
    height: number;
    sm: boolean;
    sm_dyn: boolean;
};
export declare function normalizeBase64Image(dataUrl: string): string | null;
export declare function fingerprintString(value: string): string;
export declare function buildNovelAiBasePayload(prompt: string, context: SillyTavernContext, dimensions?: {
    width: number;
    height: number;
}): NovelAiBasePayload;
export declare function saveBase64AsFile(base64Data: string, context: SillyTavernContext, format: string): Promise<string>;
