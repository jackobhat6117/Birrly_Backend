import type { Prisma, User } from '@prisma/client';
import type { DbClient, DbTransaction } from '@/database/prisma';
import { formatMoney } from '@/shared/utils/money';
import type { AuthenticatedUser, TelegramIdentityInput, UpdateProfileInput } from '@/modules/users/user.types';

type Client = DbClient | DbTransaction;

export class UserRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { telegramId } });
  }

  async create(client: Client, input: TelegramIdentityInput, defaults: { language: string; currency: string; timezone: string }): Promise<User> {
    return client.user.create({
      data: {
        telegramId: input.telegramId,
        telegramUsername: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        language: input.languageCode === 'am' ? 'am' : defaults.language,
        currency: defaults.currency,
        timezone: defaults.timezone,
      },
    });
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<User> {
    const data: Prisma.UserUpdateInput = {};
    if (input.language !== undefined) data.language = input.language;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.monthlyIncome !== undefined) {
      data.monthlyIncome = input.monthlyIncome;
    }
    if (input.paydayDay !== undefined) {
      data.paydayDay = input.paydayDay;
    }
    if (input.monthlySpendPlan !== undefined) {
      data.monthlySpendPlan = input.monthlySpendPlan;
    }
    return this.db.user.update({ where: { id }, data });
  }
}

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    telegramId: user.telegramId,
    telegramUsername: user.telegramUsername,
    firstName: user.firstName,
    lastName: user.lastName,
    language: user.language,
    currency: user.currency,
    timezone: user.timezone,
    monthlyIncome: user.monthlyIncome ? formatMoney(user.monthlyIncome.toString()) : null,
    paydayDay: user.paydayDay,
    monthlySpendPlan: user.monthlySpendPlan ? formatMoney(user.monthlySpendPlan.toString()) : null,
  };
}
