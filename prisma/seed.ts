/**
 * Production-safe. System categories only. Never creates users or money rows.
 * Demo people live in prisma/seed-demo.ts on the oat-env branch.
 */
import { PrismaClient } from '@prisma/client';
import { SYSTEM_CATEGORIES } from '../src/shared/constants/categories';

const prisma = new PrismaClient();

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
