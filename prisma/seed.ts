/**
 * Production-safe. System categories & initial promo codes. Never creates users or money rows.
 * Demo people live in prisma/seed-demo.ts on the oat-env branch.
 */
import { PrismaClient } from '@prisma/client';
import { SYSTEM_CATEGORIES } from '../src/shared/constants/categories';

const prisma = new PrismaClient();

const DEFAULT_PROMO_CODES = [
  {
    code: 'BIRRLY-BETA',
    plan: 'PREMIUM_MONTHLY' as const,
    durationDays: 30,
    maxUses: 1000,
    note: 'Beta tester access - 30 days Premium',
  },
  {
    code: 'FOUNDER-2026',
    plan: 'PREMIUM_YEARLY' as const,
    durationDays: 365,
    maxUses: 100,
    note: 'Founder & early partner access - 1 year Premium',
  },
];

async function main() {
  for (const category of SYSTEM_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { slug: category.slug, userId: null, isSystem: true },
    });

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { name: category.name, kind: category.kind },
      });
      continue;
    }

    await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        kind: category.kind,
        isSystem: true,
        userId: null,
      },
    });
  }

  for (const promo of DEFAULT_PROMO_CODES) {
    await prisma.promoCode.upsert({
      where: { code: promo.code },
      update: {},
      create: {
        code: promo.code,
        plan: promo.plan,
        durationDays: promo.durationDays,
        maxUses: promo.maxUses,
        note: promo.note,
        active: true,
      },
    });
  }
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
