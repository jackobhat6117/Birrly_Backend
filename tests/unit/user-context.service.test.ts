import { describe, expect, it, vi } from 'vitest';
import type Redis from 'ioredis';
import {
  UserContextService,
  renderPromptHint,
} from '@/modules/ai/user-context/user-context.service';
import type { RawUserContext, UserContextRepository } from '@/modules/ai/user-context/user-context.repository';

function context(overrides: Partial<RawUserContext> = {}): RawUserContext {
  return {
    monthlyIncome: '40000.00',
    paydayDay: 25,
    language: 'en',
    currency: 'ETB',
    frequentCategories: [
      { slug: 'transport', name: 'Transport', uses: 12 },
      { slug: 'food', name: 'Food', uses: 9 },
    ],
    merchantHints: [{ term: 'Bajaj', categorySlug: 'transport', uses: 4 }],
    activeGoals: ['New phone'],
    ...overrides,
  };
}

function fakeRedis(store: Map<string, string>): Redis {
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
      return 'OK';
    }),
    del: vi.fn(async (k: string) => {
      store.delete(k);
      return 1;
    }),
  } as unknown as Redis;
}

describe('renderPromptHint', () => {
  it('renders a compact, labeled hint block from habits', () => {
    const hint = renderPromptHint(context());
    expect(hint).toContain('Personalization hints');
    expect(hint).toContain('transport, food');
    expect(hint).toContain('"Bajaj"→transport');
    expect(hint).toContain('New phone');
    expect(hint).toContain('day 25');
  });

  it('returns empty string for a brand-new user with no habits', () => {
    const hint = renderPromptHint(
      context({ frequentCategories: [], merchantHints: [], activeGoals: [], paydayDay: null }),
    );
    expect(hint).toBe('');
  });
});

describe('UserContextService', () => {
  it('loads from the repo on a cache miss and caches the result', async () => {
    const store = new Map<string, string>();
    const redis = fakeRedis(store);
    const repo = { load: vi.fn().mockResolvedValue(context()) } as unknown as UserContextRepository;
    const service = new UserContextService(repo, redis);

    const first = await service.get('u1');
    expect(first?.frequentCategories).toHaveLength(2);
    expect(repo.load).toHaveBeenCalledOnce();
    expect(store.has('user-context:u1')).toBe(true);
  });

  it('serves from cache without hitting the repo on the second call', async () => {
    const store = new Map<string, string>();
    const repo = { load: vi.fn().mockResolvedValue(context()) } as unknown as UserContextRepository;
    const service = new UserContextService(repo, fakeRedis(store));

    await service.get('u1');
    await service.get('u1');

    expect(repo.load).toHaveBeenCalledOnce();
  });

  it('getPromptHint never throws — returns empty string when the repo fails', async () => {
    const repo = {
      load: vi.fn().mockRejectedValue(new Error('db down')),
    } as unknown as UserContextRepository;
    const service = new UserContextService(repo, fakeRedis(new Map()));

    await expect(service.getPromptHint('u1')).resolves.toBe('');
  });

  it('returns empty hint when there is no user', async () => {
    const repo = { load: vi.fn().mockResolvedValue(null) } as unknown as UserContextRepository;
    const service = new UserContextService(repo, fakeRedis(new Map()));

    expect(await service.getPromptHint('missing')).toBe('');
  });
});
