import { describe, expect, it, vi } from 'vitest';
import { extractJsonObject, GeminiLlmProvider } from '@/integrations/llm/gemini.provider';

describe('GeminiLlmProvider', () => {
  it('extracts JSON from fenced model output', () => {
    const parsed = extractJsonObject('```json\n{"intent":"QUERY_BALANCE"}\n```');
    expect(parsed).toEqual({ intent: 'QUERY_BALANCE' });
  });

  it('parses natural language through Gemini', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    intent: 'CREATE_EXPENSE',
                    amount: '350',
                    currency: 'ETB',
                    categorySlug: 'food',
                    description: 'Lunch',
                    confidence: 0.95,
                    missingFields: [],
                    source: 'llm',
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const provider = new GeminiLlmProvider({
      apiKey: 'test-key',
      fetchImpl,
    });

    const result = await provider.parse({
      text: 'I spent 350 birr on lunch today',
      language: 'en',
      currency: 'ETB',
    });

    expect(result.intent).toBe('CREATE_EXPENSE');
    expect(result.amount).toBe('350');
    expect(result.categorySlug).toBe('food');
    expect(result.source).toBe('llm');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('is disabled without an API key', () => {
    const provider = new GeminiLlmProvider({ apiKey: '' });
    expect(provider.isEnabled()).toBe(false);
  });
});
