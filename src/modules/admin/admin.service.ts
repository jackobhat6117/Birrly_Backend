import { DateTime } from 'luxon';
import { config } from '@/app/config';
import type { DbClient } from '@/database/prisma';
import { DEFAULT_TIMEZONE } from '@/shared/constants/app';
import { NotFoundError, UnauthorizedError } from '@/shared/errors/app-error';
import { ERROR_CODE } from '@/shared/errors/app-error';
import { logger } from '@/shared/logger/logger';
import { normalizePagination, paginationMeta } from '@/shared/utils/pagination';
import {
  hashPassword,
  signAdminToken,
  verifyPassword,
} from '@/modules/admin/admin.auth';
import { effectivePlan, funnelSteps } from '@/modules/admin/admin.funnel';
import type { FeedbackRepository } from '@/modules/feedback/feedback.repository';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import type { SubscriptionPlan, UpgradeRequestStatus } from '@/modules/subscriptions/subscription.types';

export class AdminService {
  constructor(
    private readonly db: DbClient,
    private readonly feedbackRepository: FeedbackRepository,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async bootstrap(): Promise<void> {
    const email = config.admin.bootstrapEmail;
    const password = config.admin.bootstrapPassword;
    if (!email || !password) return;

    const passwordHash = await hashPassword(password);
    await this.db.adminUser.upsert({
      where: { email },
      create: { email, passwordHash },
      update: { passwordHash },
    });
    logger.info({ email }, 'Admin operator bootstrapped');
  }

  async login(email: string, password: string) {
    const admin = await this.db.adminUser.findUnique({ where: { email } });
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      throw new UnauthorizedError('Invalid credentials.');
    }

    const signed = signAdminToken(
      { sub: admin.id, email: admin.email },
      config.admin.jwtSecret,
      config.admin.jwtExpiresSec,
    );

    return {
      token: signed.token,
      expiresAt: signed.expiresAt,
      admin: { id: admin.id, email: admin.email },
    };
  }

