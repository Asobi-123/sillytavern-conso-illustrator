/**
 * NovelAI Vibe Transfer service.
 *
 * This service keeps the normal `/sd` route untouched unless Vibe Transfer is
 * enabled and at least one valid reference image exists.
 */
import type { VibeLibraryItem, VibeTransferGenerationConfig, VibeTransferReferenceImage } from '../types';
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
    /**
     * Content hash of each reference's source image in the backend store, or ''
     * when the source is still inline / unavailable. Lets the backend read the
     * source bytes from disk when an encoding cache miss forces a re-encode.
     */
    reference_source_hash_multiple: string[];
    reference_information_extracted_multiple: number[];
    reference_strength_multiple: number[];
}
export declare function buildVibeTransferConfigFromSettings(settings: AutoIllustratorSettings): VibeTransferGenerationConfig;
export declare function shouldUseVibeTransfer(config?: VibeTransferGenerationConfig): config is VibeTransferGenerationConfig;
export interface VibeCombinationRandomConfig {
    enabled: boolean;
    /** Whitelist of combination IDs eligible for random pick. Empty = all. */
    whitelist: string[];
}
export interface PickedVibeCombination {
    id: string;
    name: string;
    config: VibeTransferGenerationConfig;
}
export declare function pickRandomVibeCombinationConfig(settings: AutoIllustratorSettings, config: VibeCombinationRandomConfig): PickedVibeCombination | null;
export declare function buildVibeCombinationRandomConfigFromSettings(settings: AutoIllustratorSettings): VibeCombinationRandomConfig;
export declare function buildNovelAiAdvancedPayload(prompt: string, context: SillyTavernContext, config: VibeTransferGenerationConfig): NovelAiAdvancedPayload;
export declare function mergeVibeTransferReferenceUpdates(existingReferences: VibeTransferReferenceImage[], updatedReferences: VibeTransferReferenceImage[]): VibeTransferReferenceImage[];
export declare function mergeVibeTransferLibraryItemUpdates(existingItems: VibeLibraryItem[], updatedReferences: VibeTransferReferenceImage[]): VibeLibraryItem[];
export declare function generateNovelAiVibeTransferImage(prompt: string, context: SillyTavernContext, config: VibeTransferGenerationConfig, onReferencesUpdated?: (references: VibeTransferReferenceImage[]) => void, signal?: AbortSignal): Promise<string>;
