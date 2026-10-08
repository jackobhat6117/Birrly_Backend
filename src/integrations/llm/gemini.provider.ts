import type { LLMProvider } from '@/integrations/llm/llm.provider';
import { LlmHttpError } from '@/integrations/llm/llm-error';
import { buildParserPrompt, extractJsonObject } from '@/integrations/llm/parser-prompt';
import type { ParseTextInput, StructuredCommand } from '@/modules/ai/ai.types';

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
/** Chat parsing is a short JSON classification. Don't make the user wait on a hung call. */
const PARSE_TIMEOUT_MS = 8_000;
/** Coach and report copy can think a little longer than a chat command. */
const GENERATE_TIMEOUT_MS = 20_000;

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

/**
 * Gemini 3 Flash thinks at "medium" by default, which is why a one-line
 * expense can sit for many seconds. Classification should stay at "minimal".
 * Older Gemini models reject thinkingLevel, so only send it for 3.x.
 * temperature is omitted: Gemini 3 ignores it and later models reject it.
 */
export function generationConfig(model: string, purpose: 'parse' | 'generate') {
  const config: {
    responseMimeType: 'application/json';
    maxOutputTokens: number;
    thinkingConfig?: { thinkingLevel: 'minimal' | 'low' };
  } = {
    responseMimeType: 'application/json',
    maxOutputTokens: purpose === 'parse' ? 1024 : 2048,
  };

  if (model.startsWith('gemini-3')) {
    config.thinkingConfig = {
      thinkingLevel: purpose === 'parse' ? 'minimal' : 'low',
    };
  }

  return config;
}

export class GeminiLlmProvider implements LLMProvider {
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
    const text = await this.callGemini(buildParserPrompt(input), {
      purpose: 'parse',
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
    const text = await this.callGemini(prompt, {
      purpose: 'generate',
      timeoutMs: GENERATE_TIMEOUT_MS,
    });
    return extractJsonObject(text);
  }

  private async callGemini(
    prompt: string,
    options: { purpose: 'parse' | 'generate'; timeoutMs: number },
  ): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Gemini LLM is not configured.');
    }

    const model = this.options.model?.trim() || DEFAULT_GEMINI_MODEL;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.options.apiKey.trim())}`;

    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: generationConfig(model, options.purpose),
      }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });

    const payload = (await response.json()) as GeminiGenerateResponse;
    if (!response.ok) {
      throw new LlmHttpError(
        payload.error?.message ?? `Gemini request failed (${response.status})`,
        response.status,
      );
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }
    return text;
  }
}
