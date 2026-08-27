import { Prisma } from '@prisma/client';
import type { DbClient } from '@/database/prisma';
import { config } from '@/app/config';
import { DEFAULT_ACCOUNTS } from '@/shared/constants/categories';
import { NotFoundError } from '@/shared/errors/app-error';
import { ERROR_CODE } from '@/shared/errors/app-error';
import type { AuditService } from '@/modules/audit/audit.service';
import { toAuthenticatedUser, type UserRepository } from '@/modules/users/user.repository';
import type { AuthenticatedUser, TelegramIdentityInput, UpdateProfileInput } from '@/modules/users/user.types';

export class UserService {
  constructor(
    private readonly db: DbClient,
    private readonly users: UserRepository,
    private readonly audit: AuditService,
  ) {}

  async getById(id: string): Promise<AuthenticatedUser> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundError(ERROR_CODE.USER_NOT_FOUND, 'User was not found.');
    }
    return toAuthenticatedUser(user);
  }

  async ensureFromTelegram(identity: TelegramIdentityInput): Promise<AuthenticatedUser> {
    const existing = await this.users.findByTelegramId(identity.telegramId);
    if (existing) {
      return toAuthenticatedUser(existing);
    }

    try {
      const created = await this.db.$transaction(async (tx) => {
        const user = await this.users.create(tx, identity, config.defaults);
        await tx.account.createMany({
          data: DEFAULT_ACCOUNTS.map((account) => ({
            userId: user.id,
            name: account.name,
            type: account.type,
            currency: user.currency,
            isDefault: account.isDefault,
          })),
        });
        await tx.subscription.create({
          data: {
            userId: user.id,
            plan: 'FREE',
            status: 'ACTIVE',
          },
        });
        return user;
      });

      await this.audit.record({
        userId: created.id,
        action: 'USER_CREATED',
        entityType: 'user',
        entityId: created.id,
      });

      return toAuthenticatedUser(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.users.findByTelegramId(identity.telegramId);
        if (raced) {
          return toAuthenticatedUser(raced);
        }
      }
      throw error;
    }
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthenticatedUser> {
    const updated = await this.users.updateProfile(userId, input);
    return toAuthenticatedUser(updated);
  }
}
