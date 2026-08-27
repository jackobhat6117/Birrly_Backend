import type { Budget, Category } from '@prisma/client';
import type { DbClient } from '@/database/prisma';
import { formatMoney, toMoney } from '@/shared/utils/money';
import { budgetUsage } from '@/shared/utils/compare';
import type { BudgetDto } from '@/modules/budgets/budget.types';

type BudgetWithCategory = Budget & { category: Category };

export class BudgetRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: {
    userId: string;
    categoryId: string;
    amount: string;
    currency: string;
    period: string;
    startDate: Date;
  }): Promise<BudgetWithCategory> {
    return this.db.budget.create({
      data,
      include: { category: true },
    });
  }

  async findByIdForUser(id: string, userId: string): Promise<BudgetWithCategory | null> {
    return this.db.budget.findFirst({
      where: { id, userId },
      include: { category: true },
    });
  }

  async findForCategoryMonth(userId: string, categoryId: string, startDate: Date) {
    return this.db.budget.findFirst({
      where: { userId, categoryId, startDate },
    });
  }

  async listForMonth(userId: string, startDate: Date): Promise<BudgetWithCategory[]> {
    return this.db.budget.findMany({
      where: { userId, startDate },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateAmount(id: string, amount: string): Promise<BudgetWithCategory> {
    return this.db.budget.update({
      where: { id },
      data: { amount },
      include: { category: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.budget.delete({ where: { id } });
  }

  async spentByCategory(
    userId: string,
    start: Date,
    end: Date,
    categoryIds: string[],
  ): Promise<Map<string, string>> {
    if (categoryIds.length === 0) return new Map();
    const grouped = await this.db.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'EXPENSE',
        deletedAt: null,
        categoryId: { in: categoryIds },
        transactionDate: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });
    return new Map(
      grouped.map((row) => [row.categoryId, formatMoney(row._sum.amount?.toString() ?? '0')]),
    );
  }
}

export function toBudgetDto(row: BudgetWithCategory, spent: string): BudgetDto {
  const amount = formatMoney(row.amount.toString());
  const usage = budgetUsage(amount, spent);
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    amount,
    spent: formatMoney(spent),
    remaining: usage.remaining,
    percent: usage.percent,
    status: usage.status,
    currency: row.currency,
    period: row.period,
    startDate: row.startDate.toISOString().slice(0, 10),
  };
}

export function spentOrZero(spent: Map<string, string>, categoryId: string): string {
  return formatMoney(toMoney(spent.get(categoryId) ?? '0'));
}
