import { Decimal } from 'decimal.js';
import { MONEY_MAX, MONEY_SCALE } from '@/shared/constants/app';
import { AppError, ERROR_CODE } from '@/shared/errors/app-error';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = string | number | Decimal;

export function toMoney(value: MoneyInput): Decimal {
  try {
    const amount = value instanceof Decimal ? value : new Decimal(value);
    if (!amount.isFinite()) {
      throw new Error('not finite');
    }
    return amount;
  } catch {
    throw new AppError(ERROR_CODE.INVALID_AMOUNT, 'Amount is not a valid number.', 400);
  }
}

export function assertPositiveMoney(value: MoneyInput): Decimal {
  const amount = toMoney(value);

  if (amount.lte(0)) {
    throw new AppError(ERROR_CODE.INVALID_AMOUNT, 'Amount must be greater than zero.', 400);
  }

  if (amount.decimalPlaces() > MONEY_SCALE) {
    throw new AppError(
      ERROR_CODE.INVALID_AMOUNT,
      `Amount cannot have more than ${MONEY_SCALE} decimal places.`,
      400,
    );
  }

  if (amount.gt(MONEY_MAX)) {
    throw new AppError(ERROR_CODE.INVALID_AMOUNT, 'Amount exceeds the allowed maximum.', 400);
  }

  return amount.toDecimalPlaces(MONEY_SCALE);
}

export function formatMoney(value: MoneyInput): string {
  return toMoney(value).toFixed(MONEY_SCALE);
}

export function serializeMoney(value: MoneyInput, currency: string): { amount: string; currency: string } {
  return {
    amount: formatMoney(value),
    currency,
  };
}

export function addMoney(left: MoneyInput, right: MoneyInput): Decimal {
  return toMoney(left).plus(toMoney(right)).toDecimalPlaces(MONEY_SCALE);
}

export function subtractMoney(left: MoneyInput, right: MoneyInput): Decimal {
  return toMoney(left).minus(toMoney(right)).toDecimalPlaces(MONEY_SCALE);
}
