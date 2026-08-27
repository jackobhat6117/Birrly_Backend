import { Prisma } from '@prisma/client';
import type { AccountService } from '@/modules/accounts/account.service';
import type { AuditService } from '@/modules/audit/audit.service';
import type { CategoryService } from '@/modules/categories/category.service';
import { toTransactionDto, type TransactionRepository } from '@/modules/transactions/transaction.repository';
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  TransactionDto,
  UpdateTransactionInput,
} from '@/modules/transactions/transaction.types';
import { NotFoundError, ERROR_CODE } from '@/shared/errors/app-error';
import { assertPositiveMoney, formatMoney } from '@/shared/utils/money';
import { paginationMeta } from '@/shared/utils/pagination';
import { parseDateInput } from '@/shared/utils/dates';

export class TransactionService {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly accounts: AccountService,
    private readonly categories: CategoryService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, currency: string, timezone: string, input: CreateTransactionInput): Promise<TransactionDto> {
    const amount = assertPositiveMoney(input.amount);

    if (input.idempotencyKey) {
      const existing = await this.transactions.findByIdempotencyKey(userId, input.idempotencyKey);
      if (existing) {
        return toTransactionDto(existing);
      }
    }

    const account = await this.accounts.resolveForUser(userId, input.accountId);
    const category = await this.categories.resolve(
      userId,
      { categoryId: input.categoryId, categorySlug: input.categorySlug },
      input.type,
    );

    const transactionDate = input.transactionDate
      ? parseDateInput(input.transactionDate, timezone)
      : parseDateInput('today', timezone);

    try {
      const created = await this.transactions.create({
        user: { connect: { id: userId } },
        account: { connect: { id: account.id } },
        category: { connect: { id: category.id } },
        type: input.type,
        amount,
        currency: input.currency ?? currency,
        description: input.description,
        transactionDate,
        source: input.source ?? 'API',
        idempotencyKey: input.idempotencyKey,
      });

      await this.audit.record({
        userId,
        action: 'TRANSACTION_CREATED',
        entityType: 'transaction',
        entityId: created.id,
        metadata: {
          type: created.type,
          amount: formatMoney(amount),
          currency: created.currency,
        },
      });

      return toTransactionDto(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && input.idempotencyKey) {
        const existing = await this.transactions.findByIdempotencyKey(userId, input.idempotencyKey);
        if (existing) {
          return toTransactionDto(existing);
        }
      }
      throw error;
    }
  }

  async list(userId: string, query: ListTransactionsQuery) {
    const { rows, total } = await this.transactions.listForUser(userId, query);
    return {
      data: rows.map(toTransactionDto),
      meta: paginationMeta(total, query.page, query.pageSize),
    };
  }

  async getById(userId: string, id: string): Promise<TransactionDto> {
    const row = await this.transactions.findByIdForUser(id, userId);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.TRANSACTION_NOT_FOUND, 'Transaction was not found.');
    }
    return toTransactionDto(row);
  }

  async update(userId: string, id: string, timezone: string, input: UpdateTransactionInput): Promise<TransactionDto> {
    const existing = await this.transactions.findByIdForUser(id, userId);
    if (!existing) {
      throw new NotFoundError(ERROR_CODE.TRANSACTION_NOT_FOUND, 'Transaction was not found.');
    }

    if (input.accountId) {
      await this.accounts.getOwned(input.accountId, userId);
    }
    if (input.categoryId) {
      await this.categories.resolve(userId, { categoryId: input.categoryId }, existing.type);
    }

    const updated = await this.transactions.update(existing.id, {
      ...(input.amount ? { amount: assertPositiveMoney(input.amount) } : {}),
      ...(input.accountId ? { account: { connect: { id: input.accountId } } } : {}),
      ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.transactionDate
        ? { transactionDate: parseDateInput(input.transactionDate, timezone) }
        : {}),
    });

    await this.audit.record({
      userId,
      action: 'TRANSACTION_UPDATED',
      entityType: 'transaction',
      entityId: updated.id,
    });

    return toTransactionDto(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.transactions.findByIdForUser(id, userId);
    if (!existing) {
      throw new NotFoundError(ERROR_CODE.TRANSACTION_NOT_FOUND, 'Transaction was not found.');
    }

    await this.transactions.softDelete(existing.id);
    await this.audit.record({
      userId,
      action: 'TRANSACTION_DELETED',
      entityType: 'transaction',
      entityId: existing.id,
    });
  }
}
