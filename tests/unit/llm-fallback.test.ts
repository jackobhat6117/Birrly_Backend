import { describe, expect, it, vi } from 'vitest';
import { GeminiLlmProvider } from '@/integrations/llm/gemini.provider';
import { GroqLlmProvider } from '@/integrations/llm/groq.provider';
import { FallbackLlmProvider } from '@/integrations/llm/llm.provider';

const commandJson = JSON.stringify({
  intent: 'CREATE_EXPENSE',
  amount: '80',
  categorySlug: 'transport',
  confidence: 0.9,
  missingFields: [],
});

function geminiOk() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: commandJson }] } }] }),
  };
}

function geminiStatus(status: number, message: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message } }),
  };
}

function groqOk() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: commandJson } }] }),
  };
}

const input = { text: 'took a taxi for 80', language: 'en', currency: 'ETB' };

describe('FallbackLlmProvider', () => {
  it('uses Gemini when the request succeeds', async () => {
    const geminiFetch = vi.fn(async () => geminiOk());
    const groqFetch = vi.fn(async () => groqOk());
    const provider = new FallbackLlmProvider(
      new GeminiLlmProvider({ apiKey: 'g', fetchImpl: geminiFetch as unknown as typeof fetch }),
      new GroqLlmProvider({ apiKey: 'q', fetchImpl: groqFetch as unknown as typeof fetch }),
    );

    const command = await provider.parse(input);
    expect(command.intent).toBe('CREATE_EXPENSE');
    expect(geminiFetch).toHaveBeenCalledOnce();
    expect(groqFetch).not.toHaveBeenCalled();
  });

  it('retries on Groq when Gemini returns 429', async () => {
    const geminiFetch = vi.fn(async () => geminiStatus(429, 'Resource exhausted'));
    const groqFetch = vi.fn(async () => groqOk());
    const provider = new FallbackLlmProvider(
      new GeminiLlmProvider({ apiKey: 'g', fetchImpl: geminiFetch as unknown as typeof fetch }),
      new GroqLlmProvider({ apiKey: 'q', fetchImpl: groqFetch as unknown as typeof fetch }),
    );

    const command = await provider.parse(input);
    expect(command.source).toBe('llm');
    expect(command.intent).toBe('CREATE_EXPENSE');
    expect(groqFetch).toHaveBeenCalledOnce();
  });

  it('does not call Groq for a non-retryable Gemini error', async () => {
    const geminiFetch = vi.fn(async () => geminiStatus(400, 'bad request'));
    const groqFetch = vi.fn(async () => groqOk());
    const provider = new FallbackLlmProvider(
      new GeminiLlmProvider({ apiKey: 'g', fetchImpl: geminiFetch as unknown as typeof fetch }),
      new GroqLlmProvider({ apiKey: 'q', fetchImpl: groqFetch as unknown as typeof fetch }),
    );

    await expect(provider.parse(input)).rejects.toThrow(/bad request/);
    expect(groqFetch).not.toHaveBeenCalled();
  });
});
