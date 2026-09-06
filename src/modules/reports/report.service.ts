import type { DbClient } from '@/database/prisma';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import { FEATURE } from '@/shared/constants/features';
import { formatMoney, subtractMoney, toMoney } from '@/shared/utils/money';
import { compareMoney } from '@/shared/utils/compare';
import { currentMonthRange, monthRange } from '@/shared/utils/dates';

export class ReportService {
  constructor(
    private readonly db: DbClient,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async dashboard(userId: string, timezone: string) {
    const { start, end } = currentMonthRange(timezone);
    const [income, expenses, topCategories] = await Promise.all([
      this.sumByType(userId, 'INCOME', start, end),
      this.sumByType(userId, 'EXPENSE', start, end),
      this.topExpenseCategories(userId, start, end),
    ]);

    const remaining = subtractMoney(income, expenses);

    return {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      income: formatMoney(income),
      expenses: formatMoney(expenses),
      remaining: formatMoney(remaining),
      topCategories,
    };
  }

  async monthly(userId: string, _timezone: string, year: number, month: number) {
    const advanced = await this.subscriptions.canAccess(userId, FEATURE.ADVANCED_REPORTS);
    const { start, end } = monthRange(year, month);

    const [income, expenses, topCategories, largest] = await Promise.all([
      this.sumByType(userId, 'INCOME', start, end),
      this.sumByType(userId, 'EXPENSE', start, end),
      this.topExpenseCategories(userId, start, end),
      this.largestExpenses(userId, start, end),
    ]);

    const savings = subtractMoney(income, expenses);
    const savingsRate = toMoney(income).eq(0)
      ? '0.00'
      : toMoney(savings).div(income).mul(100).toFixed(2);

    const base = {
      period: { year, month, start: start.toISOString(), end: end.toISOString() },
      income: formatMoney(income),
      expenses: formatMoney(expenses),
      savings: formatMoney(savings),
      savingsRate,
      topCategories,
      largestExpenses: largest,
    };

    if (!advanced) {
      return base;
    }

    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;
    const previous = monthRange(previousYear, previousMonth);
    const [prevIncome, prevExpenses] = await Promise.all([
      this.sumByType(userId, 'INCOME', previous.start, previous.end),
      this.sumByType(userId, 'EXPENSE', previous.start, previous.end),
    ]);
    const prevSavings = subtractMoney(prevIncome, prevExpenses);

    return {
      ...base,
      previousMonth: {
        income: formatMoney(prevIncome),
        expenses: formatMoney(prevExpenses),
        savings: formatMoney(prevSavings),
      },
      comparison: {
        income: compareMoney(income, prevIncome),
        expenses: compareMoney(expenses, prevExpenses),
        remaining: compareMoney(savings, prevSavings),
      },
    };
  }

  /**
   * Per-category breakdown behind the Reports "Why?" button — purely
   * arithmetic (no LLM). Categories are ranked by absolute change so the
   * biggest movers explain the total first; anything left over is folded
   * into a single "everything else" bucket instead of a long tail.
   */
  async expenseChange(userId: string, year: number, month: number) {
    await this.subscriptions.assertCanAccess(userId, FEATURE.ADVANCED_REPORTS);

    const { start, end } = monthRange(year, month);
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;
    const previous = monthRange(previousYear, previousMonth);

    const [current, prior] = await Promise.all([
      this.expenseByCategory(userId, start, end),
      this.expenseByCategory(userId, previous.start, previous.end),
    ]);

    const categoryIds = new Set([...current.keys(), ...prior.keys()]);
    const rows = [...categoryIds].map((categoryId) => {
      const name = current.get(categoryId)?.name ?? prior.get(categoryId)?.name ?? 'Unknown';
      const currentAmount = current.get(categoryId)?.amount ?? toMoney(0);
      const priorAmount = prior.get(categoryId)?.amount ?? toMoney(0);
      return { categoryId, name, ...compareMoney(currentAmount, priorAmount) };
    });

    rows.sort((a, b) => toMoney(b.delta).abs().cmp(toMoney(a.delta).abs()));

    const TOP_N = 6;
    const top = rows.slice(0, TOP_N);
    const rest = rows.slice(TOP_N);

    const categories = rest.length
      ? [
          ...top,
          {
            categoryId: null,
            name: 'Everything else',
            ...compareMoney(
              rest.reduce((sum, row) => sum.plus(toMoney(row.current)), toMoney(0)),
              rest.reduce((sum, row) => sum.plus(toMoney(row.previous)), toMoney(0)),
            ),
          },
        ]
      : top;

    return {
      period: { year, month },
      previousPeriod: { year: previousYear, month: previousMonth },
      totalExpenses: compareMoney(
        rows.reduce((sum, row) => sum.plus(toMoney(row.current)), toMoney(0)),
        rows.reduce((sum, row) => sum.plus(toMoney(row.previous)), toMoney(0)),
      ),
      categories,
    };
  }

  private async expenseByCategory(userId: string, start: Date, end: Date) {
    const grouped = await this.db.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'EXPENSE',
        deletedAt: null,
        transactionDate: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const categories = await this.db.category.findMany({
      where: { id: { in: grouped.map((row) => row.categoryId) } },
    });
    const names = new Map(categories.map((category) => [category.id, category.name]));

    return new Map(
      grouped.map((row) => [
        row.categoryId,
        { name: names.get(row.categoryId) ?? 'Unknown', amount: toMoney(row._sum.amount?.toString() ?? '0') },
      ]),
    );
  }

  private async sumByType(userId: string, type: 'EXPENSE' | 'INCOME', start: Date, end: Date) {
    const result = await this.db.transaction.aggregate({
      where: {
        userId,
        type,
        deletedAt: null,
        transactionDate: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });
    return toMoney(result._sum.amount?.toString() ?? '0');
  }

  private async topExpenseCategories(userId: string, start: Date, end: Date) {
    const grouped = await this.db.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'EXPENSE',
        deletedAt: null,
        transactionDate: { gte: start, lte: end },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    });

    const categoryIds = grouped.map((row) => row.categoryId);
    const categories = await this.db.category.findMany({
      where: { id: { in: categoryIds } },
    });
    const names = new Map(categories.map((category) => [category.id, category.name]));

    return grouped.map((row) => ({
      categoryId: row.categoryId,
      name: names.get(row.categoryId) ?? 'Unknown',
      amount: formatMoney(row._sum.amount?.toString() ?? '0'),
    }));
  }

  private async largestExpenses(userId: string, start: Date, end: Date) {
    const rows = await this.db.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        deletedAt: null,
        transactionDate: { gte: start, lte: end },
      },
      orderBy: { amount: 'desc' },
      take: 5,
      include: { category: true },
    });

    return rows.map((row) => ({
      id: row.id,
      amount: formatMoney(row.amount.toString()),
      currency: row.currency,
      category: row.category.name,
      description: row.description,
      transactionDate: row.transactionDate.toISOString().slice(0, 10),
    }));
  }
}