  async overview() {
    const now = DateTime.now().setZone(DEFAULT_TIMEZONE);
    const startOfToday = now.startOf('day').toUTC().toJSDate();
    const sevenDaysAgo = now.minus({ days: 7 }).toUTC().toJSDate();

    const [
      totalUsers,
      newUsers7d,
      dau,
      wau,
      premiumUsers,
      transactions7d,
      transactionsAll,
      aiRequests7d,
      pendingUpgrades,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.db.user.count({ where: { lastSeenAt: { gte: startOfToday } } }),
      this.db.user.count({ where: { lastSeenAt: { gte: sevenDaysAgo } } }),
      this.db.subscription.count({
        where: {
          status: 'ACTIVE',
          plan: { not: 'FREE' },
          // Exclude lapsed periods so the count matches `getAccess`/effectivePlan.
          OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now.toJSDate() } }],
        },
      }),
      this.db.auditLog.count({
        where: { action: 'TRANSACTION_CREATED', createdAt: { gte: sevenDaysAgo } },
      }),
      this.db.auditLog.count({ where: { action: 'TRANSACTION_CREATED' } }),
      this.db.aiInteraction.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.db.subscriptionUpgradeRequest.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      users: {
        total: totalUsers,
        new7d: newUsers7d,
        dau,
        wau,
        premium: premiumUsers,
        free: Math.max(0, totalUsers - premiumUsers),
      },
      activity: {
        transactions7d,
        transactionsAll,
        aiRequests7d,
      },
      upgrades: {
        pending: pendingUpgrades,
      },
    };
  }

  async activity() {
    const since = DateTime.now().setZone(DEFAULT_TIMEZONE).minus({ days: 14 }).startOf('day').toUTC().toJSDate();

    const [events, audits] = await Promise.all([
      this.db.productEvent.findMany({
        where: { createdAt: { gte: since } },
        select: { name: true, screen: true, createdAt: true },
      }),
      this.db.auditLog.findMany({
        where: { createdAt: { gte: since } },
        select: { action: true, createdAt: true },
      }),
    ]);

    const byDay = new Map<string, number>();
    const byName = new Map<string, number>();
    const byScreen = new Map<string, number>();
    const byAudit = new Map<string, number>();

    for (const event of events) {
      const day = event.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      byName.set(event.name, (byName.get(event.name) ?? 0) + 1);
      if (event.screen) {
        byScreen.set(event.screen, (byScreen.get(event.screen) ?? 0) + 1);
      }
    }

    for (const audit of audits) {
      byAudit.set(audit.action, (byAudit.get(audit.action) ?? 0) + 1);
    }

    return {
      since: since.toISOString(),
      volume: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, count]) => ({ day, count })),
      topEvents: rank(byName),
      topScreens: rank(byScreen),
      topMutations: rank(byAudit),
    };
  }

  async funnel() {
    const [
      registered,
      openedApp,
      firstTransaction,
      paydaySet,
      incomeSet,
      planningUsed,
      subscriptionViewed,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({ where: { lastSeenAt: { not: null } } }),
      distinctUsers(this.db, 'TRANSACTION_CREATED'),
      this.db.user.count({ where: { paydayDay: { not: null } } }),
      this.db.user.count({ where: { monthlyIncome: { not: null } } }),
      distinctUsers(this.db, ['BUDGET_CREATED', 'SAVINGS_GOAL_CREATED']),
      this.db.productEvent
        .groupBy({
          by: ['userId'],
          where: { name: 'SCREEN_VIEW', screen: 'subscription' },
        })
        .then((rows: Array<{ userId: string }>) => rows.length),
    ]);

    return {
      steps: funnelSteps([
        { id: 'registered', label: 'Registered', count: registered },
        { id: 'openedApp', label: 'Opened Mini App', count: openedApp },
        { id: 'firstTransaction', label: 'First transaction', count: firstTransaction },
        { id: 'paydaySet', label: 'Payday set', count: paydaySet },
        { id: 'incomeSet', label: 'Typical income set', count: incomeSet },
        { id: 'planningUsed', label: 'Savings or budget used', count: planningUsed },
        { id: 'subscriptionViewed', label: 'Viewed subscription', count: subscriptionViewed },
      ]),
    };
  }

  async listUsers(query: { q?: string; page?: number; pageSize?: number }) {
    const { skip, take, page, pageSize } = normalizePagination(query);
    const search = query.q?.trim();
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { telegramUsername: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          telegramUsername: true,
          language: true,
          createdAt: true,
          lastSeenAt: true,
          paydayDay: true,
          monthlyIncome: true,
          subscription: { select: { plan: true, status: true, source: true, currentPeriodEnd: true } },
        },
      }),
    ]);

    return {
      data: rows.map(
        (user: {
          id: string;
          firstName: string | null;
          lastName: string | null;
          telegramUsername: string | null;
          language: string;
          createdAt: Date;
          lastSeenAt: Date | null;
          paydayDay: number | null;
          monthlyIncome: unknown;
          subscription: {
            plan: string;
            status: string;
            source: string | null;
            currentPeriodEnd: Date | null;
          } | null;
        }) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        telegramUsername: user.telegramUsername,
        language: user.language,
        plan: effectivePlan(
          user.subscription?.plan,
          user.subscription?.status,
          user.subscription?.currentPeriodEnd,
        ),
        subscriptionSource: user.subscription?.source ?? null,
        currentPeriodEnd: user.subscription?.currentPeriodEnd?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
        hasPayday: user.paydayDay != null,
        hasIncome: user.monthlyIncome != null,
      }),
      ),
      meta: paginationMeta(total, page, pageSize),
    };
  }

  listFeedback(query: Parameters<FeedbackRepository['listForAdmin']>[0]) {
    return this.feedbackRepository.listForAdmin(query);
  }

  async getUser(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        telegramUsername: true,
        language: true,
        createdAt: true,
        lastSeenAt: true,
        paydayDay: true,
        monthlyIncome: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            source: true,
            currentPeriodEnd: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError(ERROR_CODE.USER_NOT_FOUND, 'User was not found.');
    }

    const [events, actions, upgradeRequests, access] = await Promise.all([
      this.db.productEvent.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, name: true, screen: true, createdAt: true },
      }),
      this.db.auditLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, action: true, entityType: true, createdAt: true, metadata: true },
      }),
      this.db.subscriptionUpgradeRequest.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.subscriptionService.getAccess(id),
    ]);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      telegramUsername: user.telegramUsername,
      language: user.language,
      plan: access.effectivePlan,
      storedPlan: access.storedPlan,
      subscriptionStatus: access.status,
      subscriptionSource: access.source,
      currentPeriodEnd: access.currentPeriodEnd,
      isTrial: access.isTrial,
      daysRemaining: access.daysRemaining,
      createdAt: user.createdAt.toISOString(),
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      hasPayday: user.paydayDay != null,
      hasIncome: user.monthlyIncome != null,
      upgradeRequests: upgradeRequests.map(
        (r: {
          id: string;
          referenceCode: string;
          plan: string;
          amount: { toFixed: (digits: number) => string };
          currency: string;
          status: string;
          adminNote: string | null;
          reviewedAt: Date | null;
          createdAt: Date;
        }) => ({
        id: r.id,
        referenceCode: r.referenceCode,
        plan: r.plan,
        amount: r.amount.toFixed(2),
        currency: r.currency,
        status: r.status,
        adminNote: r.adminNote,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      }),
      ),
      events: events.map(
        (event: { id: string; name: string; screen: string | null; createdAt: Date }) => ({
        id: event.id,
        name: event.name,
        screen: event.screen,
        createdAt: event.createdAt.toISOString(),
      }),
      ),
      actions: actions.map(
        (action: {
          id: string;
          action: string;
          entityType: string;
          createdAt: Date;
          metadata: unknown;
        }) => ({
        id: action.id,
        action: action.action,
        entityType: action.entityType,
        createdAt: action.createdAt.toISOString(),
        metadata: action.metadata,
      }),
      ),
    };
  }

  grantSubscription(
    userId: string,
    data: { plan: SubscriptionPlan; months?: number; note?: string },
    adminId?: string,
  ) {
    return this.subscriptionService.grantSubscription(userId, {
      ...data,
      adminId,
    });
  }

  revokeSubscription(userId: string, data?: { note?: string }, adminId?: string) {
    return this.subscriptionService.revokeSubscription(userId, adminId, data?.note);
  }

  listUpgradeRequests(query: {
    status?: UpgradeRequestStatus;
    page?: number;
    pageSize?: number;
    userId?: string;
  }) {
    return this.subscriptionService.listUpgradeRequests(query);
  }

  reviewUpgradeRequest(
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    note?: string,
    adminId?: string,
  ) {
    return this.subscriptionService.reviewUpgradeRequest(requestId, status, note, adminId);
  }

  listPromoCodes() {
    return this.subscriptionService.listPromoCodes();
  }

  createPromoCode(data: {
    code: string;
    plan?: SubscriptionPlan;
    durationDays: number;
    maxUses?: number;
    expiresAt?: Date;
    note?: string;
  }) {
    return this.subscriptionService.createPromoCode(data);
  }
}

async function distinctUsers(db: DbClient, action: string | string[]): Promise<number> {
  const rows = await db.auditLog.groupBy({
    by: ['userId'],
    where: {
      userId: { not: null },
      action: Array.isArray(action) ? { in: action } : action,
    },
  });
  return rows.length;
}

function rank(map: Map<string, number>): Array<{ name: string; count: number }> {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}
