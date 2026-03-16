/**
 * Independent LLM API Service
 * Shared module for calling an independent LLM API (OpenAI-compatible)
 * Used by both prompt generation and prompt refinement flows.
 */

import {createLogger} from '../logger';

const logger = createLogger('IndependentLLM');

/**
 * Calls an independent LLM API for text generation.
 *
 * @param systemPrompt - System prompt
 * @param userPrompt - User prompt
 * @param settings - Extension settings (must contain independentLlmApiUrl, independentLlmApiKey, independentLlmModel)
 * @param maxTokens - Maximum tokens for response (default: 2000)
 * @returns LLM response text
 */
export async function callIndependentLlmApi(
  systemPrompt: string,
  userPrompt: string,
  settings: AutoIllustratorSettings,
  maxTokens = 2000
): Promise<string> {
  const apiUrl = settings.independentLlmApiUrl;
  const apiKey = settings.independentLlmApiKey;
  const model = settings.independentLlmModel;

  if (!apiUrl || !apiKey || !model) {
    throw new Error('Independent LLM API not configured');
  }

  logger.debug('Calling independent LLM API:', {apiUrl, model});

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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
