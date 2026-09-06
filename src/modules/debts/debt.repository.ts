import type { Debt, Prisma } from '@prisma/client';
import type { DbClient, DbTransaction } from '@/database/prisma';
import { formatMoney } from '@/shared/utils/money';
import type { DebtDto } from '@/modules/debts/debt.types';

type Client = DbClient | DbTransaction;

export class DebtRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: Prisma.DebtCreateInput): Promise<Debt> {
    return this.db.debt.create({ data });
  }

  async findByIdForUser(id: string, userId: string, client: Client = this.db): Promise<Debt | null> {
    return client.debt.findFirst({
      where: { id, userId },
    });
  }

  async listForUser(userId: string): Promise<Debt[]> {
    return this.db.debt.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async update(client: Client, id: string, data: Prisma.DebtUpdateInput): Promise<Debt> {
    return client.debt.update({ where: { id }, data });
  }

  async createPayment(
    client: Client,
    data: {
      userId: string;
      debtId: string;
      amount: string;
      currency: string;
      note?: string;
    },
  ) {
    return client.debtPayment.create({
      data: {
        userId: data.userId,
        debtId: data.debtId,
        amount: data.amount,
        currency: data.currency,
        note: data.note,
      },
    });
  }

  async listPayments(userId: string, debtId: string) {
    return this.db.debtPayment.findMany({
      where: { userId, debtId },
      orderBy: { paidAt: 'desc' },
    });
  }

  async recordNudge(id: string): Promise<Debt> {
    return this.db.debt.update({ where: { id }, data: { lastNudgedAt: new Date() } });
  }
}

export function toDebtDto(row: Debt): DebtDto {
  return {
    id: row.id,
    personName: row.personName,
    personTelegramUsername: row.personTelegramUsername ?? null,
    type: row.type,
    originalAmount: formatMoney(row.originalAmount.toString()),
    remainingAmount: formatMoney(row.remainingAmount.toString()),
    currency: row.currency,
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    note: row.note,
    status: row.status,
    lastNudgedAt: row.lastNudgedAt ? row.lastNudgedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
