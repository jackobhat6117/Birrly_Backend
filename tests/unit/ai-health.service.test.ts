import { describe, expect, it, vi } from 'vitest';
import { AiHealthService } from '@/modules/ai/ai-health.service';
import type { LLMProvider } from '@/integrations/llm/llm.provider';

const meta = { provider: 'gemini', model: 'gemini-2.0-flash' };

function makeLlm(over: Partial<LLMProvider>): LLMProvider {
  return { isEnabled: () => true, parse: vi.fn(), generateJson: vi.fn(), ...over };
}

describe('AiHealthService', () => {
  it('status() reports config without calling the provider', () => {
    const parse = vi.fn();
    const service = new AiHealthService(makeLlm({ parse }), meta);

    expect(service.status()).toEqual({ enabled: true, provider: 'gemini', model: 'gemini-2.0-flash' });
    expect(parse).not.toHaveBeenCalled();
  });

  it('probe() short-circuits when the LLM is disabled — no call, ok:false', async () => {
    const parse = vi.fn();
    const service = new AiHealthService(makeLlm({ isEnabled: () => false, parse }), meta);

    const result = await service.probe();

    expect(result.ok).toBe(false);
    expect(result.enabled).toBe(false);
    expect(parse).not.toHaveBeenCalled();
  });

  it('probe() reports ok:true with the parsed intent on a successful round-trip', async () => {
    const parse = vi.fn().mockResolvedValue({ intent: 'CREATE_EXPENSE', source: 'llm' });
    const service = new AiHealthService(makeLlm({ parse }), meta);

    const result = await service.probe();

    expect(result.ok).toBe(true);
    expect(result.sample).toBe('CREATE_EXPENSE');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('probe() surfaces the provider error (e.g. a rejected key) instead of hiding it', async () => {
    const parse = vi.fn().mockRejectedValue(new Error('API key not valid. Please pass a valid API key.'));
    const service = new AiHealthService(makeLlm({ parse }), meta);

    const result = await service.probe();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('API key not valid');
  });
});
