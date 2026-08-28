import type { SavingsGoal, TransactionType } from '@prisma/client';
import type { DbClient } from '@/database/prisma';
import { addMoney, formatMoney, toMoney } from '@/shared/utils/money';
import { savingsProgress } from '@/shared/utils/compare';
import type { SavingsGoalDto } from '@/modules/savings/savings.types';

export class SavingsRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: {
    userId: string;
    name: string;
    targetAmount: string;
    currency: string;
  }): Promise<SavingsGoal> {
    return this.db.savingsGoal.create({ data });
  }

  async findByIdForUser(id: string, userId: string): Promise<SavingsGoal | null> {
    return this.db.savingsGoal.findFirst({ where: { id, userId } });
  }

  async listForUser(userId: string): Promise<SavingsGoal[]> {
    return this.db.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async contribute(id: string, amount: string): Promise<SavingsGoal> {
    return this.db.$transaction(async (tx) => {
      const goal = await tx.savingsGoal.findUnique({ where: { id } });
      if (!goal) {
        throw new Error('SAVINGS_GOAL_MISSING');
      }
      const currentAmount = formatMoney(addMoney(goal.currentAmount.toString(), amount));
      await tx.savingsContribution.create({
        data: {
          savingsGoalId: id,
          amount,
        },
      });
      return tx.savingsGoal.update({
        where: { id },
        data: { currentAmount },
      });
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.savingsGoal.delete({ where: { id } });
  }

  async sumByType(userId: string, type: TransactionType, start: Date, end: Date): Promise<string> {
    const result = await this.db.transaction.aggregate({
      where: {
        userId,
        type,
        deletedAt: null,
        transactionDate: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });
    return formatMoney(toMoney(result._sum.amount?.toString() ?? '0'));
  }

  async findUserForPace(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        monthlyIncome: true,
        monthlySpendPlan: true,
        currency: true,
      },
    });
  }

  async setMonthlySpendPlan(userId: string, plannedSpend: string | null) {
    return this.db.user.update({
      where: { id: userId },
      data: { monthlySpendPlan: plannedSpend },
    });
  }
}

export function toSavingsGoalDto(row: SavingsGoal): SavingsGoalDto {
  const targetAmount = formatMoney(row.targetAmount.toString());
  const currentAmount = formatMoney(row.currentAmount.toString());
  const progress = savingsProgress(targetAmount, currentAmount);
  return {
    id: row.id,
    name: row.name,
    targetAmount,
    currentAmount,
    remaining: progress.remaining,
    percent: progress.percent,
    reached: progress.reached,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
  };
}
