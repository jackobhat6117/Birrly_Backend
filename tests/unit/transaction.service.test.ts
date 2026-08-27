import { describe, expect, it, vi } from 'vitest';
import { TransactionService } from '@/modules/transactions/transaction.service';
import { ERROR_CODE } from '@/shared/errors/app-error';

const accounts = {
  resolveForUser: vi.fn(),
};

const categories = {
  resolve: vi.fn(),
};

const audit = {
  record: vi.fn(),
};

const transactions = {
  create: vi.fn(),
  findByIdempotencyKey: vi.fn(),
  findByIdForUser: vi.fn(),
  listForUser: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
};

function service() {
  return new TransactionService(
    transactions as never,
    accounts as never,
    categories as never,
    audit as never,
  );
}

describe('TransactionService', () => {
  it('creates an expense after validating amount, account, and category', async function () {
    accounts.resolveForUser.mockResolvedValue({ id: 'acc-1' });
    categories.resolve.mockResolvedValue({ id: 'cat-1', kind: 'EXPENSE' });
    transactions.findByIdempotencyKey.mockResolvedValue(null);
    transactions.create.mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: 'EXPENSE',
      amount: { toString: () => '350.00' },
      currency: 'ETB',
      description: 'Lunch',
      transactionDate: new Date('2026-08-25T00:00:00.000Z'),
      source: 'API',
      createdAt: new Date('2026-08-25T00:00:00.000Z'),
    });

    const result = await service().create('user-1', 'ETB', 'Africa/Addis_Ababa', {
      type: 'EXPENSE',
      amount: '350',
      categorySlug: 'food',
      description: 'Lunch',
      transactionDate: '2026-08-25',
      idempotencyKey: 'key-1',
    });

    expect(result.amount).toBe('350.00');
    expect(result.id).toBe('tx-1');
    expect(audit.record).toHaveBeenCalled();
  });

  it('returns the existing row when the idempotency key already exists', async () => {
    transactions.findByIdempotencyKey.mockResolvedValue({
      id: 'tx-existing',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: 'EXPENSE',
      amount: { toString: () => '350.00' },
      currency: 'ETB',
      description: 'Lunch',
      transactionDate: new Date('2026-08-25T00:00:00.000Z'),
      source: 'TELEGRAM',
      createdAt: new Date('2026-08-25T00:00:00.000Z'),
    });

    const result = await service().create('user-1', 'ETB', 'Africa/Addis_Ababa', {
      type: 'EXPENSE',
      amount: '350',
      idempotencyKey: 'telegram:1',
    });

    expect(result.id).toBe('tx-existing');
    expect(transactions.create).not.toHaveBeenCalled();
  });

  it('rejects unauthorized access to another user transaction', async () => {
    transactions.findByIdForUser.mockResolvedValue(null);
    await expect(service().getById('user-1', 'tx-other')).rejects.toMatchObject({
      code: ERROR_CODE.TRANSACTION_NOT_FOUND,
    });
  });
});
