import { type NovelAiBasePayload } from './novelai_common';
export interface NovelAiInpaintPayload extends NovelAiBasePayload {
    image: string;
    mask: string;
    strength: number;
    color_correct: boolean;
}
export interface InpaintGenerationInput {
    prompt: string;
    baseImageDataUrl: string;
    maskDataUrl: string;
    width: number;
    height: number;
    strength: number;
    colorCorrect?: boolean;
    negativePrompt?: string;
}
export interface InpaintGenerationResponse {
    data: string;
    format: string;
}
export declare function buildNovelAiInpaintPayload(input: InpaintGenerationInput, context: SillyTavernContext): NovelAiInpaintPayload;
export declare function generateNovelAiInpaintBase64(input: InpaintGenerationInput, context: SillyTavernContext, signal?: AbortSignal): Promise<InpaintGenerationResponse>;
export declare function generateNovelAiInpaintImage(input: InpaintGenerationInput, context: SillyTavernContext, signal?: AbortSignal): Promise<string>;
