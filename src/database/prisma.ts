import { PrismaClient } from '@prisma/client';
import { env } from '@/app/env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type DbClient = PrismaClient;
export type DbTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
