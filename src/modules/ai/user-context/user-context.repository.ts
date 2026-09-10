import type { DbClient } from '@/database/prisma';

export type FrequentCategory = { slug: string; name: string; uses: number };
export type MerchantHint = { term: string; categorySlug: string; uses: number };

export type RawUserContext = {
  monthlyIncome: string | null;
  paydayDay: number | null;
  language: string;
  currency: string;
  frequentCategories: FrequentCategory[];
  merchantHints: MerchantHint[];
  activeGoals: string[];
};

/**
 * Read-only aggregation for the personalization layer. Pure Prisma; no business
 * decisions. Everything is scoped to the authenticated user (tenant isolation).
 */
export class UserContextRepository {
  constructor(private readonly db: DbClient) {}

  async load(userId: string, windowStart: Date): Promise<RawUserContext | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { monthlyIncome: true, paydayDay: true, language: true, currency: true },
    });
    if (!user) {
      return null;
    }

    const [grouped, expenseRows, goals] = await Promise.all([
      this.db.transaction.groupBy({
        by: ['categoryId'],
        where: { userId, type: 'EXPENSE', deletedAt: null, transactionDate: { gte: windowStart } },
        _count: { _all: true },
        orderBy: { _count: { categoryId: 'desc' } },
        take: 8,
      }),
      this.db.transaction.findMany({
        where: {
          userId,
          type: 'EXPENSE',
          deletedAt: null,
          description: { not: null },
          transactionDate: { gte: windowStart },
        },
        select: { description: true, categoryId: true },
        take: 500,
      }),
      this.db.savingsGoal.findMany({
        where: { userId },
        select: { name: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    const categoryIds = new Set<string>([
      ...grouped.map((g) => g.categoryId),
      ...expenseRows.map((r) => r.categoryId),
    ]);
    const categories = await this.db.category.findMany({
      where: { id: { in: [...categoryIds] } },
      select: { id: true, slug: true, name: true },
    });
    const bySlug = new Map(categories.map((c) => [c.id, { slug: c.slug, name: c.name }]));

    const frequentCategories: FrequentCategory[] = grouped
      .map((g) => {
        const cat = bySlug.get(g.categoryId);
        return cat ? { slug: cat.slug, name: cat.name, uses: g._count._all } : null;
      })
      .filter((c): c is FrequentCategory => c !== null);

    return {
      monthlyIncome: user.monthlyIncome?.toString() ?? null,
      paydayDay: user.paydayDay ?? null,
      language: user.language,
      currency: user.currency,
      frequentCategories,
      merchantHints: buildMerchantHints(expenseRows, bySlug),
      activeGoals: goals.map((g) => g.name),
    };
  }
}

/**
 * A "merchant hint" is a description the user has logged 2+ times that maps
 * consistently to one category — e.g. "Bajaj" → transport. These teach the LLM
 * this user's shorthand without any model training.
 */
function buildMerchantHints(
  rows: Array<{ description: string | null; categoryId: string }>,
  bySlug: Map<string, { slug: string; name: string }>,
): MerchantHint[] {
  const counts = new Map<string, { term: string; categoryId: string; uses: number }>();
  for (const row of rows) {
    const term = row.description?.trim();
    if (!term || term.length > 40) continue;
    const key = `${term.toLowerCase()}::${row.categoryId}`;
    const entry = counts.get(key) ?? { term, categoryId: row.categoryId, uses: 0 };
    entry.uses += 1;
    counts.set(key, entry);
  }

  return [...counts.values()]
    .filter((e) => e.uses >= 2 && bySlug.has(e.categoryId))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 8)
    .map((e) => ({ term: e.term, categorySlug: bySlug.get(e.categoryId)!.slug, uses: e.uses }));
}
