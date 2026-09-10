import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '@/database/prisma';
import { CoachService, type CoachContext } from '@/modules/coach/coach.service';
import type { LLMProvider } from '@/integrations/llm/llm.provider';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import type { ReportService } from '@/modules/reports/report.service';
import type { BudgetService } from '@/modules/budgets/budget.service';
import type { SavingsService } from '@/modules/savings/savings.service';
import type { DebtService } from '@/modules/debts/debt.service';
import type { CoachRepository } from '@/modules/coach/coach.repository';

const ctx: CoachContext = {
  userId: 'u1',
  timezone: 'Africa/Addis_Ababa',
  language: 'en',
  currency: 'ETB',
  monthlyIncome: '40000.00',
  paydayDay: 25,
};

function baseReport() {
  return {
    period: { year: 2026, month: 9, start: '', end: '' },
    income: '40000.00',
    expenses: '20000.00',
    savings: '20000.00',
    savingsRate: '50.00',
    topCategories: [{ name: 'Food', amount: '8000.00' }],
    largestExpenses: [{ category: 'Rent', description: 'Rent', amount: '8000.00' }],
  };
}

function makeService(overrides: {
  llm?: Partial<LLMProvider>;
  existing?: object | null;
  assertCanAccess?: () => Promise<void>;
  recurring?: Array<{ annualCost: string }>;
  budgets?: Array<{ categoryName: string; amount: string; spent: string; status: string }>;
}) {
  const coachAnalysis = {
    findUnique: vi.fn().mockResolvedValue(overrides.existing ?? null),
    upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve({ ...create })),
  };
  const db = { coachAnalysis } as unknown as DbClient;
  const subscriptions = {
    assertCanAccess: overrides.assertCanAccess ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as SubscriptionService;
  const reports = {
    monthly: vi.fn().mockResolvedValue(baseReport()),
    expenseChange: vi.fn().mockResolvedValue({ categories: [] }),
  } as unknown as ReportService;
  const budgets = {
    list: vi.fn().mockResolvedValue(overrides.budgets ?? []),
  } as unknown as BudgetService;
  const savings = { list: vi.fn().mockResolvedValue([]) } as unknown as SavingsService;
  const debts = { list: vi.fn().mockResolvedValue([]) } as unknown as DebtService;
  const coachRepo = {
    recurringCandidates: vi.fn().mockResolvedValue(overrides.recurring ?? []),
  } as unknown as CoachRepository;
  const llm: LLMProvider = {
    isEnabled: () => true,
    parse: vi.fn(),
    generateJson: vi.fn(),
    ...overrides.llm,
  };

  const service = new CoachService(db, subscriptions, reports, budgets, savings, debts, coachRepo, llm);
  return { service, coachAnalysis, llm };
}

const goodResponse = {
  headline: 'You kept half your income this month.',
  sections: [
    { title: 'Strong savings', tone: 'positive', detail: 'You saved 20,000.00 ETB (50%).' },
  ],
};

describe('CoachService.getOrGenerate', () => {
  it('rejects users without AI_COACH access before touching the LLM', async () => {
    const assertCanAccess = vi.fn().mockRejectedValue(new Error('SUBSCRIPTION_REQUIRED'));
    const { service, llm } = makeService({ assertCanAccess });

    await expect(service.getOrGenerate('cashflow', ctx, 2026, 9)).rejects.toThrow('SUBSCRIPTION_REQUIRED');
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it('returns the cached analysis without calling the LLM when one exists', async () => {
    const existing = { analysis: { lens: 'cashflow', headline: 'Cached' } };
    const { service, llm } = makeService({ existing });

    const result = await service.getOrGenerate('cashflow', ctx, 2026, 9);

    expect(result).toEqual({ lens: 'cashflow', headline: 'Cached' });
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it('generates, validates, caches, and computes a grounded health score', async () => {
    const generateJson = vi.fn().mockResolvedValue(goodResponse);
    const { service, coachAnalysis } = makeService({ llm: { generateJson } });

    const result = await service.getOrGenerate('cashflow', ctx, 2026, 9);

    expect(result?.headline).toBe(goodResponse.headline);
    // savings rate 50 -> 60 (capped) + no budgets -> neutral 20 = 80
    expect(result?.metrics.healthScore).toBe(80);
    expect(coachAnalysis.upsert).toHaveBeenCalledOnce();
  });

  it('annualizes and sums recurring leaks into metrics', async () => {
    const generateJson = vi.fn().mockResolvedValue(goodResponse);
    const { service } = makeService({
      llm: { generateJson },
      recurring: [{ annualCost: '3600.00' }, { annualCost: '1200.00' }],
    });

    const result = await service.getOrGenerate('leaks', ctx, 2026, 9);

    expect(result?.metrics.recurringAnnualCost).toBe('4800.00');
  });

  it('penalizes the health score when budgets are over', async () => {
    const generateJson = vi.fn().mockResolvedValue(goodResponse);
    const { service } = makeService({
      llm: { generateJson },
      budgets: [
        { categoryName: 'Food', amount: '5000', spent: '6000', status: 'over' },
        { categoryName: 'Transport', amount: '2000', spent: '1000', status: 'ok' },
      ],
    });

    const result = await service.getOrGenerate('audit', ctx, 2026, 9);

    // 60 (savings) + round(1/2 * 40) = 60 + 20 = 80
    expect(result?.metrics.healthScore).toBe(80);
  });

  it('returns null instead of guessing when the LLM output fails validation', async () => {
    const generateJson = vi.fn().mockResolvedValue({ headline: '', sections: [] });
    const { service, coachAnalysis } = makeService({ llm: { generateJson } });

    const result = await service.getOrGenerate('cashflow', ctx, 2026, 9);

    expect(result).toBeNull();
    expect(coachAnalysis.upsert).not.toHaveBeenCalled();
  });

  it('discards guardrail-violating output (financial advice) and returns null', async () => {
    const generateJson = vi.fn().mockResolvedValue({
      headline: 'You have savings to spare.',
      sections: [
        { title: 'Grow it', tone: 'neutral', detail: 'Consider investing your surplus in stocks.' },
      ],
    });
    const { service, coachAnalysis } = makeService({ llm: { generateJson } });

    const result = await service.getOrGenerate('cashflow', ctx, 2026, 9);

    expect(result).toBeNull();
    expect(coachAnalysis.upsert).not.toHaveBeenCalled();
  });

  it('returns null when the LLM is disabled, without erroring', async () => {
    const { service } = makeService({ llm: { isEnabled: () => false } });

    const result = await service.getOrGenerate('cashflow', ctx, 2026, 9);

    expect(result).toBeNull();
  });

  it('skips the cache and regenerates when forceRefresh is true', async () => {
    const existing = { analysis: { lens: 'cashflow', headline: 'Stale' } };
    const generateJson = vi.fn().mockResolvedValue(goodResponse);
    const { service, coachAnalysis } = makeService({ existing, llm: { generateJson } });

    const result = await service.getOrGenerate('cashflow', ctx, 2026, 9, true);

    expect(generateJson).toHaveBeenCalledOnce();
    expect(coachAnalysis.findUnique).not.toHaveBeenCalled();
    expect(result?.headline).toBe(goodResponse.headline);
  });
});
