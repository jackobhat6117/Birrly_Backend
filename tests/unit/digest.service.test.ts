import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DigestService, previousMonth } from '@/modules/digest/digest.service';

const users = { getById: vi.fn() };
const reports = { monthly: vi.fn() };
const insights = { getOrGenerate: vi.fn() };
const coach = { getOrGenerate: vi.fn() };
const digestRepo = { listEligibleUserIds: vi.fn() };

function service() {
  return new DigestService(
    users as never,
    reports as never,
    insights as never,
    coach as never,
    digestRepo as never,
  );
}

const user = {
  id: 'u1',
  timezone: 'Africa/Addis_Ababa',
  language: 'en',
  currency: 'ETB',
  monthlyIncome: null,
  paydayDay: null,
};

describe('previousMonth', () => {
  it('returns the prior month within a year', () => {
    expect(previousMonth(new Date(Date.UTC(2026, 8, 1)))).toEqual({ year: 2026, month: 8 });
  });

  it('rolls back across the year boundary', () => {
    expect(previousMonth(new Date(Date.UTC(2026, 0, 1)))).toEqual({ year: 2025, month: 12 });
  });
});

describe('DigestService.buildForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    users.getById.mockResolvedValue(user);
  });

  it('returns null for a month with no activity (no spam)', async () => {
    reports.monthly.mockResolvedValue({ income: '0.00', expenses: '0.00', savings: '0.00', savingsRate: '0.00' });

    const result = await service().buildForUser('u1', new Date(Date.UTC(2026, 8, 1)));

    expect(result).toBeNull();
    expect(insights.getOrGenerate).not.toHaveBeenCalled();
    expect(coach.getOrGenerate).not.toHaveBeenCalled();
  });

  it('includes figures and still returns when the LLM parts fail (best-effort)', async () => {
    reports.monthly.mockResolvedValue({
      income: '10000.00',
      expenses: '6000.00',
      savings: '4000.00',
      savingsRate: '40.00',
    });
    insights.getOrGenerate.mockRejectedValue(new Error('over quota'));
    coach.getOrGenerate.mockRejectedValue(new Error('llm down'));

    const result = await service().buildForUser('u1', new Date(Date.UTC(2026, 8, 1)));

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      period: { year: 2026, month: 8 },
      income: '10000.00',
      expenses: '6000.00',
      savings: '4000.00',
      savingsRate: '40.00',
      insights: [],
      coachHeadline: null,
      coachTip: null,
    });
  });

  it('surfaces up to three insights and the first coach recommendation', async () => {
    reports.monthly.mockResolvedValue({
      income: '10000.00',
      expenses: '6000.00',
      savings: '4000.00',
      savingsRate: '40.00',
    });
    insights.getOrGenerate.mockResolvedValue({
      insights: [
        { message: 'a', tone: 'positive' },
        { message: 'b', tone: 'neutral' },
        { message: 'c', tone: 'warning' },
        { message: 'd', tone: 'neutral' },
      ],
    });
    coach.getOrGenerate.mockResolvedValue({
      headline: 'Solid month',
      sections: [
        { title: 's1', tone: 'neutral', detail: 'x' },
        { title: 's2', tone: 'warning', detail: 'y', recommendation: 'Cut subscriptions' },
      ],
    });

    const result = await service().buildForUser('u1', new Date(Date.UTC(2026, 8, 1)));

    expect(result?.insights).toHaveLength(3);
    expect(result?.coachHeadline).toBe('Solid month');
    expect(result?.coachTip).toBe('Cut subscriptions');
  });
});
