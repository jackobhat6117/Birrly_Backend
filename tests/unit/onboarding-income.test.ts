import { describe, expect, it } from 'vitest';
import { parseOnboardingIncomeAmount } from '@/integrations/telegram/telegram-update.handler';

describe('parseOnboardingIncomeAmount', () => {
  it('reads a plain monthly amount', () => {
    expect(parseOnboardingIncomeAmount('40000')).toBe('40000');
    expect(parseOnboardingIncomeAmount('40,000 birr')).toBe('40000');
    expect(parseOnboardingIncomeAmount('salary 25000')).toBe('25000');
  });

  it('leaves expense messages alone', () => {
    expect(parseOnboardingIncomeAmount('80 taxi')).toBeNull();
    expect(parseOnboardingIncomeAmount('ምሳ 500')).toBeNull();
    expect(parseOnboardingIncomeAmount('0')).toBeNull();
  });
});
