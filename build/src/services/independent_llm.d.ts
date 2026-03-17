/**
 * Independent LLM API Service
 * Shared module for calling an independent LLM API (OpenAI-compatible)
 * Used by both prompt generation and prompt refinement flows.
 */
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
