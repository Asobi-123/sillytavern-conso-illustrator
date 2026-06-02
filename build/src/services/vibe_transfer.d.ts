/**
 * NovelAI Vibe Transfer service.
 *
 * This service keeps the normal `/sd` route untouched unless Vibe Transfer is
 * enabled and at least one valid reference image exists.
 */
import type { VibeTransferGenerationConfig, VibeTransferReferenceImage } from '../types';
export interface NovelAiAdvancedPayload {
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
    seed?: number;
    reference_image_multiple: string[];
    reference_objects: VibeTransferReferenceImage[];
    reference_image_ids: string[];
    reference_encoded_vibe_multiple: (string | null)[];
    reference_source_fingerprint_multiple: string[];
    reference_information_extracted_multiple: number[];
    reference_strength_multiple: number[];
}
export declare function buildVibeTransferConfigFromSettings(settings: AutoIllustratorSettings): VibeTransferGenerationConfig;
export declare function shouldUseVibeTransfer(config?: VibeTransferGenerationConfig): config is VibeTransferGenerationConfig;
export declare function buildNovelAiAdvancedPayload(prompt: string, context: SillyTavernContext, config: VibeTransferGenerationConfig): NovelAiAdvancedPayload;
export declare function mergeVibeTransferReferenceUpdates(existingReferences: VibeTransferReferenceImage[], updatedReferences: VibeTransferReferenceImage[]): VibeTransferReferenceImage[];
export declare function generateNovelAiVibeTransferImage(prompt: string, context: SillyTavernContext, config: VibeTransferGenerationConfig, onReferencesUpdated?: (references: VibeTransferReferenceImage[]) => void, signal?: AbortSignal): Promise<string>;
