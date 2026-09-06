import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '@/database/prisma';
import { ReportInsightService } from '@/modules/reports/report-insight.service';
import type { LLMProvider } from '@/integrations/llm/llm.provider';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import type { ReportService } from '@/modules/reports/report.service';
import type { BudgetService } from '@/modules/budgets/budget.service';
import type { SavingsService } from '@/modules/savings/savings.service';

function baseReport() {
  return {
    period: { year: 2026, month: 9, start: '', end: '' },
    income: '40000.00',
    expenses: '8430.00',
    savings: '31570.00',
    savingsRate: '78.93',
    topCategories: [],
    largestExpenses: [],
    comparison: {
      income: { current: '40000.00', previous: '38000.00', delta: '2000.00', direction: 'up' },
      expenses: { current: '8430.00', previous: '26000.00', delta: '-17570.00', direction: 'down' },
      remaining: { current: '31570.00', previous: '12000.00', delta: '19570.00', direction: 'up' },
    },
  };
}

function makeService(overrides: {
  llm?: Partial<LLMProvider>;
  existing?: object | null;
  assertCanAccess?: () => Promise<void>;
}) {
  const monthlyInsight = {
    findUnique: vi.fn().mockResolvedValue(overrides.existing ?? null),
    upsert: vi.fn().mockImplementation(({ create }) =>
      Promise.resolve({ ...create, id: 'insight-1', generatedAt: new Date('2026-09-06T00:00:00.000Z') }),
    ),
  };
  const db = { monthlyInsight } as unknown as DbClient;
  const subscriptions = {
    assertCanAccess: overrides.assertCanAccess ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as SubscriptionService;
  const reports = {
    monthly: vi.fn().mockResolvedValue(baseReport()),
    expenseChange: vi.fn().mockResolvedValue({ categories: [] }),
  } as unknown as ReportService;
  const budgets = { list: vi.fn().mockResolvedValue([]) } as unknown as BudgetService;
  const savings = { list: vi.fn().mockResolvedValue([]) } as unknown as SavingsService;
  const llm: LLMProvider = {
    isEnabled: () => true,
    parse: vi.fn(),
    generateJson: vi.fn(),
    ...overrides.llm,
  };

  const service = new ReportInsightService(db, subscriptions, reports, budgets, savings, llm);
  return { service, db, subscriptions, reports, llm, monthlyInsight };
}

describe('ReportInsightService.getOrGenerate', () => {
  it('rejects users without ADVANCED_REPORTS access before touching the LLM', async () => {
    const assertCanAccess = vi.fn().mockRejectedValue(new Error('SUBSCRIPTION_REQUIRED'));
    const { service, llm } = makeService({ assertCanAccess });

    await expect(service.getOrGenerate('u1', 'Africa/Addis_Ababa', 'en', 'ETB', 2026, 9)).rejects.toThrow(
      'SUBSCRIPTION_REQUIRED',
    );
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it('returns the cached row without calling the LLM when one exists', async () => {
    const existing = {
      year: 2026,
      month: 9,
      insights: [{ message: 'Cached insight', tone: 'neutral' }],
      generatedAt: new Date('2026-09-01T00:00:00.000Z'),
    };
    const { service, llm } = makeService({ existing });

    const result = await service.getOrGenerate('u1', 'Africa/Addis_Ababa', 'en', 'ETB', 2026, 9);

    expect(result?.insights).toEqual([{ message: 'Cached insight', tone: 'neutral' }]);
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it('generates, validates, and caches fresh insights on first request', async () => {
    const generateJson = vi.fn().mockResolvedValue({
      insights: [{ message: 'You saved more than usual this month.', tone: 'positive' }],
    });
    const { service, monthlyInsight } = makeService({ llm: { generateJson } });

    const result = await service.getOrGenerate('u1', 'Africa/Addis_Ababa', 'en', 'ETB', 2026, 9);

    expect(result?.insights).toHaveLength(1);
    expect(result?.insights[0]?.tone).toBe('positive');
    expect(monthlyInsight.upsert).toHaveBeenCalledOnce();
  });

  it('returns null instead of guessing when the LLM output fails schema validation', async () => {
    const generateJson = vi.fn().mockResolvedValue({ insights: [{ message: '', tone: 'made-up-tone' }] });
    const { service, monthlyInsight } = makeService({ llm: { generateJson } });

    const result = await service.getOrGenerate('u1', 'Africa/Addis_Ababa', 'en', 'ETB', 2026, 9);

    expect(result).toBeNull();
    expect(monthlyInsight.upsert).not.toHaveBeenCalled();
  });

  it('returns null when the LLM is disabled, without erroring', async () => {
    const { service } = makeService({ llm: { isEnabled: () => false } });

    const result = await service.getOrGenerate('u1', 'Africa/Addis_Ababa', 'en', 'ETB', 2026, 9);

    expect(result).toBeNull();
  });

  it('skips the cache and regenerates when forceRefresh is true', async () => {
    const existing = {
      year: 2026,
      month: 9,
      insights: [{ message: 'Stale', tone: 'neutral' }],
      generatedAt: new Date('2026-09-01T00:00:00.000Z'),
    };
    const generateJson = vi
      .fn()
      .mockResolvedValue({ insights: [{ message: 'Fresh insight', tone: 'neutral' }] });
    const { service, monthlyInsight } = makeService({ existing, llm: { generateJson } });

    const result = await service.getOrGenerate('u1', 'Africa/Addis_Ababa', 'en', 'ETB', 2026, 9, true);

    expect(generateJson).toHaveBeenCalledOnce();
    expect(monthlyInsight.findUnique).not.toHaveBeenCalled();
    expect(result?.insights[0]?.message).toBe('Fresh insight');
  });
});
