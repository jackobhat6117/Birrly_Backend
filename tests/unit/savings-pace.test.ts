import { describe, expect, it } from 'vitest';
import { computeSavingsPace } from '@/shared/utils/savings-pace';

describe('computeSavingsPace', () => {
  it('splits 40,000 income and 30,000 spend into 1,000 a day', () => {
    const pace = computeSavingsPace({
      income: '40000',
      plannedSpend: '30000',
      spent: '0',
      daysTotal: 30,
      daysLeft: 30,
    });
    expect(pace.status).toBe('on_track');
    expect(pace.plannedSave).toBe('10000.00');
    expect(pace.originalDaily).toBe('1000.00');
    expect(pace.dailyNow).toBe('1000.00');
  });

  it('recalculates the daily amount after going over the day plan', () => {
    const pace = computeSavingsPace({
      income: '40000',
      plannedSpend: '30000',
      spent: '5000',
      daysTotal: 30,
      daysLeft: 28,
    });
    expect(pace.status).toBe('behind');
    expect(pace.plannedToDate).toBe('3000.00');
    expect(pace.remainingSpend).toBe('25000.00');
    expect(pace.dailyNow).toBe('892.86');
  });

  it('stops the daily amount when the month spend plan is used', () => {
    const pace = computeSavingsPace({
      income: '40000',
      plannedSpend: '30000',
      spent: '31000',
      daysTotal: 30,
      daysLeft: 10,
    });
    expect(pace.status).toBe('over');
    expect(pace.dailyNow).toBe('0.00');
    expect(pace.remainingSpend).toBe('0.00');
  });

  it('asks for income before showing a pace', () => {
    expect(
      computeSavingsPace({
        income: null,
        plannedSpend: '30000',
        spent: '0',
        daysTotal: 30,
        daysLeft: 30,
      }).need,
    ).toBe('income');
  });
});
