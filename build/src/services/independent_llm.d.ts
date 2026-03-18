/**
 * Independent LLM API Service
 * Shared module for calling an independent LLM API (OpenAI-compatible)
 * Used by both prompt generation and prompt refinement flows.
 */
/**
 * Snapshot of the last independent LLM API request.
 * Stored in module-level runtime state (not persisted to settings).
 */
export interface IndependentLlmRequestSnapshot {
    /** Final URL the request was sent to */
    url: string;
    /** Model name used */
    model: string;
    /** Max tokens setting */
    maxTokens: number;
    /** Temperature setting */
    temperature: number;
    /** Messages sent (system + user) */
    messages: Array<{
        role: string;
        content: string;
    }>;
    /** Whether an Authorization header was present */
    hasAuthorization: boolean;
    /** Timestamp of the request */
    timestamp: number;
}
/**
 * Returns the most recent independent LLM API request snapshot, or null if none.
 */
export declare function getLastRequestSnapshot(): IndependentLlmRequestSnapshot | null;
/**
 * Builds the full chat completions URL from a base API URL.
 * Handles various input formats intelligently:
 * - Already has /chat/completions → use as-is
 * - Ends with /v1/ → append chat/completions
 * - Otherwise → append /v1/chat/completions
 */
export declare function buildChatCompletionsUrl(baseUrl: string): string;
/**
 * Builds the models list URL from a base API URL.
 * Used by the "Fetch Models" button.
 */
export declare function buildModelsUrl(baseUrl: string): string;
/**
 * Fetches available models from an OpenAI-compatible API endpoint.
 *
 * @param apiUrl - Base API URL
 * @param apiKey - API key (optional, some local LLMs don't require it)
 * @returns Array of model ID strings
 */
export declare function fetchAvailableModels(apiUrl: string, apiKey?: string): Promise<string[]>;
/**
 * Calls an independent LLM API for text generation.
 *
 * @param systemPrompt - System prompt
 * @param userPrompt - User prompt
 * @param settings - Extension settings (must contain independentLlmApiUrl, independentLlmModel)
 * @param maxTokensOverride - Override max tokens (if not provided, uses settings.independentLlmMaxTokens or 4096)
 * @returns LLM response text
 */
export declare function callIndependentLlmApi(systemPrompt: string, userPrompt: string, settings: AutoIllustratorSettings, maxTokensOverride?: number): Promise<string>;
/**
 * Checks whether the independent LLM API has the minimum required configuration
 * (both URL and model must be non-empty).
 */
export declare function isIndependentLlmConfigured(settings: AutoIllustratorSettings): boolean;
