export declare function hasIndependentPromptRetryState(messageId: number): boolean;
export declare function markIndependentPromptRetryAvailable(messageId: number, reason?: string): void;
export declare function clearIndependentPromptRetryState(messageId?: number): void;
export declare function syncIndependentPromptRetryButtons(context: SillyTavernContext, settings: AutoIllustratorSettings, onRetry: (messageId: number) => Promise<void>): void;
