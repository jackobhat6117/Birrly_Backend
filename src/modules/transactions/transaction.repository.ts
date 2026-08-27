import type { Prisma, Transaction } from '@prisma/client';
import type { DbClient } from '@/database/prisma';
import { formatMoney } from '@/shared/utils/money';
import type { ListTransactionsQuery, TransactionDto } from '@/modules/transactions/transaction.types';

export class TransactionRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: Prisma.TransactionCreateInput): Promise<Transaction> {
    return this.db.transaction.create({ data });
  }

  async findByIdForUser(id: string, userId: string): Promise<Transaction | null> {
    return this.db.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  async findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<Transaction | null> {
    return this.db.transaction.findFirst({
      where: { userId, idempotencyKey, deletedAt: null },
    });
  }

  async listForUser(userId: string, query: ListTransactionsQuery): Promise<{ rows: Transaction[]; total: number }> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.from || query.to
        ? {
            transactionDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await this.db.$transaction([
      this.db.transaction.findMany({
        where,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.transaction.count({ where }),
    ]);

    return { rows, total };
  }

  async update(id: string, data: Prisma.TransactionUpdateInput): Promise<Transaction> {
    return this.db.transaction.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export function toTransactionDto(row: Transaction): TransactionDto {
  return {
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    type: row.type,
    amount: formatMoney(row.amount.toString()),
    currency: row.currency,
    description: row.description,
    transactionDate: row.transactionDate.toISOString().slice(0, 10),
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}
