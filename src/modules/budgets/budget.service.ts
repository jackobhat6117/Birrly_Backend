import { DateTime } from 'luxon';
import type { TransactionType } from '@prisma/client';
import type { AuditService } from '@/modules/audit/audit.service';
import type { CategoryService } from '@/modules/categories/category.service';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import { type BudgetRepository, type BudgetRow } from '@/modules/budgets/budget.repository';
import type {
  BudgetDto,
  BudgetPeriodUnit,
  CreateBudgetInput,
  UpdateBudgetInput,
} from '@/modules/budgets/budget.types';
import { FEATURE, FREE_BUDGET_LIMIT } from '@/shared/constants/features';
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/shared/constants/app';
import { AppError, ERROR_CODE, NotFoundError } from '@/shared/errors/app-error';
import { budgetUsage } from '@/shared/utils/compare';
import { currentMonthRange, parseDateInput } from '@/shared/utils/dates';
import { addMoney, formatMoney, subtractMoney, toMoney } from '@/shared/utils/money';

const LUXON_UNIT: Record<BudgetPeriodUnit, 'weeks' | 'months' | 'quarters' | 'years'> = {
  WEEK: 'weeks',
  MONTH: 'months',
  QUARTER: 'quarters',
  YEAR: 'years',
};

/** The period window (containing `now`) for a repeating budget. */
function periodWindow(
  startDate: Date,
  unit: BudgetPeriodUnit,
  count: number,
  timezone: string,
): { start: Date; end: Date } {
  const zone = timezone || DEFAULT_TIMEZONE;
  const luxUnit = LUXON_UNIT[unit];
  const origin = DateTime.fromJSDate(startDate, { zone }).startOf('day');
  const now = DateTime.now().setZone(zone);

  let periodStart = origin;
  if (now > origin) {
    const elapsed = now.diff(origin, luxUnit).as(luxUnit);
    const k = Math.floor(elapsed / count);
    periodStart = origin.plus({ [luxUnit]: k * count });
  }
  const periodEnd = periodStart.plus({ [luxUnit]: count }).minus({ days: 1 }).endOf('day');
  return { start: periodStart.toJSDate(), end: periodEnd.toJSDate() };
}

// ADDED_ONLY budgets count every transaction the user linked, regardless of date.
const ALL_TIME = { start: new Date(0), end: new Date('2999-12-31T23:59:59Z') };

