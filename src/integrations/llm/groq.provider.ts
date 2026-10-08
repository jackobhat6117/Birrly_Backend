import type { LLMProvider } from '@/integrations/llm/llm.provider';
import { LlmHttpError } from '@/integrations/llm/llm-error';
import { buildParserPrompt, extractJsonObject } from '@/integrations/llm/parser-prompt';
import type { ParseTextInput, StructuredCommand } from '@/modules/ai/ai.types';

const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PARSE_TIMEOUT_MS = 8_000;
const GENERATE_TIMEOUT_MS = 20_000;

type GroqChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

export class GroqLlmProvider implements LLMProvider {
  constructor(
    private readonly options: {
      apiKey: string;
      model?: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  isEnabled(): boolean {
    return this.options.apiKey.trim().length > 0;
  }

  async parse(input: ParseTextInput): Promise<StructuredCommand> {
    const text = await this.callGroq(buildParserPrompt(input), {
      maxTokens: 1024,
      timeoutMs: PARSE_TIMEOUT_MS,
    });
    const parsed = extractJsonObject(text) as Omit<StructuredCommand, 'source'>;
    return {
      ...parsed,
      source: 'llm',
      currency: parsed.currency ?? input.currency,
      missingFields: parsed.missingFields ?? [],
    };
  }

  async generateJson(prompt: string): Promise<unknown> {
    const text = await this.callGroq(prompt, {
      maxTokens: 2048,
      timeoutMs: GENERATE_TIMEOUT_MS,
    });
    return extractJsonObject(text);
  }

  private async callGroq(prompt: string, options: { maxTokens: number; timeoutMs: number }): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Groq LLM is not configured.');
    }

    const model = this.options.model?.trim() || DEFAULT_GROQ_MODEL;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: options.maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });

    const payload = (await response.json()) as GroqChatResponse;
    if (!response.ok) {
      throw new LlmHttpError(payload.error?.message ?? `Groq request failed (${response.status})`, response.status);
    }

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('Groq returned an empty response.');
    }
    return text;
  }
}
