import { prisma } from '@/database/prisma';
import { DEFAULT_ACCOUNTS } from '@/shared/constants/categories';

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, telegramId: true, currency: true },
  });
  for (const u of users) {
    const count = await prisma.account.count({ where: { userId: u.id } });
    if (count > 0) {
      console.log(`user ${u.telegramId}: has ${count} account(s), skipping`);
      continue;
    }
    await prisma.account.createMany({
      data: DEFAULT_ACCOUNTS.map((a) => ({
        userId: u.id,
        name: a.name,
        type: a.type,
        currency: u.currency,
        isDefault: a.isDefault,
      })),
    });
    console.log(`user ${u.telegramId}: created ${DEFAULT_ACCOUNTS.length} default accounts`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
