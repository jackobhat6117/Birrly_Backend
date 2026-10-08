import { NotFoundError, ERROR_CODE } from '@/shared/errors/app-error';
import type { AccountRepository } from '@/modules/accounts/account.repository';

export class AccountService {
  constructor(private readonly accounts: AccountRepository) {}

  async list(userId: string) {
    return this.accounts.listForUser(userId);
  }

  async getOwned(id: string, userId: string) {
    const account = await this.accounts.findByIdForUser(id, userId);
    if (!account) {
      throw new NotFoundError(ERROR_CODE.ACCOUNT_NOT_FOUND, 'Account was not found.');
    }
    return account;
  }

  async resolveForUser(userId: string, accountId?: string, currency = 'ETB') {
    if (accountId) {
      return this.getOwned(accountId, userId);
    }
    const preferred = await this.accounts.findDefaultForUser(userId);
    if (preferred) {
      return preferred;
    }
    // No account is flagged default (data drift, archived default, etc.). Fall
    // back to any usable account rather than failing the core logging path.
    const [firstAvailable] = await this.accounts.listForUser(userId);
    if (firstAvailable) {
      return firstAvailable;
    }

    // Users created before default accounts existed, or whose accounts were all
    // archived, still need a place to log. Create the standard set, then revive
    // an archived one if the names were already taken.
    await this.accounts.ensureDefaults(userId, currency);
    const created =
      (await this.accounts.findDefaultForUser(userId)) ??
      (await this.accounts.listForUser(userId))[0];
    if (created) {
      return created;
    }

    const archived = await this.accounts.findAnyForUser(userId);
    if (archived) {
      return this.accounts.unarchive(archived.id);
    }

    throw new NotFoundError(ERROR_CODE.ACCOUNT_NOT_FOUND, 'No account was found for this user.');
  }
}
