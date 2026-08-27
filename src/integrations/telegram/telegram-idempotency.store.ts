import type { DbClient } from '@/database/prisma';

export class TelegramIdempotencyStore {
  constructor(private readonly db: DbClient) {}

  async claim(updateId: number): Promise<boolean> {
    try {
      await this.db.telegramProcessedUpdate.create({
        data: { updateId: BigInt(updateId) },
      });
      return true;
    } catch {
      return false;
    }
  }
}
