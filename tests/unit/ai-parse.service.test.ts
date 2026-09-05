import { describe, expect, it, vi } from 'vitest';
import { AiParseService } from '@/modules/ai/ai-parse.service';
import { AiUsageService } from '@/modules/ai/ai-usage.service';
import type { AiInterpreter } from '@/modules/ai/ai.interpreter';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';

describe('AiUsageService', () => {
  it('allows LLM while free quota remains', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue('5'),
      incr: vi.fn(),
      expire: vi.fn(),
    };
    const usage = new AiUsageService(redis as never, 20);
    const status = await usage.getStatus('user-1', false);
    expect(usage.canUseLlm(status, true)).toBe(true);
    expect(status.remaining).toBe(15);
  });

  it('blocks LLM when free quota is exhausted', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue('20'),
      incr: vi.fn(),
      expire: vi.fn(),
    };
    const usage = new AiUsageService(redis as never, 20);
    const status = await usage.getStatus('user-1', false);
    expect(usage.canUseLlm(status, true)).toBe(false);
  });
});

describe('AiParseService', () => {
  it('uses LLM for free users until quota is exhausted', async () => {
    const interpreter = {
      interpret: vi.fn().mockResolvedValue({ intent: 'CREATE_EXPENSE', source: 'llm', missingFields: [] }),
    } satisfies Pick<AiInterpreter, 'interpret'>;
    const redis = {
      get: vi.fn().mockResolvedValue('0'),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn(),
    };
    const usage = new AiUsageService(redis as never, 20);
    const subscriptions = {
      canAccess: vi.fn().mockResolvedValue(false),
    } satisfies Pick<SubscriptionService, 'canAccess'>;
    const parse = new AiParseService(
      interpreter as unknown as AiInterpreter,
      usage,
      subscriptions as unknown as SubscriptionService,
      true,
    );

    const result = await parse.parseForUser('user-1', { text: 'I spent 350 on lunch', language: 'en', currency: 'ETB' });

    expect(result.usedLlm).toBe(true);
    expect(interpreter.interpret).toHaveBeenCalledWith(expect.any(Object), { useLlm: true });
    expect(redis.incr).toHaveBeenCalled();
  });

  it('falls back without LLM when free quota is exhausted', async () => {
    const interpreter = {
      interpret: vi.fn().mockResolvedValue({ intent: 'UNKNOWN', source: 'fallback', missingFields: [] }),
    } satisfies Pick<AiInterpreter, 'interpret'>;
    const redis = {
      get: vi.fn().mockResolvedValue('20'),
      incr: vi.fn(),
      expire: vi.fn(),
    };
    const usage = new AiUsageService(redis as never, 20);
    const subscriptions = {
      canAccess: vi.fn().mockResolvedValue(false),
    } satisfies Pick<SubscriptionService, 'canAccess'>;
    const parse = new AiParseService(
      interpreter as unknown as AiInterpreter,
      usage,
      subscriptions as unknown as SubscriptionService,
      true,
    );

    const result = await parse.parseForUser('user-1', {
      text: 'I spent 350 on lunch today',
      language: 'en',
      currency: 'ETB',
    });

    expect(result.quotaExceeded).toBe(true);
    expect(interpreter.interpret).toHaveBeenCalledWith(expect.any(Object), { useLlm: false });
  });
});
