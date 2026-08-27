import { describe, expect, it } from 'vitest';
import { budgetUsage, compareMoney, savingsProgress } from '@/shared/utils/compare';

describe('compareMoney', () => {
  it('reports an increase as up', () => {
    expect(compareMoney('40000', '38000')).toEqual({
      current: '40000.00',
      previous: '38000.00',
      delta: '2000.00',
      direction: 'up',
    });
  });

  it('reports a decrease as down', () => {
    expect(compareMoney('8000', '9000').direction).toBe('down');
  });

  it('reports equal amounts as flat', () => {
    expect(compareMoney('100', '100').direction).toBe('flat');
  });
});

describe('budgetUsage', () => {
  it('marks overspend', () => {
    const usage = budgetUsage('8000', '8500');
    expect(usage.status).toBe('over');
    expect(usage.remaining).toBe('-500.00');
  });

  it('warns at 90% used', () => {
    expect(budgetUsage('1000', '900').status).toBe('warning');
  });

  it('stays ok below 90%', () => {
    expect(budgetUsage('5000', '350').status).toBe('ok');
  });
});

describe('savingsProgress', () => {
  it('caps remaining at zero when the goal is reached', () => {
    const progress = savingsProgress('10000', '12000');
    expect(progress.reached).toBe(true);
    expect(progress.remaining).toBe('0.00');
    expect(progress.percent).toBe(100);
  });

  it('computes leftover toward the target', () => {
    const progress = savingsProgress('10000', '2500');
    expect(progress.reached).toBe(false);
    expect(progress.remaining).toBe('7500.00');
    expect(progress.percent).toBe(25);
  });
});
