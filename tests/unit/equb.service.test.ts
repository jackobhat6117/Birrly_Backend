import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '@/database/prisma';
import { EqubService } from '@/modules/equb/equb.service';
import type { EqubRepository, EqubWithMembers } from '@/modules/equb/equb.repository';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import type { NotificationService } from '@/modules/notifications/notification.service';
import type { AuditService } from '@/modules/audit/audit.service';

function member(over: Partial<EqubWithMembers['members'][number]> & { id: string; payoutPosition: number }) {
  return {
    name: `Member ${over.payoutPosition}`,
    telegramUserId: null,
    telegramUsername: null,
    payoutReceived: false,
    joinedAt: null,
    createdAt: new Date(),
    equbId: 'equb-1',
    ...over,
  } as EqubWithMembers['members'][number];
}

function equb(over: Partial<EqubWithMembers> = {}): EqubWithMembers {
  return {
    id: 'equb-1',
    userId: 'u1',
    name: 'Office Equb',
    contributionAmount: '1000.0000' as unknown as EqubWithMembers['contributionAmount'],
    currency: 'ETB',
    frequency: 'MONTHLY',
    startDate: new Date('2026-09-01'),
    status: 'ACTIVE',
    currentCycle: 1,
    joinToken: 'tok123',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date(),
    members: [
      member({ id: 'm1', payoutPosition: 1, name: 'Abebe' }),
      member({ id: 'm2', payoutPosition: 2, name: 'Sara' }),
      member({ id: 'm3', payoutPosition: 3, name: 'Kebede' }),
    ],
    contributions: [],
    ...over,
  } as EqubWithMembers;
}

function makeService(over: {
  repo?: Partial<EqubRepository>;
  canAccess?: () => Promise<void>;
  notify?: Partial<NotificationService>;
}) {
  const subscriptions = {
    assertCanAccess: over.canAccess ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as SubscriptionService;
  const notifications = {
    notifyTelegramChat: vi.fn().mockResolvedValue(undefined),
    ...over.notify,
  } as unknown as NotificationService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const db = {} as DbClient;
  const repo = {
    findByIdForUser: vi.fn(),
    findByJoinToken: vi.fn(),
    createContribution: vi.fn().mockResolvedValue({}),
    findContribution: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
    ...over.repo,
  } as unknown as EqubRepository;

  const service = new EqubService(db, repo, subscriptions, notifications, audit, { botUsername: 'BirrlyBot' });
  return { service, repo, notifications, subscriptions };
}

describe('EqubService', () => {
  it('rejects non-Premium users', async () => {
    const canAccess = vi.fn().mockRejectedValue(new Error('SUBSCRIPTION_REQUIRED'));
    const { service } = makeService({ canAccess });
    await expect(service.list('u1')).rejects.toThrow('SUBSCRIPTION_REQUIRED');
  });

  it('computes pot, rotation recipient, and join link in the DTO', async () => {
    const { service } = makeService({
      repo: { findByIdForUser: vi.fn().mockResolvedValue(equb({ currentCycle: 2 })) },
    });

    const dto = await service.getById('u1', 'equb-1');

    expect(dto.potAmount).toBe('3000.00'); // 1000 × 3 members
    expect(dto.totalCycles).toBe(3);
    expect(dto.joinLink).toBe('https://t.me/BirrlyBot?start=equb-tok123');
    // Cycle 2 → the member at payoutPosition 2 is the recipient.
    expect(dto.members.find((m) => m.isCurrentRecipient)?.name).toBe('Sara');
  });

  it('marks paidThisCycle only for members with a contribution in the current cycle', async () => {
    const withPaid = equb({
      currentCycle: 1,
      contributions: [{ id: 'c1', memberId: 'm1', cycle: 1 } as EqubWithMembers['contributions'][number]],
    });
    const { service } = makeService({ repo: { findByIdForUser: vi.fn().mockResolvedValue(withPaid) } });

    const dto = await service.getById('u1', 'equb-1');

    expect(dto.members.find((m) => m.id === 'm1')?.paidThisCycle).toBe(true);
    expect(dto.members.find((m) => m.id === 'm2')?.paidThisCycle).toBe(false);
  });

  it('advancing the final cycle completes the Equb', async () => {
    const update = vi.fn().mockResolvedValue({});
    const dbUpdate = vi.fn().mockResolvedValue({});
    const service = new EqubService(
      { equbMember: { update: dbUpdate } } as unknown as DbClient,
      {
        findByIdForUser: vi
          .fn()
          .mockResolvedValueOnce(equb({ currentCycle: 3 })) // 3 members, last cycle
          .mockResolvedValueOnce(equb({ currentCycle: 3, status: 'COMPLETED' })),
        update,
      } as unknown as EqubRepository,
      { assertCanAccess: vi.fn().mockResolvedValue(undefined) } as unknown as SubscriptionService,
      { notifyTelegramChat: vi.fn() } as unknown as NotificationService,
      { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      { botUsername: 'BirrlyBot' },
    );

    await service.advanceCycle('u1', 'equb-1');

    expect(update).toHaveBeenCalledWith('equb-1', expect.objectContaining({ status: 'COMPLETED', currentCycle: 3 }));
  });

  it('nudge DMs only linked members who have not yet paid this cycle', async () => {
    const linkedUnpaid = member({ id: 'm1', payoutPosition: 1, name: 'Abebe', telegramUserId: '111' });
    const linkedPaid = member({ id: 'm2', payoutPosition: 2, name: 'Sara', telegramUserId: '222' });
    const unlinked = member({ id: 'm3', payoutPosition: 3, name: 'Kebede' });
    const data = equb({
      currentCycle: 1,
      members: [linkedUnpaid, linkedPaid, unlinked],
      contributions: [{ id: 'c1', memberId: 'm2', cycle: 1 } as EqubWithMembers['contributions'][number]],
    });
    const notifyTelegramChat = vi.fn().mockResolvedValue(undefined);
    const { service } = makeService({
      repo: { findByIdForUser: vi.fn().mockResolvedValue(data) },
      notify: { notifyTelegramChat },
    });

    const result = await service.nudgeMembers('u1', 'equb-1');

    expect(notifyTelegramChat).toHaveBeenCalledOnce(); // only Abebe (linked + unpaid)
    expect(notifyTelegramChat).toHaveBeenCalledWith('111', expect.stringContaining('Office Equb'), expect.any(String));
    expect(result).toEqual({ notified: 1, skipped: 2 });
  });
});
