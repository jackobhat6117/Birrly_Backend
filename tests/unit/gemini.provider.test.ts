import { describe, expect, it, vi } from 'vitest';
import { GeminiLlmProvider, generationConfig } from '@/integrations/llm/gemini.provider';

function jsonResponse(text: string) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  };
}

describe('generationConfig', () => {
  it('keeps chat parsing on minimal thinking for Gemini 3', () => {
    expect(generationConfig('gemini-3.6-flash', 'parse')).toEqual({
      responseMimeType: 'application/json',
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingLevel: 'minimal' },
    });
  });

  it('does not send thinkingLevel to older Gemini models', () => {
    expect(generationConfig('gemini-2.0-flash', 'parse').thinkingConfig).toBeUndefined();
  });
});

describe('GeminiLlmProvider.parse', () => {
  it('asks Gemini 3 for a short JSON classification without temperature', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        generationConfig: { temperature?: number; thinkingConfig?: { thinkingLevel: string } };
      };
      expect(body.generationConfig.temperature).toBeUndefined();
      expect(body.generationConfig.thinkingConfig?.thinkingLevel).toBe('minimal');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return jsonResponse(
        JSON.stringify({
          intent: 'CREATE_EXPENSE',
          amount: '80',
          categorySlug: 'transport',
          confidence: 0.9,
          missingFields: [],
        }),
      );
    });

    const provider = new GeminiLlmProvider({
      apiKey: 'test-key',
      model: 'gemini-3.6-flash',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const command = await provider.parse({ text: 'took a taxi for 80', language: 'en', currency: 'ETB' });
    expect(command.intent).toBe('CREATE_EXPENSE');
    expect(command.source).toBe('llm');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
