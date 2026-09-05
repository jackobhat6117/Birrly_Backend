import type { DbClient } from '@/database/prisma';
import type { AuditService } from '@/modules/audit/audit.service';
import { toDebtDto, type DebtRepository } from '@/modules/debts/debt.repository';
import type { CreateDebtInput, CreateDebtPaymentInput, DebtDto } from '@/modules/debts/debt.types';
import { AppError, ERROR_CODE, NotFoundError } from '@/shared/errors/app-error';
import { FEATURE } from '@/shared/constants/features';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import { assertPositiveMoney, formatMoney, subtractMoney, toMoney } from '@/shared/utils/money';
import { parseDateInput } from '@/shared/utils/dates';

export class DebtService {
  constructor(
    private readonly db: DbClient,
    private readonly debts: DebtRepository,
    private readonly subscriptions: SubscriptionService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, currency: string, timezone: string, input: CreateDebtInput): Promise<DebtDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.DEBT_TRACKING);
    const amount = assertPositiveMoney(input.amount);

    const created = await this.debts.create({
      user: { connect: { id: userId } },
      personName: input.personName.trim(),
      type: input.type,
      originalAmount: amount,
      remainingAmount: amount,
      currency: input.currency ?? currency,
      dueDate: input.dueDate ? parseDateInput(input.dueDate, timezone) : undefined,
      note: input.note,
      status: 'OPEN',
    });

    await this.audit.record({
      userId,
      action: 'DEBT_CREATED',
      entityType: 'debt',
      entityId: created.id,
      metadata: {
        type: created.type,
        amount: formatMoney(amount),
        currency: created.currency,
      },
    });

    return toDebtDto(created);
  }

  async list(userId: string): Promise<DebtDto[]> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.DEBT_TRACKING);
    const rows = await this.debts.listForUser(userId);
    return rows.map(toDebtDto);
  }

  async getById(userId: string, id: string): Promise<DebtDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.DEBT_TRACKING);
    const row = await this.debts.findByIdForUser(id, userId);
    if (!row) {
      throw new NotFoundError(ERROR_CODE.DEBT_NOT_FOUND, 'Debt was not found.');
    }
    return toDebtDto(row);
  }

  async recordPayment(userId: string, debtId: string, input: CreateDebtPaymentInput) {
    await this.subscriptions.assertCanAccess(userId, FEATURE.DEBT_TRACKING);
    const amount = assertPositiveMoney(input.amount);

    const result = await this.db.$transaction(async (tx) => {
      const debt = await this.debts.findByIdForUser(debtId, userId, tx);
      if (!debt) {
        throw new NotFoundError(ERROR_CODE.DEBT_NOT_FOUND, 'Debt was not found.');
      }
      if (debt.status === 'SETTLED') {
        throw new AppError(ERROR_CODE.INVALID_AMOUNT, 'This debt is already settled.', 400);
      }

      const remaining = toMoney(debt.remainingAmount.toString());
      if (amount.gt(remaining)) {
        throw new AppError(ERROR_CODE.INVALID_AMOUNT, 'Payment exceeds the remaining debt amount.', 400);
      }

      const nextRemaining = subtractMoney(remaining, amount);
      const status = nextRemaining.lte(0) ? 'SETTLED' : 'PARTIALLY_PAID';

      const updated = await this.debts.update(tx, debt.id, {
        remainingAmount: nextRemaining,
        status,
      });

      const payment = await this.debts.createPayment(tx, {
        userId,
        debtId: debt.id,
        amount: formatMoney(amount),
        currency: debt.currency,
        note: input.note,
      });

      return { debt: updated, payment };
    });

    await this.audit.record({
      userId,
      action: 'DEBT_PAYMENT_CREATED',
      entityType: 'debt',
      entityId: result.debt.id,
      metadata: {
        paymentId: result.payment.id,
        amount: formatMoney(amount),
        currency: result.debt.currency,
      },
    });

    return {
      debt: toDebtDto(result.debt),
      payment: {
        id: result.payment.id,
        amount: formatMoney(result.payment.amount.toString()),
        currency: result.payment.currency,
        paidAt: result.payment.paidAt.toISOString(),
      },
    };
  }

  async listPayments(userId: string, debtId: string) {
    await this.getById(userId, debtId);
    const rows = await this.debts.listPayments(userId, debtId);
    return rows.map((row) => ({
      id: row.id,
      amount: formatMoney(row.amount.toString()),
      currency: row.currency,
      note: row.note,
      paidAt: row.paidAt.toISOString(),
    }));
  }

  /**
   * Records that the user opened Telegram's share sheet to nudge someone about
   * this debt. There is no captured Telegram identity for the other side of an
   * IOU, so this cannot confirm delivery — it only timestamps the attempt, so
   * the Mini App can show "Nudged 2 days ago" instead of leaving the user to
   * guess whether they already asked.
   */
  async recordNudge(userId: string, debtId: string): Promise<DebtDto> {
    await this.subscriptions.assertCanAccess(userId, FEATURE.DEBT_TRACKING);
    const debt = await this.debts.findByIdForUser(debtId, userId);
    if (!debt) {
      throw new NotFoundError(ERROR_CODE.DEBT_NOT_FOUND, 'Debt was not found.');
    }
    if (debt.status === 'SETTLED') {
      throw new AppError(ERROR_CODE.VALIDATION_FAILED, 'This debt is already settled.', 400);
    }
    const updated = await this.debts.recordNudge(debtId);
    return toDebtDto(updated);
  }
}
