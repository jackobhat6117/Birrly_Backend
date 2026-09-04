/**
 * OAT / QA only. Creates fake Telegram users and sample ledger rows.
 * Never run on production main.
 *
 *   ALLOW_DEMO_SEED=true npm run prisma:seed:demo
 */
import { PrismaClient } from '@prisma/client';
import { runDemoSeed } from '../src/modules/test/demo-seed.service';

const prisma = new PrismaClient();

if (process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error('Refusing demo seed. Set ALLOW_DEMO_SEED=true on the oat-env server only.');
  process.exit(1);
}

runDemoSeed(prisma)
  .then(async () => {
    console.log('OAT demo users ready: @oat_amina, @oat_dawit');
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
