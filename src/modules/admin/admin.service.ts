import { DateTime } from 'luxon';
import type { Prisma } from '@prisma/client';
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

export class AdminService {
  constructor(private readonly db: DbClient) {}

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
    ] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.db.user.count({ where: { lastSeenAt: { gte: startOfToday } } }),
      this.db.user.count({ where: { lastSeenAt: { gte: sevenDaysAgo } } }),
      this.db.subscription.count({
        where: { status: 'ACTIVE', plan: { not: 'FREE' } },
      }),
      this.db.auditLog.count({
        where: { action: 'TRANSACTION_CREATED', createdAt: { gte: sevenDaysAgo } },
      }),
      this.db.auditLog.count({ where: { action: 'TRANSACTION_CREATED' } }),
      this.db.aiInteraction.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
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
        .then((rows) => rows.length),
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
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { telegramUsername: { contains: search, mode: 'insensitive' } },
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
          subscription: { select: { plan: true, status: true } },
        },
      }),
    ]);

    return {
      data: rows.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        telegramUsername: user.telegramUsername,
        language: user.language,
        plan: effectivePlan(user.subscription?.plan, user.subscription?.status),
        createdAt: user.createdAt.toISOString(),
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
        hasPayday: user.paydayDay != null,
        hasIncome: user.monthlyIncome != null,
      })),
      meta: paginationMeta(total, page, pageSize),
    };
  }

  async listFeedback(query: {
    q?: string;
    category?: 'BUG' | 'IDEA' | 'OTHER';
    source?: 'APP' | 'BOT';
    page?: number;
    pageSize?: number;
  }) {
    const { skip, take, page, pageSize } = normalizePagination(query);
    const search = query.q?.trim();
    const where: Prisma.FeedbackWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(search
        ? {
            OR: [
              { message: { contains: search, mode: 'insensitive' } },
              { pageContext: { contains: search, mode: 'insensitive' } },
              { user: { firstName: { contains: search, mode: 'insensitive' } } },
              { user: { lastName: { contains: search, mode: 'insensitive' } } },
              { user: { telegramUsername: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.db.feedback.count({ where }),
      this.db.feedback.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          category: true,
          message: true,
          source: true,
          pageContext: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              telegramUsername: true,
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        category: row.category,
        message: row.message,
        source: row.source,
        pageContext: row.pageContext,
        createdAt: row.createdAt.toISOString(),
        user: {
          id: row.user.id,
          firstName: row.user.firstName,
          lastName: row.user.lastName,
          telegramUsername: row.user.telegramUsername,
        },
      })),
      meta: paginationMeta(total, page, pageSize),
    };
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
        subscription: { select: { plan: true, status: true } },
      },
    });

    if (!user) {
      throw new NotFoundError(ERROR_CODE.USER_NOT_FOUND, 'User was not found.');
    }

    const [events, actions] = await Promise.all([
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
        select: { id: true, action: true, entityType: true, createdAt: true },
      }),
    ]);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      telegramUsername: user.telegramUsername,
      language: user.language,
      plan: effectivePlan(user.subscription?.plan, user.subscription?.status),
      createdAt: user.createdAt.toISOString(),
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      hasPayday: user.paydayDay != null,
      hasIncome: user.monthlyIncome != null,
      events: events.map((event) => ({
        id: event.id,
        name: event.name,
        screen: event.screen,
        createdAt: event.createdAt.toISOString(),
      })),
      actions: actions.map((action) => ({
        id: action.id,
        action: action.action,
        entityType: action.entityType,
        createdAt: action.createdAt.toISOString(),
      })),
    };
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
