import type { AuditService } from '@/modules/audit/audit.service';
import type { CategoryService } from '@/modules/categories/category.service';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import {
  spentOrZero,
  toBudgetDto,
  type BudgetRepository,
} from '@/modules/budgets/budget.repository';
import type { BudgetDto, CreateBudgetInput, UpdateBudgetInput } from '@/modules/budgets/budget.types';
import { FEATURE } from '@/shared/constants/features';
import { DEFAULT_CURRENCY } from '@/shared/constants/app';
import { ConflictError, ERROR_CODE, NotFoundError } from '@/shared/errors/app-error';
import { currentMonthRange, monthRange } from '@/shared/utils/dates';

export class BudgetService {
  constructor(
    private readonly budgets: BudgetRepository,
    private readonly categories: CategoryService,
    private readonly subscriptions: SubscriptionService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string, timezone: string, year?: number, month?: number): Promise<BudgetDto[]> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.BUDGETS);
    const range = year && month ? monthRange(year, month) : currentMonthRange(timezone);
    const rows = await this.budgets.listForMonth(userId, range.start);
    const spent = await this.budgets.spentByCategory(
      userId,
      range.start,
      range.end,
      rows.map((row) => row.categoryId),
    );
    return rows.map((row) => toBudgetDto(row, spentOrZero(spent, row.categoryId)));
  }

  async create(userId: string, timezone: string, input: CreateBudgetInput): Promise<BudgetDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.BUDGETS);
    const category = await this.categories.resolve(userId, { categoryId: input.categoryId }, 'EXPENSE');
    const { start, end } = currentMonthRange(timezone);
    const existing = await this.budgets.findForCategoryMonth(userId, category.id, start);
    if (existing) {
      throw new ConflictError('A budget for this category already exists this month.');
    }

    const created = await this.budgets.create({
      userId,
      categoryId: category.id,
      amount: input.amount,
      currency: input.currency ?? DEFAULT_CURRENCY,
      period: 'MONTHLY',
      startDate: start,
    });
    await this.audit.record({
      userId,
      action: 'BUDGET_CREATED',
      entityType: 'budget',
      entityId: created.id,
    });
    const spent = await this.budgets.spentByCategory(userId, start, end, [created.categoryId]);
    return toBudgetDto(created, spentOrZero(spent, created.categoryId));
  }

  async update(userId: string, id: string, input: UpdateBudgetInput): Promise<BudgetDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.BUDGETS);
    const budget = await this.requireOwned(id, userId);
    const updated = await this.budgets.updateAmount(budget.id, input.amount);
    await this.audit.record({
      userId,
      action: 'BUDGET_UPDATED',
      entityType: 'budget',
      entityId: updated.id,
    });
    const start = updated.startDate;
    const period = monthRange(start.getUTCFullYear(), start.getUTCMonth() + 1);
    const spent = await this.budgets.spentByCategory(userId, period.start, period.end, [updated.categoryId]);
    return toBudgetDto(updated, spentOrZero(spent, updated.categoryId));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.BUDGETS);
    const budget = await this.requireOwned(id, userId);
    await this.budgets.delete(budget.id);
    await this.audit.record({
      userId,
      action: 'BUDGET_DELETED',
      entityType: 'budget',
      entityId: budget.id,
    });
  }

  private async requireOwned(id: string, userId: string) {
    const budget = await this.budgets.findByIdForUser(id, userId);
    if (!budget) {
      throw new NotFoundError(ERROR_CODE.BUDGET_NOT_FOUND, 'Budget was not found.');
    }
    return budget;
  }
}
