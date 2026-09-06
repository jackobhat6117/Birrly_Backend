import type { DbClient } from '@/database/prisma';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import type { BudgetService } from '@/modules/budgets/budget.service';
import type { SavingsService } from '@/modules/savings/savings.service';
import type { ReportService } from '@/modules/reports/report.service';
import type { LLMProvider } from '@/integrations/llm/llm.provider';
import { FEATURE } from '@/shared/constants/features';
import { buildMonthlyInsightsPrompt } from '@/modules/reports/report-insight.prompt';
import { monthlyInsightsResponseSchema } from '@/modules/reports/report-insight.schema';
import type { Insight, MonthlyInsightsDto } from '@/modules/reports/report-insight.types';
import { logger } from '@/shared/logger/logger';

type MonthlyReportWithComparison = {
  comparison?: {
    income: { current: string; previous: string; direction: string };
    expenses: { current: string; previous: string; direction: string };
    remaining: { current: string; previous: string; direction: string };
  };
};

export class ReportInsightService {
  constructor(
    private readonly db: DbClient,
    private readonly subscriptions: SubscriptionService,
    private readonly reports: ReportService,
    private readonly budgets: BudgetService,
    private readonly savings: SavingsService,
    private readonly llm: LLMProvider,
  ) {}

  /**
   * Returns cached insights for the month if present, otherwise generates
   * once and caches. Returns null (never a guess) when the LLM is disabled
   * or its output fails validation — the Reports page just hides the card.
   */
  async getOrGenerate(
    userId: string,
    timezone: string,
    language: string,
    currency: string,
    year: number,
    month: number,
    forceRefresh = false,
  ): Promise<MonthlyInsightsDto | null> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.ADVANCED_REPORTS);

    if (!forceRefresh) {
      const existing = await this.db.monthlyInsight.findUnique({
        where: { userId_year_month: { userId, year, month } },
      });
      if (existing) {
        return this.toDto(existing.year, existing.month, existing.insights, existing.generatedAt);
      }
    }

    if (!this.llm.isEnabled()) {
      return null;
    }

    const [report, change, budgetList, goals] = await Promise.all([
      this.reports.monthly(userId, timezone, year, month),
      this.reports.expenseChange(userId, year, month).catch(() => null),
      this.budgets.list(userId, timezone, year, month).catch(() => []),
      this.savings.list(userId).catch(() => []),
    ]);

    const comparison = (report as MonthlyReportWithComparison).comparison;

    const prompt = buildMonthlyInsightsPrompt({
      language,
      currency,
      income: report.income,
      expenses: report.expenses,
      savings: report.savings,
      savingsRate: report.savingsRate,
      comparison,
      categoryChanges: (change?.categories ?? []).map((c) => ({
        name: c.name,
        current: c.current,
        previous: c.previous,
        direction: c.direction,
      })),
      budgets: budgetList.map((b) => ({
        categoryName: b.categoryName,
        amount: b.amount,
        spent: b.spent,
        status: b.status,
      })),
      savingsGoals: goals.map((g) => ({
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        percent: g.percent,
      })),
    });

    let insights: Insight[];
    try {
      const raw = await this.llm.generateJson(prompt);
      insights = monthlyInsightsResponseSchema.parse(raw).insights;
    } catch (error) {
      logger.warn({ err: error, userId }, 'Failed to generate monthly insights');
      return null;
    }

    const saved = await this.db.monthlyInsight.upsert({
      where: { userId_year_month: { userId, year, month } },
      create: { userId, year, month, insights },
      update: { insights, generatedAt: new Date() },
    });

    return this.toDto(saved.year, saved.month, saved.insights, saved.generatedAt);
  }

  private toDto(year: number, month: number, insights: unknown, generatedAt: Date): MonthlyInsightsDto {
    return {
      period: { year, month },
      insights: insights as Insight[],
      generatedAt: generatedAt.toISOString(),
    };
  }
}
