import { GeminiLlmProvider } from '@/integrations/llm/gemini.provider';
import { GroqLlmProvider } from '@/integrations/llm/groq.provider';
import { isRetryableLlmError } from '@/integrations/llm/llm-error';
import type { ParseTextInput, StructuredCommand } from '@/modules/ai/ai.types';
import { logger } from '@/shared/logger/logger';

export interface LLMProvider {
  isEnabled(): boolean;
  parse(input: ParseTextInput): Promise<StructuredCommand>;
  /**
   * Generic "prompt in, parsed JSON out" call for features that build their
   * own prompt (e.g. report insights) rather than the fixed transaction
   * parser. The caller is responsible for validating the shape — this layer
   * only guarantees it's JSON, not that it matches any particular schema.
   */
  generateJson(prompt: string): Promise<unknown>;
}

export class DisabledLLMProvider implements LLMProvider {
  isEnabled(): boolean {
    return false;
  }

  parse(_input: ParseTextInput): Promise<StructuredCommand> {
    return Promise.reject(new Error('LLM provider is disabled.'));
  }

  generateJson(_prompt: string): Promise<unknown> {
    return Promise.reject(new Error('LLM provider is disabled.'));
  }
}

/**
 * Tries Gemini first. On quota / rate-limit / transient outage, retries once
 * on Groq so a free Gemini key does not take the whole product down.
 */
export class FallbackLlmProvider implements LLMProvider {
  constructor(
    private readonly primary: LLMProvider,
    private readonly fallback: LLMProvider,
  ) {}

  isEnabled(): boolean {
    return this.primary.isEnabled() || this.fallback.isEnabled();
  }

  parse(input: ParseTextInput): Promise<StructuredCommand> {
    return this.call((provider) => provider.parse(input));
  }

  generateJson(prompt: string): Promise<unknown> {
    return this.call((provider) => provider.generateJson(prompt));
  }

  private async call<T>(run: (provider: LLMProvider) => Promise<T>): Promise<T> {
    if (!this.primary.isEnabled()) {
      return run(this.fallback);
    }
    try {
      return await run(this.primary);
    } catch (error) {
      if (!this.fallback.isEnabled() || !isRetryableLlmError(error)) {
        throw error;
      }
      logger.warn({ err: error }, 'Primary LLM unavailable; falling back to Groq');
      return run(this.fallback);
    }
  }
}

export type LlmProviderConfig = {
  provider: 'disabled' | 'gemini' | 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  groqApiKey: string;
  groqModel: string;
};

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export function describeLlm(config: LlmProviderConfig): { provider: string; model: string } {
  const gemini = config.provider === 'gemini' && config.apiKey.trim().length > 0;
  const groq = config.groqApiKey.trim().length > 0;
  if (gemini && groq) {
    return { provider: 'gemini+groq', model: `${config.model} → ${config.groqModel}` };
  }
  if (groq && !gemini) {
    return { provider: 'groq', model: config.groqModel };
  }
  return { provider: config.provider, model: config.model };
}

export function createLlmProvider(config: LlmProviderConfig): LLMProvider {
  const apiKey = config.apiKey.trim();
  const gemini =
    config.provider === 'gemini'
      ? new GeminiLlmProvider({
          apiKey,
          model: config.model.trim() || DEFAULT_GEMINI_MODEL,
        })
      : new DisabledLLMProvider();

  if (config.provider !== 'disabled' && config.provider !== 'gemini' && apiKey) {
    logger.warn(
      { provider: config.provider },
      'LLM provider is not implemented yet; falling back to rule-based parser only',
    );
  }

  const groq = new GroqLlmProvider({
    apiKey: config.groqApiKey,
    model: config.groqModel,
  });

  if (gemini.isEnabled() && groq.isEnabled()) {
    return new FallbackLlmProvider(gemini, groq);
  }
  if (gemini.isEnabled()) {
    return gemini;
  }
  if (groq.isEnabled()) {
    return groq;
  }
  return new DisabledLLMProvider();
}
