export type ManagedRegexKey = 'imgPrompt' | 'autoIllustrator' | 'imgTag';
type ManagedRegexDefinition = {
    key: ManagedRegexKey;
    id: string;
    nameKey: string;
    findRegex: string;
};
type ManagedRegexRuleState = {
    key: ManagedRegexKey;
    installed: boolean;
    enabled: boolean;
};
export type ManagedRegexState = {
    rules: ManagedRegexRuleState[];
    allInstalled: boolean;
    allEnabled: boolean;
    anyEnabled: boolean;
    regexExtensionDisabled: boolean;
};
export declare const MANAGED_REGEX_DEFINITIONS: ManagedRegexDefinition[];
export declare function syncManagedRegexScripts(context: SillyTavernContext, options?: {
    overwriteExisting?: boolean;
}): boolean;
export declare function getManagedRegexState(context: SillyTavernContext): ManagedRegexState;
export declare function setManagedRegexRuleEnabled(context: SillyTavernContext, key: ManagedRegexKey, enabled: boolean): void;
export declare function setAllManagedRegexRulesEnabled(context: SillyTavernContext, enabled: boolean): void;
export declare function initializeRegexSanitizerPanel(context: SillyTavernContext): void;
export {};
