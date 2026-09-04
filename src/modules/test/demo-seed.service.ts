import type { PrismaClient } from '@prisma/client';
import { DEFAULT_ACCOUNTS } from '@/shared/constants/categories';

export const OAT_DEMO_USERS = [
  {
    telegramId: 'oat-900001',
    username: 'oat_amina',
    firstName: 'Amina',
    language: 'am',
    paydayDay: 25,
    monthlyIncome: '18000',
  },
  {
    telegramId: 'oat-900002',
    username: 'oat_dawit',
    firstName: 'Dawit',
    language: 'en',
    paydayDay: 28,
    monthlyIncome: '22000',
  },
] as const;

async function upsertDemoUser(
  db: PrismaClient,
  input: (typeof OAT_DEMO_USERS)[number],
) {
  const user = await db.user.upsert({
    where: { telegramId: input.telegramId },
    update: {
      telegramUsername: input.username,
      firstName: input.firstName,
      language: input.language,
      paydayDay: input.paydayDay,
      monthlyIncome: input.monthlyIncome,
      lastSeenAt: new Date(),
    },
    create: {
      telegramId: input.telegramId,
      telegramUsername: input.username,
      firstName: input.firstName,
      language: input.language,
      currency: 'ETB',
      timezone: 'Africa/Addis_Ababa',
      paydayDay: input.paydayDay,
      monthlyIncome: input.monthlyIncome,
      lastSeenAt: new Date(),
    },
  });

  await db.subscription.upsert({
    where: { userId: user.id },
    update: { plan: 'FREE', status: 'ACTIVE' },
    create: { userId: user.id, plan: 'FREE', status: 'ACTIVE' },
  });

  const existingAccounts = await db.account.count({ where: { userId: user.id } });
  if (existingAccounts === 0) {
    await db.account.createMany({
      data: DEFAULT_ACCOUNTS.map((account) => ({
        userId: user.id,
        name: account.name,
        type: account.type,
        currency: 'ETB',
        isDefault: account.isDefault,
      })),
    });
  }

  return user;
}

/** Loads OAT demo users and sample ledger rows into the connected database. */
export async function runDemoSeed(db: PrismaClient): Promise<void> {
  const food = await db.category.findFirst({ where: { slug: 'food', isSystem: true } });
  const transport = await db.category.findFirst({ where: { slug: 'transport', isSystem: true } });
  const salary = await db.category.findFirst({ where: { slug: 'salary', isSystem: true } });
  if (!food || !transport || !salary) {
    throw new Error('System categories missing. Run `npx prisma db seed` first.');
  }

  const amina = await upsertDemoUser(db, OAT_DEMO_USERS[0]);
  const dawit = await upsertDemoUser(db, OAT_DEMO_USERS[1]);
  const cash = await db.account.findFirst({ where: { userId: amina.id, isDefault: true } });
  if (!cash) {
    throw new Error('Demo cash account missing.');
  }

  const isoDate = new Date().toISOString().slice(0, 10);

  await db.transaction.deleteMany({
    where: { userId: { in: [amina.id, dawit.id] }, idempotencyKey: { startsWith: 'oat-demo-' } },
  });

  await db.transaction.createMany({
    data: [
      {
        userId: amina.id,
        accountId: cash.id,
        categoryId: salary.id,
        type: 'INCOME',
        amount: '18000',
        currency: 'ETB',
        description: 'OAT salary',
        transactionDate: new Date(isoDate),
        source: 'API',
        idempotencyKey: 'oat-demo-salary',
      },
      {
        userId: amina.id,
        accountId: cash.id,
        categoryId: food.id,
        type: 'EXPENSE',
        amount: '350',
        currency: 'ETB',
        description: 'OAT lunch',
        transactionDate: new Date(isoDate),
        source: 'API',
        idempotencyKey: 'oat-demo-lunch',
      },
      {
        userId: amina.id,
        accountId: cash.id,
        categoryId: transport.id,
        type: 'EXPENSE',
        amount: '80',
        currency: 'ETB',
        description: 'OAT taxi',
        transactionDate: new Date(isoDate),
        source: 'API',
        idempotencyKey: 'oat-demo-taxi',
      },
    ],
  });

  await db.productEvent.deleteMany({ where: { userId: { in: [amina.id, dawit.id] } } });
  await db.productEvent.createMany({
    data: [
      { userId: amina.id, name: 'SCREEN_VIEW', screen: 'home' },
      { userId: amina.id, name: 'FEATURE_USED', screen: 'add_transaction' },
      { userId: dawit.id, name: 'SCREEN_VIEW', screen: 'home' },
    ],
  });

  await db.auditLog.deleteMany({
    where: { userId: { in: [amina.id, dawit.id] }, action: 'TRANSACTION_CREATED' },
  });
  await db.auditLog.createMany({
    data: [
      { userId: amina.id, action: 'TRANSACTION_CREATED', entityType: 'transaction' },
      { userId: amina.id, action: 'TRANSACTION_CREATED', entityType: 'transaction' },
    ],
  });
}
