import { GeminiLlmProvider } from '@/integrations/llm/gemini.provider';
import type { ParseTextInput, StructuredCommand } from '@/modules/ai/ai.types';
import { logger } from '@/shared/logger/logger';

export interface LLMProvider {
  isEnabled(): boolean;
  parse(input: ParseTextInput): Promise<StructuredCommand>;
}

export class DisabledLLMProvider implements LLMProvider {
  isEnabled(): boolean {
    return false;
  }

  parse(_input: ParseTextInput): Promise<StructuredCommand> {
    return Promise.reject(new Error('LLM provider is disabled.'));
  }
}

export type LlmProviderConfig = {
  provider: 'disabled' | 'gemini' | 'openai' | 'anthropic';
  apiKey: string;
  model: string;
};

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

export function createLlmProvider(config: LlmProviderConfig): LLMProvider {
  const apiKey = config.apiKey.trim();

  if (config.provider === 'gemini') {
    return new GeminiLlmProvider({
      apiKey,
      model: config.model.trim() || DEFAULT_GEMINI_MODEL,
    });
  }

  if (config.provider !== 'disabled' && apiKey) {
    logger.warn(
      { provider: config.provider },
      'LLM provider is not implemented yet; falling back to rule-based parser only',
    );
  }

  return new DisabledLLMProvider();
}
