import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/errors/app-error';
import { addMoney, assertPositiveMoney, formatMoney, subtractMoney } from '@/shared/utils/money';

describe('money', () => {
  it('formats fixed-precision amounts', () => {
    expect(formatMoney('350')).toBe('350.00');
    expect(formatMoney(12.5)).toBe('12.50');
  });

  it('rejects zero, negative, and over-precise values', () => {
    expect(() => assertPositiveMoney(0)).toThrow(AppError);
    expect(() => assertPositiveMoney(-10)).toThrow(AppError);
    expect(() => assertPositiveMoney('10.123')).toThrow(AppError);
  });

  it('adds and subtracts without floating-point drift', () => {
    expect(addMoney('0.10', '0.20').toFixed(2)).toBe('0.30');
    expect(subtractMoney('2000', '750.50').toFixed(2)).toBe('1249.50');
  });
});
