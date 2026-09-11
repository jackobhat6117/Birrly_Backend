import { describe, expect, it, vi } from 'vitest';
import { AiInterpreter } from '@/modules/ai/ai.interpreter';
import type { LLMProvider } from '@/integrations/llm/llm.provider';
import type { StructuredCommand } from '@/modules/ai/ai.types';

function llm(over: Partial<LLMProvider>): LLMProvider {
  return { isEnabled: () => true, parse: vi.fn(), generateJson: vi.fn(), ...over };
}

const etb = (text: string) => ({ text, language: 'en', currency: 'ETB' });

const llmCommand = (over: Partial<StructuredCommand> = {}): StructuredCommand => ({
  intent: 'CREATE_EXPENSE',
  amount: '500',
  categorySlug: 'food',
  confidence: 0.95,
  missingFields: [],
  source: 'llm',
  ...over,
});

describe('AiInterpreter — rules-first cascade', () => {
  it('handles a confident rule hit ("Abebe owes me 2000") WITHOUT calling the LLM', async () => {
    const parse = vi.fn();
    const result = await new AiInterpreter(llm({ parse })).interpret(etb('Abebe owes me 2000'));

    expect(result.intent).toBe('CREATE_DEBT');
    expect(result.source).toBe('fallback');
    expect(parse).not.toHaveBeenCalled();
  });

  it('handles shorthand ("80 taxi") without spending an LLM call', async () => {
    const parse = vi.fn();
    const result = await new AiInterpreter(llm({ parse })).interpret(etb('80 taxi'));

    expect(result.intent).toBe('CREATE_EXPENSE');
    expect(result.source).toBe('fallback');
    expect(parse).not.toHaveBeenCalled();
  });

  it('calls the LLM for a low-confidence message and uses its answer', async () => {
    const parse = vi.fn().mockResolvedValue(llmCommand());
    // "I spent 500" parses as CREATE_EXPENSE but low-confidence (missing category).
    const result = await new AiInterpreter(llm({ parse })).interpret(etb('I spent 500'));

    expect(parse).toHaveBeenCalledOnce();
    expect(result.source).toBe('llm');
    expect(result.categorySlug).toBe('food');
  });

  it('keeps the rule hit when the LLM comes back UNKNOWN', async () => {
    const parse = vi.fn().mockResolvedValue(llmCommand({ intent: 'UNKNOWN', confidence: 0 }));
    const result = await new AiInterpreter(llm({ parse })).interpret(etb('I spent 500'));

    expect(result.intent).toBe('CREATE_EXPENSE');
    expect(result.source).toBe('fallback');
  });

  it('falls back to the rule result when the LLM errors (no outage)', async () => {
    const parse = vi.fn().mockRejectedValue(new Error('API key not valid'));
    const result = await new AiInterpreter(llm({ parse })).interpret(etb('I spent 500'));

    expect(result.intent).toBe('CREATE_EXPENSE');
    expect(result.source).toBe('fallback');
  });

  it('never calls the LLM when useLlm is false (free user over quota)', async () => {
    const parse = vi.fn();
    const result = await new AiInterpreter(llm({ parse })).interpret(etb('I spent 500'), {
      useLlm: false,
    });

    expect(parse).not.toHaveBeenCalled();
    expect(result.source).toBe('fallback');
  });

  it('does not call the LLM when the provider is disabled', async () => {
    const parse = vi.fn();
    const result = await new AiInterpreter(llm({ isEnabled: () => false, parse })).interpret(
      etb('grabbed lunch, around 300'),
    );

    expect(parse).not.toHaveBeenCalled();
    expect(result.source).toBe('fallback');
  });
});
