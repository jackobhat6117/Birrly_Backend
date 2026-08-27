import type { AuditService } from '@/modules/audit/audit.service';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import { toSavingsGoalDto, type SavingsRepository } from '@/modules/savings/savings.repository';
import type {
  ContributeSavingsInput,
  CreateSavingsGoalInput,
  SavingsGoalDto,
} from '@/modules/savings/savings.types';
import { FEATURE } from '@/shared/constants/features';
import { DEFAULT_CURRENCY } from '@/shared/constants/app';
import { ERROR_CODE, NotFoundError } from '@/shared/errors/app-error';

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

  private async requireOwned(id: string, userId: string) {
    const goal = await this.savings.findByIdForUser(id, userId);
    if (!goal) {
      throw new NotFoundError(ERROR_CODE.SAVINGS_GOAL_NOT_FOUND, 'Savings goal was not found.');
    }
    return goal;
  }
}
