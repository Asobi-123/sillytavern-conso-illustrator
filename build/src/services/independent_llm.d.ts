/**
 * Independent LLM API Service
 * Shared module for calling an independent LLM API (OpenAI-compatible)
 * Used by both prompt generation and prompt refinement flows.
 */
/**
 * Calls an independent LLM API for text generation.
 *
 * @param systemPrompt - System prompt
 * @param userPrompt - User prompt
 * @param settings - Extension settings (must contain independentLlmApiUrl, independentLlmApiKey, independentLlmModel)
 * @param maxTokens - Maximum tokens for response (default: 2000)
 * @returns LLM response text
 */
export declare function callIndependentLlmApi(systemPrompt: string, userPrompt: string, settings: AutoIllustratorSettings, maxTokens?: number): Promise<string>;
