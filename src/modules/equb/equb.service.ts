import { randomBytes } from 'node:crypto';
import type { EqubMember } from '@prisma/client';
import type { DbClient } from '@/database/prisma';
import type { EqubRepository, EqubWithMembers } from '@/modules/equb/equb.repository';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import type { NotificationService } from '@/modules/notifications/notification.service';
import type { AuditService } from '@/modules/audit/audit.service';
import type {
  CreateEqubInput,
  EqubDto,
  EqubMemberDto,
  EqubSummaryDto,
  RecordEqubContributionInput,
} from '@/modules/equb/equb.types';
import { FEATURE } from '@/shared/constants/features';
import { AppError, ERROR_CODE, NotFoundError } from '@/shared/errors/app-error';
import { assertPositiveMoney, formatMoney, toMoney } from '@/shared/utils/money';
import { parseDateInput } from '@/shared/utils/dates';

type EqubConfig = {
  botUsername: string;
};

export class EqubService {
  constructor(
    private readonly db: DbClient,
    private readonly equbs: EqubRepository,
    private readonly subscriptions: SubscriptionService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly config: EqubConfig,
  ) {}

  async list(userId: string): Promise<EqubSummaryDto[]> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.EQUB);
    const rows = await this.equbs.listForUser(userId);
    return rows.map((row) => this.toSummary(row));
  }

  async getById(userId: string, id: string): Promise<EqubDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.EQUB);
    const equb = await this.equbs.findByIdForUser(id, userId);
    if (!equb) {
      throw new NotFoundError(ERROR_CODE.EQUB_NOT_FOUND, 'Equb was not found.');
    }
    return this.toDto(equb);
  }

  async create(userId: string, currency: string, timezone: string, input: CreateEqubInput): Promise<EqubDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.EQUB);
    const amount = assertPositiveMoney(input.contributionAmount);

    const startDate = input.startDate ? parseDateInput(input.startDate, timezone) : parseDateInput('today', timezone);
    const joinToken = randomBytes(9).toString('base64url');

    const created = await this.db.equb.create({
      data: {
        user: { connect: { id: userId } },
        name: input.name.trim(),
        contributionAmount: amount,
        currency: input.currency ?? currency,
        frequency: input.frequency,
        startDate,
        joinToken,
        members: {
          // Rotation order follows the order members were entered.
          create: input.members.map((member, index) => ({
            name: member.name.trim(),
            telegramUsername: member.telegramUsername ?? null,
            payoutPosition: index + 1,
          })),
        },
      },
      include: { members: { orderBy: { payoutPosition: 'asc' } }, contributions: true },
    });

    await this.audit.record({
      userId,
      action: 'EQUB_CREATED',
      entityType: 'equb',
      entityId: created.id,
      metadata: { members: input.members.length, amount: formatMoney(amount) },
    });

    return this.toDto(created as EqubWithMembers);
  }

  async recordContribution(
    userId: string,
    equbId: string,
    input: RecordEqubContributionInput,
  ): Promise<EqubDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.EQUB);
    const equb = await this.equbs.findByIdForUser(equbId, userId);
    if (!equb) {
      throw new NotFoundError(ERROR_CODE.EQUB_NOT_FOUND, 'Equb was not found.');
    }
    const member = equb.members.find((m) => m.id === input.memberId);
    if (!member) {
      throw new NotFoundError(ERROR_CODE.EQUB_NOT_FOUND, 'Member was not found in this Equb.');
    }

    const existing = await this.equbs.findContribution(member.id, equb.currentCycle);
    if (existing) {
      // Idempotent: already recorded this cycle, just return current state.
      const fresh = await this.equbs.findByIdForUser(equbId, userId);
      return this.toDto(fresh!);
    }

    await this.equbs.createContribution({
      equbId: equb.id,
      memberId: member.id,
      cycle: equb.currentCycle,
      amount: equb.contributionAmount,
      currency: equb.currency,
    });

    await this.audit.record({
      userId,
      action: 'EQUB_CONTRIBUTION_RECORDED',
      entityType: 'equb',
      entityId: equb.id,
      metadata: { memberId: member.id, cycle: equb.currentCycle },
    });

    const fresh = await this.equbs.findByIdForUser(equbId, userId);
    return this.toDto(fresh!);
  }

  /**
   * Advances to the next cycle: marks the current recipient as paid out and
   * moves the pointer forward. Completes the Equb once everyone has received.
   */
  async advanceCycle(userId: string, equbId: string): Promise<EqubDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.EQUB);
    const equb = await this.equbs.findByIdForUser(equbId, userId);
    if (!equb) {
      throw new NotFoundError(ERROR_CODE.EQUB_NOT_FOUND, 'Equb was not found.');
    }
    if (equb.status !== 'ACTIVE') {
      throw new AppError(ERROR_CODE.VALIDATION_FAILED, 'This Equb is not active.', 400);
    }

    const recipient = equb.members.find((m) => m.payoutPosition === equb.currentCycle);
    if (recipient) {
      await this.db.equbMember.update({ where: { id: recipient.id }, data: { payoutReceived: true } });
    }

    const isLastCycle = equb.currentCycle >= equb.members.length;
    await this.equbs.update(equb.id, {
      currentCycle: isLastCycle ? equb.currentCycle : equb.currentCycle + 1,
      status: isLastCycle ? 'COMPLETED' : 'ACTIVE',
    });

    await this.audit.record({
      userId,
      action: 'EQUB_CYCLE_ADVANCED',
      entityType: 'equb',
      entityId: equb.id,
      metadata: { cycle: equb.currentCycle, completed: isLastCycle },
    });

    const fresh = await this.equbs.findByIdForUser(equbId, userId);
    return this.toDto(fresh!);
  }

  /**
   * Sends a bot DM to every member who has linked their Telegram, reminding
   * them of this cycle's contribution and who is due to receive it. Members
   * who have not joined via the link are simply skipped (nothing to send to).
   */
  async nudgeMembers(userId: string, equbId: string): Promise<{ notified: number; skipped: number }> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.EQUB);
    const equb = await this.equbs.findByIdForUser(equbId, userId);
    if (!equb) {
      throw new NotFoundError(ERROR_CODE.EQUB_NOT_FOUND, 'Equb was not found.');
    }

    const recipient = equb.members.find((m) => m.payoutPosition === equb.currentCycle);
    const amount = formatMoney(equb.contributionAmount);
    const paidMemberIds = new Set(
      equb.contributions.filter((c) => c.cycle === equb.currentCycle).map((c) => c.memberId),
    );

    let notified = 0;
    let skipped = 0;
    for (const member of equb.members) {
      if (!member.telegramUserId || paidMemberIds.has(member.id)) {
        skipped += 1;
        continue;
      }
      const recipientLine = recipient
        ? `This cycle's pot goes to ${recipient.name}.`
        : '';
      try {
        await this.notifications.notifyTelegramChat(
          member.telegramUserId,
          `Equb: ${equb.name}`,
          `Your ${amount} ${equb.currency} contribution is due for cycle ${equb.currentCycle}. ${recipientLine}`.trim(),
        );
        notified += 1;
      } catch {
        skipped += 1;
      }
    }

    await this.audit.record({
      userId,
      action: 'EQUB_NUDGE_SENT',
      entityType: 'equb',
      entityId: equb.id,
      metadata: { notified, skipped, cycle: equb.currentCycle },
    });

    return { notified, skipped };
  }

  /** Bot-side: resolve a join token to the Equb it belongs to. */
  async findByJoinToken(token: string): Promise<EqubWithMembers | null> {
    return this.equbs.findByJoinToken(token);
  }

  /** Bot-side: link a Telegram user to a member slot when they tap the join link. */
  async linkMember(
    memberId: string,
    telegramUserId: string,
    telegramUsername: string | null,
  ): Promise<EqubMember> {
    return this.equbs.linkMemberTelegram(memberId, telegramUserId, telegramUsername);
  }

  private buildJoinLink(token: string): string {
    const username = this.config.botUsername;
    if (!username) return '';
    return `https://t.me/${username}?start=equb-${token}`;
  }

  private toSummary(equb: EqubWithMembers): EqubSummaryDto {
    const paidThisCycle = equb.contributions.filter((c) => c.cycle === equb.currentCycle).length;
    const recipient = equb.members.find((m) => m.payoutPosition === equb.currentCycle);
    return {
      id: equb.id,
      name: equb.name,
      contributionAmount: formatMoney(equb.contributionAmount),
      currency: equb.currency,
      frequency: equb.frequency,
      status: equb.status,
      currentCycle: equb.currentCycle,
      totalCycles: equb.members.length,
      memberCount: equb.members.length,
      paidThisCycle,
      currentRecipientName: recipient?.name ?? null,
    };
  }

  private toDto(equb: EqubWithMembers): EqubDto {
    const paidThisCycle = new Set(
      equb.contributions.filter((c) => c.cycle === equb.currentCycle).map((c) => c.memberId),
    );
    const pot = toMoney(equb.contributionAmount).mul(equb.members.length);

    const members: EqubMemberDto[] = equb.members.map((member: EqubMember) => ({
      id: member.id,
      name: member.name,
      telegramUsername: member.telegramUsername,
      payoutPosition: member.payoutPosition,
      payoutReceived: member.payoutReceived,
      linked: member.telegramUserId != null,
      paidThisCycle: paidThisCycle.has(member.id),
      isCurrentRecipient: member.payoutPosition === equb.currentCycle,
    }));

    return {
      id: equb.id,
      name: equb.name,
      contributionAmount: formatMoney(equb.contributionAmount),
      currency: equb.currency,
      frequency: equb.frequency,
      startDate: (equb.startDate as Date).toISOString().slice(0, 10),
      status: equb.status,
      currentCycle: equb.currentCycle,
      totalCycles: equb.members.length,
      potAmount: formatMoney(pot),
      joinLink: this.buildJoinLink(equb.joinToken),
      members,
      createdAt: (equb.createdAt as Date).toISOString(),
    };
  }
}
