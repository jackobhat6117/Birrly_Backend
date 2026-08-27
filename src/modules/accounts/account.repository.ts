import type { Account } from '@prisma/client';
import type { DbClient } from '@/database/prisma';

export class AccountRepository {
  constructor(private readonly db: DbClient) {}

  async listForUser(userId: string): Promise<Account[]> {
    return this.db.account.findMany({
      where: { userId, isArchived: false },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findByIdForUser(id: string, userId: string): Promise<Account | null> {
    return this.db.account.findFirst({
      where: { id, userId, isArchived: false },
    });
  }

  async findDefaultForUser(userId: string): Promise<Account | null> {
    return this.db.account.findFirst({
      where: { userId, isDefault: true, isArchived: false },
    });
  }
}
