export type AutoIllustratorErrorCode = 'api-request-failed' | 'llm-empty-response' | 'no-valid-prompts' | 'llm-unavailable' | 'main-response-empty' | 'prompt-insertion-failed' | 'image-command-unavailable' | 'image-empty-response' | 'image-request-failed' | 'unknown';
export declare class AutoIllustratorError extends Error {
    readonly code: AutoIllustratorErrorCode;
    readonly detail?: string;
    constructor(code: AutoIllustratorErrorCode, message: string, detail?: string);
}
export declare function extractErrorMessage(error: unknown): string;
export declare function toAutoIllustratorError(error: unknown, code: AutoIllustratorErrorCode, fallbackMessage: string): AutoIllustratorError;
export declare function getUserFacingErrorReason(error: unknown): string;
