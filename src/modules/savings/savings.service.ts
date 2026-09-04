import type { AuditService } from '@/modules/audit/audit.service';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import { toSavingsGoalDto, type SavingsRepository } from '@/modules/savings/savings.repository';
import type {
  ContributeSavingsInput,
  CreateSavingsGoalInput,
  SavingsGoalDto,
  SavingsPaceDto,
} from '@/modules/savings/savings.types';
import { FEATURE, FREE_SAVINGS_GOAL_LIMIT } from '@/shared/constants/features';
import { AppError, ERROR_CODE, NotFoundError } from '@/shared/errors/app-error';
import { DEFAULT_CURRENCY } from '@/shared/constants/app';
import { currentMonthRange, nowInZone } from '@/shared/utils/dates';
import { formatMoney, toMoney } from '@/shared/utils/money';
import { computeSavingsPace } from '@/shared/utils/savings-pace';

export class SavingsService {
  constructor(
    private readonly savings: SavingsRepository,
    private readonly subscriptions: SubscriptionService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string): Promise<SavingsGoalDto[]> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.SAVINGS_GOALS);
    const rows = await this.savings.listForUser(userId);
    return rows.map(toSavingsGoalDto);
  }

  async create(userId: string, input: CreateSavingsGoalInput): Promise<SavingsGoalDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.SAVINGS_GOALS);
    const unlimited = await this.subscriptions.canAccess(userId, FEATURE.UNLIMITED_SAVINGS_GOALS);
    if (!unlimited) {
      const count = (await this.savings.listForUser(userId)).length;
      if (count >= FREE_SAVINGS_GOAL_LIMIT) {
        throw new AppError(
          ERROR_CODE.SUBSCRIPTION_REQUIRED,
          'Free plan savings goal limit reached.',
          402,
        );
      }
    }
    const created = await this.savings.create({
      userId,
      name: input.name.trim(),
      targetAmount: input.targetAmount,
      currency: input.currency ?? DEFAULT_CURRENCY,
    });
    await this.audit.record({
      userId,
      action: 'SAVINGS_GOAL_CREATED',
      entityType: 'savings_goal',
      entityId: created.id,
    });
    return toSavingsGoalDto(created);
  }

  async contribute(userId: string, id: string, input: ContributeSavingsInput): Promise<SavingsGoalDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.SAVINGS_GOALS);
    const goal = await this.requireOwned(id, userId);
    const updated = await this.savings.contribute(goal.id, input.amount);
    await this.audit.record({
      userId,
      action: 'SAVINGS_CONTRIBUTED',
      entityType: 'savings_goal',
      entityId: goal.id,
      metadata: { amount: input.amount },
    });
    return toSavingsGoalDto(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.SAVINGS_GOALS);
    const goal = await this.requireOwned(id, userId);
    await this.savings.delete(goal.id);
    await this.audit.record({
      userId,
      action: 'SAVINGS_GOAL_DELETED',
      entityType: 'savings_goal',
      entityId: goal.id,
    });
  }

  async pace(userId: string, timezone: string): Promise<SavingsPaceDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.SAVINGS_GOALS);
    return this.buildPace(userId, timezone);
  }

  async updatePace(userId: string, timezone: string, plannedSpend: string): Promise<SavingsPaceDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.SAVINGS_GOALS);
    await this.savings.setMonthlySpendPlan(userId, plannedSpend);
    await this.audit.record({
      userId,
      action: 'SAVINGS_PACE_UPDATED',
      entityType: 'user',
      entityId: userId,
      metadata: { plannedSpend },
    });
    return this.buildPace(userId, timezone);
  }

  private async buildPace(userId: string, timezone: string): Promise<SavingsPaceDto> {
    const now = nowInZone(timezone);
    const { start, end } = currentMonthRange(timezone);
    const [profile, recordedIncome, spent] = await Promise.all([
      this.savings.findUserForPace(userId),
      this.savings.sumByType(userId, 'INCOME', start, end),
      this.savings.sumByType(userId, 'EXPENSE', start, end),
    ]);
    const recorded = toMoney(recordedIncome);
    const profileIncome = profile?.monthlyIncome ? formatMoney(profile.monthlyIncome.toString()) : null;
    const income = recorded.gt(0) ? formatMoney(recordedIncome) : profileIncome;
    const plannedSpend = profile?.monthlySpendPlan
      ? formatMoney(profile.monthlySpendPlan.toString())
      : null;
    const daysTotal = now.daysInMonth ?? 30;
    const daysLeft = daysTotal - now.day + 1;
    return {
      ...computeSavingsPace({
        income,
        plannedSpend,
        spent,
        daysTotal,
        daysLeft,
      }),
      currency: profile?.currency ?? DEFAULT_CURRENCY,
    };
  }

  private async requireOwned(id: string, userId: string) {
    const goal = await this.savings.findByIdForUser(id, userId);
    if (!goal) {
      throw new NotFoundError(ERROR_CODE.SAVINGS_GOAL_NOT_FOUND, 'Savings goal was not found.');
    }
    return goal;
  }
}
