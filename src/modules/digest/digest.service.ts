import type { UserService } from '@/modules/users/user.service';
import type { ReportService } from '@/modules/reports/report.service';
import type { ReportInsightService } from '@/modules/reports/report-insight.service';
import type { CoachService } from '@/modules/coach/coach.service';
import type { DigestRepository } from '@/modules/digest/digest.repository';
import type { DigestTone, MonthlyDigest } from '@/modules/digest/digest.types';
import { toMoney } from '@/shared/utils/money';
import { logger } from '@/shared/logger/logger';

/** The completed calendar month relative to `ref` (i.e. the previous month). */
export function previousMonth(ref: Date = new Date()): { year: number; month: number } {
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth() + 1; // 1-based current month
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/**
 * Assembles a premium user's monthly digest: deterministic report figures plus
 * optional AI narration (monthly insights + the coach cash-flow lens). Returns
 * null when there is nothing worth sending (no activity that month). The LLM
 * parts are best-effort — if they are disabled, over quota, or the user is not
 * entitled, they are dropped and the figures still go out.
 */
export class DigestService {
  constructor(
    private readonly users: UserService,
    private readonly reports: ReportService,
    private readonly insights: ReportInsightService,
    private readonly coach: CoachService,
    private readonly digestRepo: DigestRepository,
  ) {}

  listEligibleUserIds(now?: Date): Promise<string[]> {
    return this.digestRepo.listEligibleUserIds(now);
  }

  async buildForUser(userId: string, ref: Date = new Date()): Promise<MonthlyDigest | null> {
    const user = await this.users.getById(userId);
    const { year, month } = previousMonth(ref);

    const report = await this.reports.monthly(user.id, user.timezone, year, month);

    // Don't ping users about a month with no activity.
    if (toMoney(report.income).eq(0) && toMoney(report.expenses).eq(0)) {
      return null;
    }

    const insights = await this.insights
      .getOrGenerate(user.id, user.timezone, user.language, user.currency, year, month)
      .catch((error: unknown) => {
        logger.warn({ err: error, userId: user.id }, 'Digest: insights generation skipped');
        return null;
      });

    const coach = await this.coach
      .getOrGenerate(
        'cashflow',
        {
          userId: user.id,
          timezone: user.timezone,
          language: user.language,
          currency: user.currency,
          monthlyIncome: user.monthlyIncome,
          paydayDay: user.paydayDay,
        },
        year,
        month,
      )
      .catch((error: unknown) => {
        logger.warn({ err: error, userId: user.id }, 'Digest: coach generation skipped');
        return null;
      });

    const coachTip = coach?.sections.find((section) => section.recommendation)?.recommendation ?? null;

    return {
      period: { year, month },
      language: user.language,
      currency: user.currency,
      income: report.income,
      expenses: report.expenses,
      savings: report.savings,
      savingsRate: report.savingsRate,
      insights: (insights?.insights ?? []).slice(0, 3).map((insight) => ({
        message: insight.message,
        tone: insight.tone as DigestTone,
      })),
      coachHeadline: coach?.headline ?? null,
      coachTip,
    };
  }
}
