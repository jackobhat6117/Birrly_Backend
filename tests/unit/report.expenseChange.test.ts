import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '@/database/prisma';
import { ReportService } from '@/modules/reports/report.service';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';

function asDb(partial: object): DbClient {
  return partial as DbClient;
}

function asSubscriptions(partial: object): SubscriptionService {
  return partial as SubscriptionService;
}

describe('ReportService.expenseChange', () => {
  it('rejects users without ADVANCED_REPORTS access', async () => {
    const subscriptions = asSubscriptions({
      assertCanAccess: vi.fn().mockRejectedValue(new Error('SUBSCRIPTION_REQUIRED')),
    });
    const service = new ReportService(asDb({}), subscriptions);

    await expect(service.expenseChange('user-1', 2026, 9)).rejects.toThrow('SUBSCRIPTION_REQUIRED');
  });

  it('ranks categories by absolute change and folds the rest into "Everything else"', async () => {
    const groupBy = vi
      .fn()
      // current month
      .mockResolvedValueOnce([
        { categoryId: 'food', _sum: { amount: '1500.00' } },
        { categoryId: 'transport', _sum: { amount: '900.00' } },
        { categoryId: 'rent', _sum: { amount: '8000.00' } },
        { categoryId: 'health', _sum: { amount: '100.00' } },
        { categoryId: 'shopping', _sum: { amount: '50.00' } },
        { categoryId: 'entertainment', _sum: { amount: '40.00' } },
        { categoryId: 'gift', _sum: { amount: '30.00' } },
      ])
      // previous month
      .mockResolvedValueOnce([
        { categoryId: 'food', _sum: { amount: '300.00' } },
        { categoryId: 'rent', _sum: { amount: '8000.00' } },
        { categoryId: 'health', _sum: { amount: '100.00' } },
        { categoryId: 'shopping', _sum: { amount: '50.00' } },
        { categoryId: 'entertainment', _sum: { amount: '40.00' } },
        { categoryId: 'gift', _sum: { amount: '30.00' } },
      ]);

    const findMany = vi.fn().mockResolvedValue([
      { id: 'food', name: 'Food' },
      { id: 'transport', name: 'Transport' },
      { id: 'rent', name: 'Rent' },
      { id: 'health', name: 'Health' },
      { id: 'shopping', name: 'Shopping' },
      { id: 'entertainment', name: 'Entertainment' },
      { id: 'gift', name: 'Gift' },
    ]);

    const db = asDb({
      transaction: { groupBy },
      category: { findMany },
    });
    const subscriptions = asSubscriptions({ assertCanAccess: vi.fn().mockResolvedValue(undefined) });
    const service = new ReportService(db, subscriptions);

    const result = await service.expenseChange('user-1', 2026, 9);

    expect(result.categories[0]).toMatchObject({ name: 'Food', delta: '1200.00', direction: 'up' });
    expect(result.categories[1]).toMatchObject({ name: 'Transport', delta: '900.00', direction: 'up' });
    // 7 categories in, top 6 shown + 1 "Everything else" row for the remainder
    expect(result.categories).toHaveLength(7);
    expect(result.categories.at(-1)).toMatchObject({ name: 'Everything else', categoryId: null });
    expect(result.totalExpenses.direction).toBe('up');
  });
});