export class BudgetService {
  constructor(
    private readonly budgets: BudgetRepository,
    private readonly categories: CategoryService,
    private readonly subscriptions: SubscriptionService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string, timezone: string): Promise<BudgetDto[]> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.BUDGETS);
    const rows = await this.budgets.listForUser(userId);
    return Promise.all(rows.map((row) => this.toDto(userId, row, timezone)));
  }

  async create(userId: string, timezone: string, input: CreateBudgetInput): Promise<BudgetDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.BUDGETS);

    const unlimited = await this.subscriptions.canAccess(userId, FEATURE.UNLIMITED_BUDGETS);
    if (!unlimited) {
      const count = await this.budgets.countForUser(userId);
      if (count >= FREE_BUDGET_LIMIT) {
        throw new AppError(ERROR_CODE.SUBSCRIPTION_REQUIRED, 'Free plan budget limit reached.', 402);
      }
    }

    const includeIds = input.includeCategoryIds?.length
      ? input.includeCategoryIds
      : input.categoryId
        ? [input.categoryId]
        : [];
    const excludeIds = input.excludeCategoryIds ?? [];

    // Validate every category belongs to the user (or is a system category) and is
    // expense-compatible. resolve() throws INVALID_CATEGORY otherwise.
    const resolved = await Promise.all(
      includeIds.map((id) => this.categories.resolve(userId, { categoryId: id }, 'EXPENSE')),
    );
    await Promise.all(excludeIds.map((id) => this.categories.resolve(userId, { categoryId: id }, 'EXPENSE')));

    const startDate = input.startDate
      ? parseDateInput(input.startDate, timezone)
      : currentMonthRange(timezone).start;

    const created = await this.budgets.create({
      userId,
      name: input.name?.trim() || resolved[0]?.name || 'Budget',
      color: input.color ?? 'green',
      amount: input.amount,
      currency: input.currency ?? DEFAULT_CURRENCY,
      scope: input.scope ?? 'ALL_TRANSACTIONS',
      periodUnit: input.periodUnit ?? 'MONTH',
      periodCount: input.periodCount ?? 1,
      startDate,
      includeIncome: input.includeIncome ?? false,
      includeLentBorrowed: input.includeLentBorrowed ?? false,
      includeCategoryIds: includeIds,
      excludeCategoryIds: excludeIds,
      accountIds: input.accountIds ?? [],
    });

    await this.audit.record({ userId, action: 'BUDGET_CREATED', entityType: 'budget', entityId: created.id });
    return this.toDto(userId, created, timezone);
  }

  async update(userId: string, id: string, input: UpdateBudgetInput): Promise<BudgetDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.BUDGETS);
    const budget = await this.requireOwned(id, userId);

    if (input.includeCategoryIds) {
      await Promise.all(
        input.includeCategoryIds.map((cid) => this.categories.resolve(userId, { categoryId: cid }, 'EXPENSE')),
      );
    }
    if (input.excludeCategoryIds) {
      await Promise.all(
        input.excludeCategoryIds.map((cid) => this.categories.resolve(userId, { categoryId: cid }, 'EXPENSE')),
      );
    }

    const updated = await this.budgets.update(
      budget.id,
      {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
        ...(input.periodUnit !== undefined ? { periodUnit: input.periodUnit } : {}),
        ...(input.periodCount !== undefined ? { periodCount: input.periodCount } : {}),
        ...(input.startDate !== undefined ? { startDate: parseDateInput(input.startDate, timezoneOf(budget)) } : {}),
        ...(input.includeIncome !== undefined ? { includeIncome: input.includeIncome } : {}),
        ...(input.includeLentBorrowed !== undefined ? { includeLentBorrowed: input.includeLentBorrowed } : {}),
      },
      {
        includeCategoryIds: input.includeCategoryIds,
        excludeCategoryIds: input.excludeCategoryIds,
        accountIds: input.accountIds,
      },
    );

    await this.audit.record({ userId, action: 'BUDGET_UPDATED', entityType: 'budget', entityId: updated.id });
    return this.toDto(userId, updated, timezoneOf(budget));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.BUDGETS);
    const budget = await this.requireOwned(id, userId);
    await this.budgets.delete(budget.id);
    await this.audit.record({ userId, action: 'BUDGET_DELETED', entityType: 'budget', entityId: budget.id });
  }

  private async requireOwned(id: string, userId: string): Promise<BudgetRow> {
    const budget = await this.budgets.findByIdForUser(id, userId);
    if (!budget) {
      throw new NotFoundError(ERROR_CODE.BUDGET_NOT_FOUND, 'Budget was not found.');
    }
    return budget;
  }

  private async computeSpent(
    userId: string,
    budget: BudgetRow,
    window: { start: Date; end: Date },
  ): Promise<string> {
    const includeCategoryIds = budget.categories.filter((c) => c.mode === 'INCLUDE').map((c) => c.categoryId);
    const excludeCategoryIds = budget.categories.filter((c) => c.mode === 'EXCLUDE').map((c) => c.categoryId);
    const accountIds = budget.accounts.map((a) => a.accountId);
    const types: TransactionType[] = budget.includeIncome ? ['EXPENSE', 'INCOME'] : ['EXPENSE'];

    const addedOnly = budget.scope === 'ADDED_ONLY';
    const onlyTransactionIds = addedOnly ? budget.transactions.map((t) => t.transactionId) : undefined;
    if (addedOnly && (onlyTransactionIds?.length ?? 0) === 0) return '0.00';

    const range = addedOnly ? ALL_TIME : window;
    const sums = await this.budgets.sumMatching(userId, range.start, range.end, {
      includeCategoryIds,
      excludeCategoryIds,
      accountIds,
      types,
      onlyTransactionIds,
    });

    let spent = toMoney(sums.EXPENSE);
    if (budget.includeIncome) spent = subtractMoney(spent, sums.INCOME); // net spend
    if (budget.includeLentBorrowed && !addedOnly) {
      const debt = await this.budgets.sumDebtPayments(userId, range.start, range.end);
      spent = addMoney(spent, debt);
    }
    return formatMoney(spent);
  }

  private async toDto(userId: string, budget: BudgetRow, timezone: string): Promise<BudgetDto> {
    const window = periodWindow(budget.startDate, budget.periodUnit, budget.periodCount, timezone);
    const spent = await this.computeSpent(userId, budget, window);
    const amount = formatMoney(budget.amount.toString());
    const usage = budgetUsage(amount, spent);

    const includeCategories = budget.categories
      .filter((c) => c.mode === 'INCLUDE')
      .map((c) => ({ categoryId: c.categoryId, name: c.category.name, icon: c.category.icon, color: c.category.color }));
    const excludeCategories = budget.categories
      .filter((c) => c.mode === 'EXCLUDE')
      .map((c) => ({ categoryId: c.categoryId, name: c.category.name, icon: c.category.icon, color: c.category.color }));

    return {
      id: budget.id,
      name: budget.name,
      color: budget.color,
      amount,
      spent: formatMoney(spent),
      remaining: usage.remaining,
      percent: usage.percent,
      status: usage.status,
      currency: budget.currency,
      scope: budget.scope,
      periodUnit: budget.periodUnit,
      periodCount: budget.periodCount,
      startDate: budget.startDate.toISOString().slice(0, 10),
      periodStart: window.start.toISOString().slice(0, 10),
      periodEnd: window.end.toISOString().slice(0, 10),
      includeIncome: budget.includeIncome,
      includeLentBorrowed: budget.includeLentBorrowed,
      includeCategories,
      excludeCategories,
      accountIds: budget.accounts.map((a) => a.accountId),
      // Back-compat for existing cards.
      categoryId: budget.categoryId,
      categoryName: includeCategories[0]?.name ?? null,
      period: budget.period,
    };
  }
}

function timezoneOf(_budget: BudgetRow): string {
  // Budgets aren't timezone-stamped; use the app default for period math.
  return DEFAULT_TIMEZONE;
}
