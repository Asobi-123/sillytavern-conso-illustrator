import type { VibeBundleEncodingVariant, VibeBundleEncodings, VibeLibraryItem, VibeTransferReferenceImage } from '../types';
export declare const VIBE_BUNDLE_IDENTIFIER = "novelai-vibe-transfer-bundle";
export declare const VIBE_BUNDLE_VERSION = 1;
export declare const VIBE_ITEM_IDENTIFIER = "novelai-vibe-transfer";
export declare const VIBE_ITEM_VERSION = 1;
export declare const VIBE_ITEM_ENCODING_TYPE = "encoding";
export declare const VIBE_ITEM_IMAGE_TYPE = "image";
export declare const VIBE_BUNDLE_DEFAULT_ENCODING_SLOT = "unknown";
export type ParsedVibeImportGroup = {
    name: string;
    items: Array<{
        id: string;
        strength?: number;
    }>;
};
export type ParseVibeBundleResult = {
    items: VibeLibraryItem[];
    errors: string[];
};
export type ParseVibeImportResult = ParseVibeBundleResult & {
    format?: 'bundle' | 'single' | 'group';
    groups?: ParsedVibeImportGroup[];
};
export type ExportVibeBundleResult = {
    bundle: StandardVibeBundle;
    skipped: VibeLibraryItem[];
};
export type ExportVibeSelectionResult = {
    format: 'empty';
    data: undefined;
    skipped: VibeLibraryItem[];
} | {
    format: 'single';
    data: StandardVibeBundleItem;
    skipped: VibeLibraryItem[];
} | {
    format: 'group';
    data: StandardVibeGroup;
    skipped: VibeLibraryItem[];
};
export type ExportVibeSelectionOptions = {
    includeSourceImages?: boolean;
    groupName?: string;
    now?: number;
};
export type StandardVibeBundle = {
    identifier: typeof VIBE_BUNDLE_IDENTIFIER;
    version: typeof VIBE_BUNDLE_VERSION;
    vibes: StandardVibeBundleItem[];
};
export type StandardVibeBundleItem = {
    identifier: typeof VIBE_ITEM_IDENTIFIER;
    version: typeof VIBE_ITEM_VERSION;
    type: typeof VIBE_ITEM_ENCODING_TYPE | typeof VIBE_ITEM_IMAGE_TYPE;
    id: string;
    encodings: VibeBundleEncodings;
    name: string;
    createdAt: number;
    image?: string;
    thumbnail?: string;
    importInfo?: {
        model?: string;
        information_extracted?: number;
        strength?: number;
    };
};
export type StandardVibeGroup = {
    groups: Record<string, {
        vibes: Array<{
            vibeDataId: string;
            strength: number;
        }>;
        createdAt: number;
        updatedAt: number;
    }>;
    vibeData: Record<string, StandardVibeBundleItem>;
    vibePresets: Record<string, {
        model: string;
        infoExtract: number;
        strength: number;
        imageId?: string;
        vibeDataId: string;
    }>;
    presetImages: Record<string, string>;
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
export declare function parseVibeImportJson(jsonText: string, options?: {
    existingIds?: Iterable<string>;
    sourceName?: string;
    now?: number;
    maxItems?: number;
}): ParseVibeImportResult;
export declare function exportVibeBundle(items: VibeLibraryItem[], options?: {
    includeSourceImages?: boolean;
}): ExportVibeBundleResult;
export declare function exportVibeSelection(items: VibeLibraryItem[], options?: ExportVibeSelectionOptions): ExportVibeSelectionResult;
export declare function legacyReferenceToVibeLibraryItem(reference: VibeTransferReferenceImage, options?: {
    now?: number;
    defaultStrength?: number;
    defaultInformationExtracted?: number;
}): VibeLibraryItem;
