/**
 * Independent LLM API Service
 * Shared module for calling an independent LLM API (OpenAI-compatible)
 * Used by both prompt generation and prompt refinement flows.
 */

import {createLogger} from '../logger';

const logger = createLogger('IndependentLLM');

/**
 * Builds the full chat completions URL from a base API URL.
 * Handles various input formats intelligently:
 * - Already has /chat/completions → use as-is
 * - Ends with /v1/ → append chat/completions
 * - Otherwise → append /v1/chat/completions
 */
export function buildChatCompletionsUrl(baseUrl: string): string {
  let url = baseUrl.trim();
  if (!url.endsWith('/')) {
    url += '/';
  }
  if (url.includes('/chat/completions')) {
    // Already a full endpoint, use as-is (strip trailing slash if after completions)
    return baseUrl.trim().replace(/\/+$/, '');
  }
  if (url.endsWith('/v1/')) {
    return url + 'chat/completions';
  }
  return url + 'v1/chat/completions';
}

/**
 * Builds the models list URL from a base API URL.
 * Used by the "Fetch Models" button.
 */
export function buildModelsUrl(baseUrl: string): string {
  let url = baseUrl.trim();
  if (!url.endsWith('/')) {
    url += '/';
  }
  if (url.endsWith('/v1/')) {
    return url + 'models';
  }
  return url + 'v1/models';
}

/**
 * Fetches available models from an OpenAI-compatible API endpoint.
 *
 * @param apiUrl - Base API URL
 * @param apiKey - API key (optional, some local LLMs don't require it)
 * @returns Array of model ID strings
 */
export async function fetchAvailableModels(
  apiUrl: string,
  apiKey?: string
): Promise<string[]> {
  const modelsUrl = buildModelsUrl(apiUrl);
  logger.debug('Fetching models from:', modelsUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(modelsUrl, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const models: string[] = [];

  // OpenAI format: { data: [{ id: "model-name" }, ...] }
  if (data?.data && Array.isArray(data.data)) {
    for (const model of data.data) {
      if (model.id) {
        models.push(model.id);
      }
    }
  } else if (Array.isArray(data)) {
    // Some APIs return a flat array
    for (const model of data) {
      if (typeof model === 'string') {
        models.push(model);
      } else if (model.id) {
        models.push(model.id);
      }
    }
  }

  models.sort();
  logger.debug(`Found ${models.length} models`);
  return models;
}

/**
 * Calls an independent LLM API for text generation.
 *
 * @param systemPrompt - System prompt
 * @param userPrompt - User prompt
 * @param settings - Extension settings (must contain independentLlmApiUrl, independentLlmModel)
 * @param maxTokensOverride - Override max tokens (if not provided, uses settings.independentLlmMaxTokens or 4096)
 * @returns LLM response text
 */
export async function callIndependentLlmApi(
  systemPrompt: string,
  userPrompt: string,
  settings: AutoIllustratorSettings,
  maxTokensOverride?: number
): Promise<string> {
  const apiUrl = settings.independentLlmApiUrl;
  const apiKey = settings.independentLlmApiKey;
  const model = settings.independentLlmModel;
  const maxTokens =
    maxTokensOverride ?? settings.independentLlmMaxTokens ?? 4096;

  if (!apiUrl || !model) {
    throw new Error('Independent LLM API not configured');
  }

  const fullUrl = buildChatCompletionsUrl(apiUrl);
  logger.debug('Calling independent LLM API:', {fullUrl, model});

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Independent LLM API error: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Invalid response from independent LLM API');
  }

  return content;
}
