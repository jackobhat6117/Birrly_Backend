import type { DebtStatus, DebtType } from '@prisma/client';

export type CreateDebtInput = {
  personName: string;
  personTelegramUsername?: string;
  type: DebtType;
  amount: string;
  currency?: string;
  dueDate?: string;
  note?: string;
};

export type CreateDebtPaymentInput = {
  amount: string;
  note?: string;
};

export type DebtDto = {
  id: string;
  personName: string;
  personTelegramUsername: string | null;
  type: DebtType;
  originalAmount: string;
  remainingAmount: string;
  currency: string;
  dueDate: string | null;
  note: string | null;
  status: DebtStatus;
  lastNudgedAt: string | null;
  createdAt: string;
};
