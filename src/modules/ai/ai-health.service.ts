import type { LLMProvider } from '@/integrations/llm/llm.provider';

export type AiHealthStatus = {
  /** Whether an LLM provider is configured and has a key (config-level, no call). */
  enabled: boolean;
  provider: string;
  model: string;
};

export type AiHealthProbe = AiHealthStatus & {
  /** Did a real round-trip to the provider succeed just now? */
  ok: boolean;
  latencyMs: number;
  /** The parsed intent on success (proves the full path works). */
  sample?: string;
  /** The provider's actual error message on failure (e.g. "API key not valid"). */
  error?: string;
};

/**
 * Answers "is the LLM actually running?" definitively — not just "is it
 * configured?". `status()` is a cheap config read; `probe()` makes one real call
 * so a rejected key or unreachable provider surfaces as `ok: false` with the
 * real error, instead of hiding behind the silent rule-based fallback.
 */
export class AiHealthService {
  constructor(
    private readonly llm: LLMProvider,
    private readonly meta: { provider: string; model: string },
  ) {}

  status(): AiHealthStatus {
    return {
      enabled: this.llm.isEnabled(),
      provider: this.meta.provider,
      model: this.meta.model,
    };
  }

  async probe(): Promise<AiHealthProbe> {
    const status = this.status();
    if (!status.enabled) {
      return { ...status, ok: false, latencyMs: 0, error: 'LLM provider is disabled or missing a key.' };
    }

    const started = Date.now();
    try {
      const command = await this.llm.parse({ text: '80 taxi', language: 'en', currency: 'ETB' });
      return { ...status, ok: true, latencyMs: Date.now() - started, sample: command.intent };
    } catch (error) {
      return {
        ...status,
        ok: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : 'Unknown LLM error.',
      };
    }
  }
}
