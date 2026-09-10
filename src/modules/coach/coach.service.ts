import type { DbClient } from '@/database/prisma';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import type { BudgetService } from '@/modules/budgets/budget.service';
import type { SavingsService } from '@/modules/savings/savings.service';
import type { DebtService } from '@/modules/debts/debt.service';
import type { ReportService } from '@/modules/reports/report.service';
import type { CoachRepository } from '@/modules/coach/coach.repository';
import type { LLMProvider } from '@/integrations/llm/llm.provider';
import { FEATURE } from '@/shared/constants/features';
import { buildCoachPrompt, type CoachPromptFacts } from '@/modules/coach/coach.prompt';
import { coachAnalysisResponseSchema } from '@/modules/coach/coach.schema';
import { computeCoachMetrics } from '@/modules/coach/coach.metrics';
import { collectAllowedNumbers, guardCoachOutput } from '@/modules/coach/coach.guard';
import type { CoachAnalysisDto, CoachLens, CoachSection } from '@/modules/coach/coach.types';
import { monthRange } from '@/shared/utils/dates';
import { logger } from '@/shared/logger/logger';

const DISCLAIMER =
  'This is an automated look at your own logged spending — not financial, investment, or tax advice.';

type MonthlyReport = {
  income: string;
  expenses: string;
  savings: string;
  savingsRate: string;
  topCategories: Array<{ name: string; amount: string }>;
  largestExpenses: Array<{ category: string; description: string | null; amount: string }>;
};

export type CoachContext = {
  userId: string;
  timezone: string;
  language: string;
  currency: string;
  monthlyIncome: string | null;
  paydayDay: number | null;
};

export class CoachService {
  constructor(
    private readonly db: DbClient,
    private readonly subscriptions: SubscriptionService,
    private readonly reports: ReportService,
    private readonly budgets: BudgetService,
    private readonly savings: SavingsService,
    private readonly debts: DebtService,
    private readonly coachRepo: CoachRepository,
    private readonly llm: LLMProvider,
  ) {}

  /**
   * Returns the cached analysis for (user, lens, month) if present, otherwise
   * gathers the user's real numbers, has the LLM narrate them, validates, and
   * caches. Returns null (never a guess) when the LLM is disabled or its output
   * fails validation — the client just hides the card.
   */
  async getOrGenerate(
    lens: CoachLens,
    ctx: CoachContext,
    year: number,
    month: number,
    forceRefresh = false,
  ): Promise<CoachAnalysisDto | null> {
    await this.subscriptions.assertCanAccess(ctx.userId, FEATURE.AI_COACH);

    if (!forceRefresh) {
      const existing = await this.db.coachAnalysis.findUnique({
        where: { userId_lens_year_month: { userId: ctx.userId, lens, year, month } },
      });
      if (existing) {
        return existing.analysis as unknown as CoachAnalysisDto;
      }
    }

    if (!this.llm.isEnabled()) {
      return null;
    }

    const [report, change, budgetList, goals, debtList, recurring] = await Promise.all([
      this.reports.monthly(ctx.userId, ctx.timezone, year, month) as Promise<MonthlyReport>,
      this.reports.expenseChange(ctx.userId, year, month).catch(() => null),
      this.budgets.list(ctx.userId, ctx.timezone).catch(() => []),
      this.savings.list(ctx.userId).catch(() => []),
      this.debts.list(ctx.userId).catch(() => []),
      this.coachRepo.recurringCandidates(ctx.userId, ...this.recurringWindow(year, month)).catch(() => []),
    ]);

    const metrics = computeCoachMetrics(report, budgetList, recurring);

    const facts: CoachPromptFacts = {
      language: ctx.language,
      currency: ctx.currency,
      monthLabel: `${year}-${String(month).padStart(2, '0')}`,
      income: report.income,
      expenses: report.expenses,
      savings: report.savings,
      savingsRate: report.savingsRate,
      monthlyIncome: ctx.monthlyIncome,
      paydayDay: ctx.paydayDay,
      topCategories: report.topCategories ?? [],
      largestExpenses: report.largestExpenses ?? [],
      categoryChanges: (change?.categories ?? []).map((c) => ({
        name: c.name,
        current: c.current,
        previous: c.previous,
        direction: c.direction,
      })),
      budgets: budgetList.map((b) => ({
        categoryName: b.categoryName ?? b.name,
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
      openDebts: debtList
        .filter((d) => d.status === 'OPEN')
        .map((d) => ({
          personName: d.personName,
          type: d.type,
          remainingAmount: d.remainingAmount,
          dueDate: d.dueDate,
        })),
      recurring,
    };

    let sections: CoachSection[];
    let headline: string;
    try {
      const raw = await this.llm.generateJson(buildCoachPrompt(lens, facts));
      const parsed = coachAnalysisResponseSchema.parse(raw);
      headline = parsed.headline;
      sections = parsed.sections;
    } catch (error) {
      logger.warn({ err: error, userId: ctx.userId, lens }, 'Failed to generate coach analysis');
      return null;
    }

    // Enforce (not just request) the non-advisory + no-invented-numbers contract.
    // If the LLM slips, hide the card rather than surface advice or a made-up figure.
    const guard = guardCoachOutput({ headline, sections }, collectAllowedNumbers(facts, metrics));
    if (!guard.ok) {
      logger.warn(
        { userId: ctx.userId, lens, violations: guard.violations },
        'Coach output failed guardrails; discarding',
      );
      return null;
    }

    const dto: CoachAnalysisDto = {
      lens,
      period: { year, month },
      headline,
      metrics,
      sections,
      disclaimer: DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };

    await this.db.coachAnalysis.upsert({
      where: { userId_lens_year_month: { userId: ctx.userId, lens, year, month } },
      create: { userId: ctx.userId, lens, year, month, analysis: dto as unknown as object },
      update: { analysis: dto as unknown as object, generatedAt: new Date() },
    });

    return dto;
  }

  /** Three-month window ending with the target month, for recurring detection. */
  private recurringWindow(year: number, month: number): [Date, Date] {
    const end = monthRange(year, month).end;
    let startMonth = month - 2;
    let startYear = year;
    while (startMonth < 1) {
      startMonth += 12;
      startYear -= 1;
    }
    const start = monthRange(startYear, startMonth).start;
    return [start, end];
  }
}
