import type { Prisma, TransactionType } from '@prisma/client';
import type { DbClient } from '@/database/prisma';
import { formatMoney } from '@/shared/utils/money';

const budgetInclude = {
  category: true,
  categories: { include: { category: true } },
  accounts: true,
  transactions: true,
} satisfies Prisma.BudgetInclude;

export type BudgetRow = Prisma.BudgetGetPayload<{ include: typeof budgetInclude }>;

export type CreateBudgetData = {
  userId: string;
  name: string;
  color: string;
  amount: string;
  currency: string;
  scope: 'ADDED_ONLY' | 'ALL_TRANSACTIONS';
  periodUnit: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  periodCount: number;
  startDate: Date;
  includeIncome: boolean;
  includeLentBorrowed: boolean;
  includeCategoryIds: string[];
  excludeCategoryIds: string[];
  accountIds: string[];
};

export class BudgetRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: CreateBudgetData): Promise<BudgetRow> {
    const primaryCategoryId = data.includeCategoryIds[0] ?? null;
    return this.db.budget.create({
      data: {
        userId: data.userId,
        name: data.name,
        color: data.color,
        amount: data.amount,
        currency: data.currency,
        scope: data.scope,
        periodUnit: data.periodUnit,
        periodCount: data.periodCount,
        startDate: data.startDate,
        includeIncome: data.includeIncome,
        includeLentBorrowed: data.includeLentBorrowed,
        // Keep the legacy single-category column populated for back-compat.
        categoryId: primaryCategoryId,
        period: 'MONTHLY',
        categories: {
          create: [
            ...data.includeCategoryIds.map((categoryId) => ({ categoryId, mode: 'INCLUDE' as const })),
            ...data.excludeCategoryIds.map((categoryId) => ({ categoryId, mode: 'EXCLUDE' as const })),
          ],
        },
        accounts: { create: data.accountIds.map((accountId) => ({ accountId })) },
      },
      include: budgetInclude,
    });
  }

  async findByIdForUser(id: string, userId: string): Promise<BudgetRow | null> {
    return this.db.budget.findFirst({ where: { id, userId }, include: budgetInclude });
  }

  async listForUser(userId: string): Promise<BudgetRow[]> {
    return this.db.budget.findMany({
      where: { userId },
      include: budgetInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async countForUser(userId: string): Promise<number> {
    return this.db.budget.count({ where: { userId } });
  }

  async update(
    id: string,
    fields: Prisma.BudgetUpdateInput,
    relations?: { includeCategoryIds?: string[]; excludeCategoryIds?: string[]; accountIds?: string[] },
  ): Promise<BudgetRow> {
    return this.db.$transaction(async (tx) => {
      await tx.budget.update({ where: { id }, data: fields });

      if (relations?.includeCategoryIds || relations?.excludeCategoryIds) {
        await tx.budgetCategory.deleteMany({ where: { budgetId: id } });
        const rows = [
          ...(relations.includeCategoryIds ?? []).map((categoryId) => ({ budgetId: id, categoryId, mode: 'INCLUDE' as const })),
          ...(relations.excludeCategoryIds ?? []).map((categoryId) => ({ budgetId: id, categoryId, mode: 'EXCLUDE' as const })),
        ];
        if (rows.length > 0) await tx.budgetCategory.createMany({ data: rows });
        const primary = relations.includeCategoryIds?.[0] ?? null;
        await tx.budget.update({ where: { id }, data: { categoryId: primary } });
      }

      if (relations?.accountIds) {
        await tx.budgetAccount.deleteMany({ where: { budgetId: id } });
        if (relations.accountIds.length > 0) {
          await tx.budgetAccount.createMany({
            data: relations.accountIds.map((accountId) => ({ budgetId: id, accountId })),
          });
        }
      }

      return tx.budget.findUniqueOrThrow({ where: { id }, include: budgetInclude });
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.budget.delete({ where: { id } });
  }

  /**
   * Sum transactions matching a budget's filters within [start, end], grouped by
   * type so the service can net income against expense when configured.
   */
  async sumMatching(
    userId: string,
    start: Date,
    end: Date,
    opts: {
      includeCategoryIds: string[];
      excludeCategoryIds: string[];
      accountIds: string[];
      types: TransactionType[];
      onlyTransactionIds?: string[];
    },
  ): Promise<Record<TransactionType, string>> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: null,
      type: { in: opts.types },
      transactionDate: { gte: start, lte: end },
    };

    const categoryFilter: Prisma.StringFilter = {};
    if (opts.includeCategoryIds.length > 0) categoryFilter.in = opts.includeCategoryIds;
    if (opts.excludeCategoryIds.length > 0) categoryFilter.notIn = opts.excludeCategoryIds;
    if (Object.keys(categoryFilter).length > 0) where.categoryId = categoryFilter;

    if (opts.accountIds.length > 0) where.accountId = { in: opts.accountIds };
    if (opts.onlyTransactionIds) where.id = { in: opts.onlyTransactionIds };

    const grouped = await this.db.transaction.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
    });

    const result: Record<TransactionType, string> = { EXPENSE: '0.00', INCOME: '0.00' };
    for (const row of grouped) {
      result[row.type] = formatMoney(row._sum.amount?.toString() ?? '0');
    }
    return result;
  }

  /** Sum debt payments in the window — used when a budget includes lent & borrowed. */
  async sumDebtPayments(userId: string, start: Date, end: Date): Promise<string> {
    const agg = await this.db.debtPayment.aggregate({
      where: { userId, paidAt: { gte: start, lte: end } },
      _sum: { amount: true },
    });
    return formatMoney(agg._sum.amount?.toString() ?? '0');
  }
}
