import { randomBytes } from 'node:crypto';
import { Decimal } from 'decimal.js';
import type { DbClient } from '@/database/prisma';
import type { GroupSavingsRepository, GroupSavingsWithRelations } from '@/modules/group-savings/group-savings.repository';
import type { UserRepository } from '@/modules/users/user.repository';
import type { UserService } from '@/modules/users/user.service';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import type { AuditService } from '@/modules/audit/audit.service';
import type { NotificationService } from '@/modules/notifications/notification.service';
import type {
  CreateGroupSavingsInput,
  UpdateGroupSavingsInput,
  AddGroupContributionInput,
  GroupSavingsGoalDto,
  GroupSavingsSummaryDto,
  GroupSavingsMemberDto,
  GroupSavingsContributionDto,
} from '@/modules/group-savings/group-savings.types';
import type { GroupBudgetRole } from '@prisma/client';
import { FEATURE, FREE_GROUP_SAVINGS_LIMIT, FREE_GROUP_SAVINGS_MEMBERS_LIMIT } from '@/shared/constants/features';
import { AppError, ERROR_CODE, ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import { assertPositiveMoney, formatMoney, toMoney } from '@/shared/utils/money';
import { parseDateInput } from '@/shared/utils/dates';

type GroupSavingsConfig = {
  botUsername: string;
};

export class GroupSavingsService {
  constructor(
    private readonly db: DbClient,
    private readonly repository: GroupSavingsRepository,
    private readonly userRepository: UserRepository,
    private readonly userService: UserService,
    private readonly subscriptions: SubscriptionService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly config: GroupSavingsConfig,
  ) {}

  async list(userId: string): Promise<GroupSavingsSummaryDto[]> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.GROUP_SAVINGS);
    const rows = await this.repository.listForUser(userId);
    return rows.map((row) => this.toSummary(row, userId));
  }

  async getById(id: string, userId: string): Promise<GroupSavingsGoalDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.GROUP_SAVINGS);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_SAVINGS_NOT_FOUND, 'Group savings goal not found.');
    }
    const isMember = row.createdById === userId || row.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenError('You do not have access to this group savings goal.');
    }
    return this.toDto(row, userId);
  }

  async findByJoinToken(token: string): Promise<GroupSavingsWithRelations | null> {
    return this.repository.findByJoinToken(token);
  }

  async findByTelegramChatId(chatId: string): Promise<GroupSavingsWithRelations | null> {
    return this.repository.findByTelegramChatId(chatId);
  }

  async create(userId: string, input: CreateGroupSavingsInput, timezone = 'Africa/Addis_Ababa'): Promise<GroupSavingsGoalDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.GROUP_SAVINGS);

    const hasUnlimited = await this.subscriptions.canAccess(userId, FEATURE.UNLIMITED_GROUP_SAVINGS);
    if (!hasUnlimited) {
      const count = await this.repository.countCreatedByUser(userId);
      if (count >= FREE_GROUP_SAVINGS_LIMIT) {
        throw new AppError(
          ERROR_CODE.SUBSCRIPTION_REQUIRED,
          `Free plan allows only ${FREE_GROUP_SAVINGS_LIMIT} group savings goal. Upgrade to Premium for unlimited group savings.`,
          403,
        );
      }
    }

    const targetAmount = assertPositiveMoney(input.targetAmount);
    const targetDate = input.targetDate ? parseDateInput(input.targetDate, timezone) : null;
    const joinToken = randomBytes(9).toString('base64url');

    const created = await this.db.$transaction(async (tx) => {
      const goal = await tx.groupSavingsGoal.create({
        data: {
          createdById: userId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          targetAmount,
          currency: input.currency ?? 'ETB',
          targetDate,
          joinToken,
        },
      });

      // Creator is automatically the OWNER member
      await tx.groupSavingsMember.create({
        data: {
          groupSavingsGoalId: goal.id,
          userId,
          role: 'OWNER',
        },
      });

      return goal;
    });

    await this.audit.record({
      userId,
      action: 'GROUP_SAVINGS_CREATED',
      entityType: 'group_savings_goal',
      entityId: created.id,
      metadata: { name: created.name, targetAmount: formatMoney(targetAmount) },
    });

    const full = await this.repository.findById(created.id);
    return this.toDto(full!, userId);
  }

  async update(id: string, userId: string, input: UpdateGroupSavingsInput, timezone = 'Africa/Addis_Ababa'): Promise<GroupSavingsGoalDto> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_SAVINGS_NOT_FOUND, 'Group savings goal not found.');
    }
    const myMembership = row.members.find((m) => m.userId === userId);
    const isOwnerOrAdmin = row.createdById === userId || myMembership?.role === 'OWNER' || myMembership?.role === 'ADMIN';
    if (!isOwnerOrAdmin) {
      throw new ForbiddenError('Only the owner or an admin can update this group savings goal.');
    }

    const data: Record<string, unknown> = {};
    if (input.name) data.name = input.name.trim();
    if (input.targetAmount) data.targetAmount = assertPositiveMoney(input.targetAmount);
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.targetDate !== undefined) {
      data.targetDate = input.targetDate ? parseDateInput(input.targetDate, timezone) : null;
    }

    await this.repository.update(id, data);
    const updated = await this.repository.findById(id);
    return this.toDto(updated!, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_SAVINGS_NOT_FOUND, 'Group savings goal not found.');
    }
    if (row.createdById !== userId) {
      throw new ForbiddenError('Only the creator can delete this group savings goal.');
    }
    await this.repository.delete(id);
  }

  async joinByToken(token: string, userId: string): Promise<GroupSavingsGoalDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.GROUP_SAVINGS);
    const row = await this.repository.findByJoinToken(token);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_SAVINGS_NOT_FOUND, 'Invite link is invalid or has expired.');
    }

    const existing = row.members.find((m) => m.userId === userId);
    if (existing) {
      return this.toDto(row, userId);
    }

    // Check member limit for free plan
    const hasUnlimited = await this.subscriptions.canAccess(row.createdById, FEATURE.UNLIMITED_GROUP_SAVINGS);
    if (!hasUnlimited && row.members.length >= FREE_GROUP_SAVINGS_MEMBERS_LIMIT) {
      throw new AppError(
        ERROR_CODE.SUBSCRIPTION_REQUIRED,
        `This group savings goal has reached the free tier limit of ${FREE_GROUP_SAVINGS_MEMBERS_LIMIT} members.`,
        403,
      );
    }

    await this.repository.addMember(row.id, userId, 'MEMBER');

    await this.audit.record({
      userId,
      action: 'GROUP_SAVINGS_MEMBER_JOINED',
      entityType: 'group_savings_goal',
      entityId: row.id,
      metadata: { joinToken: token },
    });

    const updated = await this.repository.findById(row.id);
    return this.toDto(updated!, userId);
  }

  async addContribution(
    id: string,
    userId: string,
    input: AddGroupContributionInput,
    source: 'MINI_APP' | 'TELEGRAM' | 'API' = 'MINI_APP',
    timezone = 'Africa/Addis_Ababa',
  ): Promise<GroupSavingsGoalDto> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_SAVINGS_NOT_FOUND, 'Group savings goal not found.');
    }

    const member = row.members.find((m) => m.userId === userId);
    let memberId: string;
    if (!member) {
      if (row.createdById === userId) {
        const createdMember = await this.repository.addMember(id, userId, 'OWNER');
        memberId = createdMember.id;
      } else {
        throw new ForbiddenError('You are not a member of this group savings goal.');
      }
    } else {
      memberId = member.id;
    }

    const amount = assertPositiveMoney(input.amount);
    const contributedAt = input.contributedAt ? parseDateInput(input.contributedAt, timezone) : new Date();

    await this.db.$transaction(async (tx) => {
      await tx.groupSavingsContribution.create({
        data: {
          groupSavingsGoalId: id,
          memberId,
          userId,
          amount,
          currency: row.currency,
          note: input.note?.trim() || null,
          contributedAt,
          source,
        },
      });

      // Update currentAmount on goal
      await tx.groupSavingsGoal.update({
        where: { id },
        data: {
          currentAmount: {
            increment: amount,
          },
        },
      });
    });

    await this.audit.record({
      userId,
      action: 'GROUP_SAVINGS_CONTRIBUTION_ADDED',
      entityType: 'group_savings_goal',
      entityId: id,
      metadata: { amount: formatMoney(amount), source },
    });

    const updated = await this.repository.findById(id);
    return this.toDto(updated!, userId);
  }

  async addMemberByTelegramId(id: string, requesterUserId: string, telegramId: string, role: GroupBudgetRole = 'MEMBER'): Promise<GroupSavingsGoalDto> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_SAVINGS_NOT_FOUND, 'Group savings goal not found.');
    }
    const myMembership = row.members.find((m) => m.userId === requesterUserId);
    const isOwnerOrAdmin = row.createdById === requesterUserId || myMembership?.role === 'OWNER' || myMembership?.role === 'ADMIN';
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

    // Check member limit for free tier
    const hasUnlimited = await this.subscriptions.canAccess(row.createdById, FEATURE.UNLIMITED_GROUP_SAVINGS);
    if (!hasUnlimited && row.members.length >= FREE_GROUP_SAVINGS_MEMBERS_LIMIT) {
      throw new AppError(
        ERROR_CODE.SUBSCRIPTION_REQUIRED,
        `Group savings goal reached the member limit of ${FREE_GROUP_SAVINGS_MEMBERS_LIMIT}.`,
        403,
      );
    }

    const alreadyMember = row.members.some((m) => m.userId === targetUser.id);
    if (alreadyMember) {
      return this.toDto(row, requesterUserId);
    }

    await this.repository.addMember(id, targetUser.id, role);
    const updated = await this.repository.findById(id);
    return this.toDto(updated!, requesterUserId);
  }

  async removeMember(id: string, requesterUserId: string, targetUserId: string): Promise<GroupSavingsGoalDto> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_SAVINGS_NOT_FOUND, 'Group savings goal not found.');
    }
    const isOwner = row.createdById === requesterUserId;
    const isSelf = requesterUserId === targetUserId;

    if (!isOwner && !isSelf) {
      throw new ForbiddenError('Only the owner can remove other members, or you may leave yourself.');
    }
    if (isOwner && isSelf) {
      throw new AppError(ERROR_CODE.VALIDATION_FAILED, 'Owner cannot leave their own group savings goal. Transfer or delete instead.', 400);
    }

    await this.repository.removeMember(id, targetUserId);
    const updated = await this.repository.findById(id);
    return this.toDto(updated!, requesterUserId);
  }

  async linkTelegramChat(id: string, userId: string, telegramChatId: string): Promise<GroupSavingsGoalDto> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.GROUP_SAVINGS_NOT_FOUND, 'Group savings goal not found.');
    }
    if (row.createdById !== userId) {
      throw new ForbiddenError('Only the creator can link a Telegram chat.');
    }

    await this.repository.update(id, { telegramChatId });
    const updated = await this.repository.findById(id);
    return this.toDto(updated!, userId);
  }

  private toDto(row: GroupSavingsWithRelations, currentUserId: string): GroupSavingsGoalDto {
    const target = toMoney(row.targetAmount.toString());

    // Calculate total contributed from all contributions
    let totalContributed = new Decimal(0);
    const memberContributions = new Map<string, Decimal>();

    for (const c of row.contributions) {
      const amt = toMoney(c.amount.toString());
      totalContributed = totalContributed.add(amt);
      const curr = memberContributions.get(c.userId) ?? new Decimal(0);
      memberContributions.set(c.userId, curr.add(amt));
    }

    const currentSaved = totalContributed;
    const remaining = Decimal.max(0, target.sub(currentSaved));
    const percent = target.isZero() ? 0 : Math.min(100, Math.round(currentSaved.div(target).mul(100).toNumber()));
    const reached = currentSaved.gte(target);

    const myMembership = row.members.find((m) => m.userId === currentUserId);
    const myRole: GroupBudgetRole = row.createdById === currentUserId ? 'OWNER' : (myMembership?.role ?? 'VIEWER');

    const members: GroupSavingsMemberDto[] = row.members.map((m) => {
      const u = m.user;
      const display = [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.telegramUsername ? `@${u.telegramUsername}` : 'Member');
      const userTotal = memberContributions.get(m.userId) ?? new Decimal(0);
      const pctOfTotal = totalContributed.isZero() ? 0 : Math.min(100, Math.round(userTotal.div(totalContributed).mul(100).toNumber()));

      return {
        id: m.id,
        userId: m.userId,
        telegramId: u.telegramId,
        displayName: display,
        username: u.telegramUsername,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        totalContributed: formatMoney(userTotal),
        percentOfTotal: pctOfTotal,
      };
    });

    const recentContributions: GroupSavingsContributionDto[] = row.contributions.map((c) => {
      const u = c.user;
      const display = [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.telegramUsername ? `@${u.telegramUsername}` : 'Member');
      return {
        id: c.id,
        groupSavingsGoalId: c.groupSavingsGoalId,
        amount: formatMoney(toMoney(c.amount.toString())),
        currency: c.currency,
        note: c.note,
        contributedAt: c.contributedAt.toISOString(),
        loggedBy: {
          id: u.id,
          telegramId: u.telegramId,
          displayName: display,
        },
        source: c.source,
      };
    });

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      targetAmount: formatMoney(target),
      currentAmount: formatMoney(currentSaved),
      remaining: formatMoney(remaining),
      percent,
      reached,
      currency: row.currency,
      targetDate: row.targetDate ? row.targetDate.toISOString().slice(0, 10) : null,
      joinToken: row.joinToken,
      joinUrl: `https://t.me/${this.config.botUsername}?start=gs-${row.joinToken}`,
      telegramChatId: row.telegramChatId,
      isOwner: row.createdById === currentUserId,
      myRole,
      members,
      recentContributions,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toSummary(row: GroupSavingsWithRelations, currentUserId: string): GroupSavingsSummaryDto {
    const dto = this.toDto(row, currentUserId);
    const { recentContributions: _recentContributions, ...summary } = dto;
    return summary;
  }
}
