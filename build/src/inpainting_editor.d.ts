export type InpaintingInsertionMode = 'append-after-image' | 'replace-image';
export interface InpaintingEditorOptions {
    imageUrl: string;
    promptText: string;
    messageText: string;
    context: SillyTavernContext;
    settings: AutoIllustratorSettings;
}
export interface InpaintingEditorResult {
    imageUrl: string;
    promptText: string;
    insertionMode: InpaintingInsertionMode;
}
export declare function openInpaintingEditor(options: InpaintingEditorOptions): Promise<InpaintingEditorResult | null>;
