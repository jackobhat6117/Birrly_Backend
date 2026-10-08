import { randomBytes } from 'node:crypto';
import { Decimal } from 'decimal.js';
import type { DbClient } from '@/database/prisma';
import type { GroupBudgetRepository, GroupBudgetWithRelations } from '@/modules/group-budgets/group-budget.repository';
import type { UserRepository } from '@/modules/users/user.repository';
import type { UserService } from '@/modules/users/user.service';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import type { AuditService } from '@/modules/audit/audit.service';
import type { NotificationService } from '@/modules/notifications/notification.service';
import type {
  CreateGroupBudgetInput,
  UpdateGroupBudgetInput,
  AddGroupExpenseInput,
  GroupBudgetDto,
  GroupBudgetSummaryDto,
  GroupBudgetMemberDto,
  GroupBudgetExpenseDto,
  GroupBudgetRole,
} from '@/modules/group-budgets/group-budget.types';
import { FEATURE, FREE_GROUP_BUDGET_LIMIT, FREE_GROUP_BUDGET_MEMBERS_LIMIT } from '@/shared/constants/features';
import { AppError, ERROR_CODE, ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import { assertPositiveMoney, formatMoney, toMoney } from '@/shared/utils/money';
import { parseDateInput } from '@/shared/utils/dates';

type GroupBudgetConfig = {
  botUsername: string;
};

export class GroupBudgetService {
  constructor(
    private readonly db: DbClient,
    private readonly repository: GroupBudgetRepository,
    private readonly userRepository: UserRepository,
    private readonly userService: UserService,
    private readonly subscriptions: SubscriptionService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly config: GroupBudgetConfig,
  ) {}

  async list(userId: string): Promise<GroupBudgetSummaryDto[]> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.GROUP_BUDGETS);
    const rows = await this.repository.listForUser(userId);
    return rows.map((row) => this.toSummary(row, userId));
  }

  async getById(id: string, userId: string): Promise<GroupBudgetDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.GROUP_BUDGETS);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_BUDGET_NOT_FOUND, 'Group budget not found.');
    }
    const isMember = row.createdById === userId || row.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenError('You do not have access to this group budget.');
    }
    return this.toDto(row, userId);
  }

  async findByJoinToken(token: string): Promise<GroupBudgetWithRelations | null> {
    return this.repository.findByJoinToken(token);
  }

  async findByTelegramChatId(chatId: string): Promise<GroupBudgetWithRelations | null> {
    return this.repository.findByTelegramChatId(chatId);
  }

  async create(userId: string, timezone: string, input: CreateGroupBudgetInput): Promise<GroupBudgetDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.GROUP_BUDGETS);

    const hasUnlimited = await this.subscriptions.canAccess(userId, FEATURE.UNLIMITED_GROUP_BUDGETS);
    if (!hasUnlimited) {
      const count = await this.repository.countCreatedByUser(userId);
      if (count >= FREE_GROUP_BUDGET_LIMIT) {
        throw new AppError(
          ERROR_CODE.SUBSCRIPTION_REQUIRED,
          `Free plan allows only ${FREE_GROUP_BUDGET_LIMIT} group budget. Upgrade to Premium for unlimited group budgets.`,
          403,
        );
      }
    }

    const amount = assertPositiveMoney(input.amount);
    const startDate = input.startDate ? parseDateInput(input.startDate, timezone) : parseDateInput('today', timezone);
    const joinToken = randomBytes(9).toString('base64url');

    const created = await this.db.$transaction(async (tx) => {
      const gb = await tx.groupBudget.create({
        data: {
          createdById: userId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          amount,
          currency: input.currency ?? 'ETB',
          periodUnit: input.periodUnit ?? 'MONTH',
          periodCount: input.periodCount ?? 1,
          startDate,
          joinToken,
        },
      });

      // Creator is automatically the OWNER member
      await tx.groupBudgetMember.create({
        data: {
          groupBudgetId: gb.id,
          userId,
          role: 'OWNER',
        },
      });

      return gb;
    });

    await this.audit.record({
      userId,
      action: 'GROUP_BUDGET_CREATED',
      entityType: 'group_budget',
      entityId: created.id,
      metadata: { name: created.name, amount: formatMoney(amount) },
    });

    const full = await this.repository.findById(created.id);
    return this.toDto(full!, userId);
  }

  async update(id: string, userId: string, input: UpdateGroupBudgetInput): Promise<GroupBudgetDto> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_BUDGET_NOT_FOUND, 'Group budget not found.');
    }
    const myMembership = row.members.find((m) => m.userId === userId);
    const isOwnerOrAdmin = row.createdById === userId || myMembership?.role === 'OWNER' || myMembership?.role === 'ADMIN';
    if (!isOwnerOrAdmin) {
      throw new ForbiddenError('Only the owner or an admin can update this group budget.');
    }

    const data: Record<string, unknown> = {};
    if (input.name) data.name = input.name.trim();
    if (input.amount) data.amount = assertPositiveMoney(input.amount);
    if (input.description !== undefined) data.description = input.description?.trim() || null;

    await this.repository.update(id, data);
    const updated = await this.repository.findById(id);
    return this.toDto(updated!, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_BUDGET_NOT_FOUND, 'Group budget not found.');
    }
    if (row.createdById !== userId) {
      throw new ForbiddenError('Only the creator can delete this group budget.');
    }
    await this.repository.delete(id);
  }

  async joinByToken(token: string, userId: string): Promise<GroupBudgetDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.GROUP_BUDGETS);
    const row = await this.repository.findByJoinToken(token);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_BUDGET_NOT_FOUND, 'Invite link is invalid or has expired.');
    }

    const existing = row.members.find((m) => m.userId === userId);
    if (existing) {
      return this.toDto(row, userId);
    }

    // Check member limit for free plan
    const hasUnlimited = await this.subscriptions.canAccess(row.createdById, FEATURE.UNLIMITED_GROUP_BUDGETS);
    if (!hasUnlimited && row.members.length >= FREE_GROUP_BUDGET_MEMBERS_LIMIT) {
      throw new AppError(
        ERROR_CODE.SUBSCRIPTION_REQUIRED,
        `This group budget has reached the free tier limit of ${FREE_GROUP_BUDGET_MEMBERS_LIMIT} members.`,
        403,
      );
    }

    await this.repository.addMember(row.id, userId, 'MEMBER');

    await this.audit.record({
      userId,
      action: 'GROUP_BUDGET_MEMBER_JOINED',
      entityType: 'group_budget',
      entityId: row.id,
      metadata: { joinToken: token },
    });

    const updated = await this.repository.findById(row.id);
    return this.toDto(updated!, userId);
  }

  async addMemberByTelegramId(
    groupBudgetId: string,
    actingUserId: string,
    telegramId: string,
    role: GroupBudgetRole = 'MEMBER',
  ): Promise<GroupBudgetDto> {
    const row = await this.repository.findById(groupBudgetId);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_BUDGET_NOT_FOUND, 'Group budget not found.');
    }
    const myMembership = row.members.find((m) => m.userId === actingUserId);
    const isOwnerOrAdmin = row.createdById === actingUserId || myMembership?.role === 'OWNER' || myMembership?.role === 'ADMIN';
    if (!isOwnerOrAdmin) {
      throw new ForbiddenError('Only the owner or an admin can add members.');
    }

    // Find or ensure target user
    let targetUser = await this.userRepository.findByTelegramId(telegramId.trim());
    if (!targetUser) {
      const ensured = await this.userService.ensureFromTelegram({
        telegramId: telegramId.trim(),
      });
      targetUser = await this.userRepository.findById(ensured.id);
    }

    if (!targetUser) {
      throw new NotFoundError(ERROR_CODE.USER_NOT_FOUND, 'Target user could not be found or created.');
    }

    // Check limit
    const hasUnlimited = await this.subscriptions.canAccess(row.createdById, FEATURE.UNLIMITED_GROUP_BUDGETS);
    if (!hasUnlimited && row.members.length >= FREE_GROUP_BUDGET_MEMBERS_LIMIT) {
      throw new AppError(
        ERROR_CODE.SUBSCRIPTION_REQUIRED,
        `Group budget reached the member limit of ${FREE_GROUP_BUDGET_MEMBERS_LIMIT}.`,
        403,
      );
    }

    await this.repository.addMember(groupBudgetId, targetUser.id, role);
    const updated = await this.repository.findById(groupBudgetId);
    return this.toDto(updated!, actingUserId);
  }

  async removeMember(groupBudgetId: string, actingUserId: string, targetUserId: string): Promise<void> {
    const row = await this.repository.findById(groupBudgetId);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_BUDGET_NOT_FOUND, 'Group budget not found.');
    }
    const isSelf = actingUserId === targetUserId;
    const isOwner = row.createdById === actingUserId;
    if (!isSelf && !isOwner) {
      throw new ForbiddenError('You can only remove yourself unless you are the owner.');
    }
    if (isOwner && isSelf) {
      throw new AppError(ERROR_CODE.CONFLICT, 'Owner cannot leave group budget. Delete the group budget instead.', 400);
    }
    await this.repository.removeMember(groupBudgetId, targetUserId);
  }

  async addExpense(
    groupBudgetId: string,
    userId: string,
    input: AddGroupExpenseInput,
    source: 'MINI_APP' | 'TELEGRAM' = 'MINI_APP',
  ): Promise<GroupBudgetExpenseDto> {
    const row = await this.repository.findById(groupBudgetId);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_BUDGET_NOT_FOUND, 'Group budget not found.');
    }
    const member = row.members.find((m) => m.userId === userId);
    if (!member) {
      throw new ForbiddenError('You are not a member of this group budget.');
    }
    if (member.role === 'VIEWER') {
      throw new ForbiddenError('Viewers cannot log expenses.');
    }

    const amount = assertPositiveMoney(input.amount);
    const spentAt = input.spentAt ? new Date(input.spentAt) : new Date();

    const expense = await this.repository.addExpense({
      groupBudget: { connect: { id: groupBudgetId } },
      member: { connect: { id: member.id } },
      user: { connect: { id: userId } },
      amount,
      currency: row.currency,
      description: input.description?.trim() || null,
      spentAt,
      source,
      ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
    });

    await this.audit.record({
      userId,
      action: 'GROUP_BUDGET_EXPENSE_ADDED',
      entityType: 'group_budget_expense',
      entityId: expense.id,
      metadata: { groupBudgetId, amount: formatMoney(amount), description: input.description ?? null },
    });

    const category = input.categoryId ? await this.db.category.findUnique({ where: { id: input.categoryId } }) : null;
    const user = await this.userRepository.findById(userId);

    return {
      id: expense.id,
      groupBudgetId,
      amount: formatMoney(expense.amount),
      currency: expense.currency,
      description: expense.description,
      categoryName: category?.name ?? null,
      categoryIcon: category?.icon ?? null,
      spentAt: expense.spentAt.toISOString(),
      loggedBy: {
        id: userId,
        telegramId: user?.telegramId ?? '',
        displayName: user?.firstName ?? user?.telegramUsername ?? 'Member',
      },
      source: expense.source,
    };
  }

  async linkTelegramChat(groupBudgetId: string, actingUserId: string, telegramChatId: string): Promise<GroupBudgetDto> {
    const row = await this.repository.findById(groupBudgetId);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_BUDGET_NOT_FOUND, 'Group budget not found.');
    }
    const isMember = row.createdById === actingUserId || row.members.some((m) => m.userId === actingUserId);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this group budget.');
    }
    await this.repository.update(groupBudgetId, { telegramChatId });
    const updated = await this.repository.findById(groupBudgetId);
    return this.toDto(updated!, actingUserId);
  }

  private toDto(row: GroupBudgetWithRelations, currentUserId: string): GroupBudgetDto {
    const totalAmount = toMoney(row.amount);
    let totalSpent = new Decimal(0);

    // Calculate spend per member
    const spentByMemberId = new Map<string, Decimal>();
    for (const exp of row.expenses) {
      const expAmount = toMoney(exp.amount);
      totalSpent = totalSpent.plus(expAmount);
      const prev = spentByMemberId.get(exp.memberId) ?? new Decimal(0);
      spentByMemberId.set(exp.memberId, prev.plus(expAmount));
    }

    const remaining = Decimal.max(0, totalAmount.minus(totalSpent));
    const percent = totalAmount.gt(0)
      ? Math.min(100, Math.round(totalSpent.dividedBy(totalAmount).times(100).toNumber()))
      : 0;

    let status: 'ok' | 'warning' | 'over' = 'ok';
    if (totalSpent.gte(totalAmount)) {
      status = 'over';
    } else if (percent >= 80) {
      status = 'warning';
    }

    const myMembership = row.members.find((m) => m.userId === currentUserId);
    const isOwner = row.createdById === currentUserId || myMembership?.role === 'OWNER';
    const myRole: GroupBudgetRole = myMembership?.role ?? (isOwner ? 'OWNER' : 'VIEWER');

    const members: GroupBudgetMemberDto[] = row.members.map((m) => {
      const memberSpent = spentByMemberId.get(m.id) ?? new Decimal(0);
      const name = [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.telegramUsername || `ID: ${m.user.telegramId}`;
      return {
        id: m.id,
        userId: m.userId,
        telegramId: m.user.telegramId,
        displayName: name,
        username: m.user.telegramUsername,
        role: m.role as GroupBudgetRole,
        joinedAt: m.joinedAt.toISOString(),
        totalSpent: formatMoney(memberSpent),
      };
    });

    const recentExpenses: GroupBudgetExpenseDto[] = row.expenses.map((e) => {
      const name = [e.user.firstName, e.user.lastName].filter(Boolean).join(' ') || e.user.telegramUsername || `ID: ${e.user.telegramId}`;
      return {
        id: e.id,
        groupBudgetId: row.id,
        amount: formatMoney(e.amount),
        currency: e.currency,
        description: e.description,
        categoryName: e.category?.name ?? null,
        categoryIcon: e.category?.icon ?? null,
        spentAt: e.spentAt.toISOString(),
        loggedBy: {
          id: e.userId,
          telegramId: e.user.telegramId,
          displayName: name,
        },
        source: e.source,
      };
    });

    const joinUrl = `https://t.me/${this.config.botUsername}?start=gb-${row.joinToken}`;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      amount: formatMoney(totalAmount),
      spent: formatMoney(totalSpent),
      remaining: formatMoney(remaining),
      percent,
      status,
      currency: row.currency,
      periodUnit: row.periodUnit as 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR',
      periodCount: row.periodCount,
      startDate: row.startDate.toISOString().slice(0, 10),
      joinToken: row.joinToken,
      joinUrl,
      telegramChatId: row.telegramChatId,
      isOwner,
      myRole,
      members,
      recentExpenses,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toSummary(row: GroupBudgetWithRelations, currentUserId: string): GroupBudgetSummaryDto {
    const dto = this.toDto(row, currentUserId);
    const { recentExpenses: _, ...summary } = dto;
    return summary;
  }
}
