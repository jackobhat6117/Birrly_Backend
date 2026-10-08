import type { Account } from '@prisma/client';
import type { DbClient } from '@/database/prisma';
import { DEFAULT_ACCOUNTS } from '@/shared/constants/categories';

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

  /** Creates Cash/Bank/Telebirr/… when a user has none. Names already present are skipped. */
  async ensureDefaults(userId: string, currency: string): Promise<void> {
    await this.db.account.createMany({
      data: DEFAULT_ACCOUNTS.map((account) => ({
        userId,
        name: account.name,
        type: account.type,
        currency,
        isDefault: account.isDefault,
      })),
      skipDuplicates: true,
    });
  }

  async unarchive(id: string): Promise<Account> {
    return this.db.account.update({
      where: { id },
      data: { isArchived: false, isDefault: true },
    });
  }

  async findAnyForUser(userId: string): Promise<Account | null> {
    return this.db.account.findFirst({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }
}
