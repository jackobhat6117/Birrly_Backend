/**
 * OAT / QA only. Creates fake Telegram users and sample ledger rows.
 * Never run on production main.
 *
 *   ALLOW_DEMO_SEED=true npx tsx prisma/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_ACCOUNTS } from '../src/shared/constants/categories';

const prisma = new PrismaClient();

if (process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error('Refusing demo seed. Set ALLOW_DEMO_SEED=true on the oat-env server only.');
  process.exit(1);
}

async function upsertDemoUser(input: {
  telegramId: string;
  username: string;
  firstName: string;
  language: string;
  paydayDay: number;
  monthlyIncome: string;
}) {
  const user = await prisma.user.upsert({
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

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: { plan: 'FREE', status: 'ACTIVE' },
    create: { userId: user.id, plan: 'FREE', status: 'ACTIVE' },
  });

  const existingAccounts = await prisma.account.count({ where: { userId: user.id } });
  if (existingAccounts === 0) {
    await prisma.account.createMany({
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

async function main() {
  const food = await prisma.category.findFirst({ where: { slug: 'food', isSystem: true } });
  const transport = await prisma.category.findFirst({ where: { slug: 'transport', isSystem: true } });
  const salary = await prisma.category.findFirst({ where: { slug: 'salary', isSystem: true } });
  if (!food || !transport || !salary) {
    throw new Error('Run `npx prisma db seed` first so system categories exist.');
  }

  const amina = await upsertDemoUser({
    telegramId: 'oat-900001',
    username: 'oat_amina',
    firstName: 'Amina',
    language: 'am',
    paydayDay: 25,
    monthlyIncome: '18000',
  });
  const dawit = await upsertDemoUser({
    telegramId: 'oat-900002',
    username: 'oat_dawit',
    firstName: 'Dawit',
    language: 'en',
    paydayDay: 28,
    monthlyIncome: '22000',
  });

  const cash = await prisma.account.findFirst({ where: { userId: amina.id, isDefault: true } });
  if (!cash) {
    throw new Error('Demo cash account missing.');
  }

  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);

  await prisma.transaction.deleteMany({
    where: { userId: { in: [amina.id, dawit.id] }, idempotencyKey: { startsWith: 'oat-demo-' } },
  });

  await prisma.transaction.createMany({
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

  await prisma.productEvent.deleteMany({ where: { userId: { in: [amina.id, dawit.id] } } });
  await prisma.productEvent.createMany({
    data: [
      { userId: amina.id, name: 'SCREEN_VIEW', screen: 'home' },
      { userId: amina.id, name: 'FEATURE_USED', screen: 'add_transaction' },
      { userId: dawit.id, name: 'SCREEN_VIEW', screen: 'home' },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { userId: amina.id, action: 'TRANSACTION_CREATED', entityType: 'transaction' },
      { userId: amina.id, action: 'TRANSACTION_CREATED', entityType: 'transaction' },
    ],
  });

  console.log('OAT demo users ready: @oat_amina, @oat_dawit');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
