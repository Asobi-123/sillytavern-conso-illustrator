import type { VibeBundleEncodingVariant, VibeBundleEncodings, VibeLibraryItem, VibeTransferReferenceImage } from '../types';
export declare const VIBE_BUNDLE_IDENTIFIER = "novelai-vibe-transfer-bundle";
export declare const VIBE_BUNDLE_VERSION = 1;
export declare const VIBE_ITEM_IDENTIFIER = "novelai-vibe-transfer";
export declare const VIBE_ITEM_VERSION = 1;
export declare const VIBE_ITEM_TYPE = "encoding";
export declare const VIBE_BUNDLE_DEFAULT_ENCODING_SLOT = "unknown";
export type ParseVibeBundleResult = {
    items: VibeLibraryItem[];
    errors: string[];
};
export type ExportVibeBundleResult = {
    bundle: StandardVibeBundle;
    skipped: VibeLibraryItem[];
};
export type StandardVibeBundle = {
    identifier: typeof VIBE_BUNDLE_IDENTIFIER;
    version: typeof VIBE_BUNDLE_VERSION;
    vibes: StandardVibeBundleItem[];
};
export type StandardVibeBundleItem = {
    identifier: typeof VIBE_ITEM_IDENTIFIER;
    version: typeof VIBE_ITEM_VERSION;
    type: typeof VIBE_ITEM_TYPE;
    id: string;
    encodings: VibeBundleEncodings;
    name: string;
    createdAt: number;
    importInfo?: {
        model?: string;
        information_extracted?: number;
        strength?: number;
    };
};
export declare function modelToVibeBundleKey(model: string): string;
export declare function vibeBundleKeyToModel(key: string): string;
export declare function createLocalVibeId(prefix?: string): string;
export declare function getVibeBundleDisplayName(sourceName?: string): string;
export declare function nameImportedVibeBundleItems(items: VibeLibraryItem[], bundleName: string): VibeLibraryItem[];
export declare function normalizeVibeEncodings(value: unknown): VibeBundleEncodings;
export declare function hasUsableVibeEncoding(item: VibeLibraryItem): boolean;
export declare function findVibeEncodingForModel(item: VibeLibraryItem, model: string): VibeBundleEncodingVariant | null;
export declare function findVibeEncodingForModelAndInformation(item: VibeLibraryItem, model: string, informationExtracted: number): VibeBundleEncodingVariant | null;
export declare function parseVibeBundleJson(jsonText: string, options?: {
    existingIds?: Iterable<string>;
    sourceName?: string;
    now?: number;
}): ParseVibeBundleResult;
export declare function exportVibeBundle(items: VibeLibraryItem[]): ExportVibeBundleResult;
export declare function legacyReferenceToVibeLibraryItem(reference: VibeTransferReferenceImage, options?: {
    now?: number;
    defaultStrength?: number;
    defaultInformationExtracted?: number;
}): VibeLibraryItem;
