import { describe, expect, it, vi } from 'vitest';
import { DebtService } from '@/modules/debts/debt.service';
import { ERROR_CODE } from '@/shared/errors/app-error';

describe('DebtService.recordPayment', () => {
  it('atomically reduces remaining amount and settles when paid in full', async () => {
    const debt = {
      id: 'debt-1',
      userId: 'user-1',
      personName: 'Abebe',
      type: 'OWED_TO_ME',
      originalAmount: { toString: () => '2000.00' },
      remainingAmount: { toString: () => '2000.00' },
      currency: 'ETB',
      dueDate: null,
      note: null,
      status: 'OPEN',
      createdAt: new Date(),
    };

    const debts = {
      findByIdForUser: vi.fn().mockResolvedValue(debt),
      update: vi.fn().mockImplementation((_client, _id, data) => ({
        ...debt,
        remainingAmount: { toString: () => String(data.remainingAmount) },
        status: data.status,
      })),
      createPayment: vi.fn().mockResolvedValue({
        id: 'pay-1',
        amount: { toString: () => '2000.00' },
        currency: 'ETB',
        paidAt: new Date(),
      }),
    };

    const db = {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    };

    const subscriptions = { assertCanAccess: vi.fn().mockResolvedValue(undefined) };
    const audit = { record: vi.fn() };

    const service = new DebtService(db as never, debts as never, subscriptions as never, audit as never);
    const result = await service.recordPayment('user-1', 'debt-1', { amount: '2000' });

    expect(result.debt.status).toBe('SETTLED');
    expect(result.debt.remainingAmount).toBe('0.00');
    expect(audit.record).toHaveBeenCalled();
  });

  it('rejects a payment larger than remaining amount', async () => {
    const debts = {
      findByIdForUser: vi.fn().mockResolvedValue({
        id: 'debt-1',
        remainingAmount: { toString: () => '100.00' },
        status: 'OPEN',
        currency: 'ETB',
      }),
    };
    const db = { $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({}) };
    const service = new DebtService(
      db as never,
      debts as never,
      { assertCanAccess: vi.fn() } as never,
      { record: vi.fn() } as never,
    );

    await expect(service.recordPayment('user-1', 'debt-1', { amount: '150' })).rejects.toMatchObject({
      code: ERROR_CODE.INVALID_AMOUNT,
    });
  });
});
