import type { DbClient } from '@/database/prisma';
import { formatMoney, toMoney } from '@/shared/utils/money';
import type { RecurringExpenseCandidate } from '@/modules/coach/coach.types';

/**
 * Repository for the AI Money Coach. Pure Prisma access + arithmetic — no
 * business decisions, no LLM, no subscription checks (the service owns those).
 */
export class CoachRepository {
  constructor(private readonly db: DbClient) {}

  /**
   * Finds repeated expenses that look like subscriptions / recurring leaks:
   * the same normalized description charged in 2+ distinct months of the
   * window. Returns them ranked by annualized cost so the biggest leaks
   * surface first. All figures are computed here; the LLM only narrates them.
   */
  async recurringCandidates(
    userId: string,
    windowStart: Date,
    windowEnd: Date,
    limit = 8,
  ): Promise<RecurringExpenseCandidate[]> {
    const rows = await this.db.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        deletedAt: null,
        description: { not: null },
        transactionDate: { gte: windowStart, lte: windowEnd },
      },
      select: {
        amount: true,
        description: true,
        transactionDate: true,
        category: { select: { name: true } },
      },
    });

    const windowMonths = Math.max(1, monthsBetween(windowStart, windowEnd));

    type Bucket = {
      label: string;
      categoryName: string;
      months: Set<string>;
      occurrences: number;
      total: ReturnType<typeof toMoney>;
    };
    const buckets = new Map<string, Bucket>();

    for (const row of rows) {
      const label = (row.description ?? '').trim();
      if (!label) {
        continue;
      }
      const key = label.toLowerCase();
      const bucket = buckets.get(key) ?? {
        label,
        categoryName: row.category?.name ?? 'Uncategorized',
        months: new Set<string>(),
        occurrences: 0,
        total: toMoney(0),
      };
      bucket.occurrences += 1;
      bucket.months.add(monthKey(row.transactionDate));
      bucket.total = bucket.total.plus(toMoney(row.amount.toString()));
      buckets.set(key, bucket);
    }

    return [...buckets.values()]
      .filter((bucket) => bucket.months.size >= 2)
      .map((bucket) => {
        const monthlyAverage = bucket.total.div(windowMonths);
        return {
          label: bucket.label,
          categoryName: bucket.categoryName,
          monthsSeen: bucket.months.size,
          occurrences: bucket.occurrences,
          monthlyAverage: formatMoney(monthlyAverage),
          annualCost: formatMoney(monthlyAverage.mul(12)),
        };
      })
      .sort((a, b) => toMoney(b.annualCost).cmp(toMoney(a.annualCost)))
      .slice(0, limit);
  }
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
}

function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}
