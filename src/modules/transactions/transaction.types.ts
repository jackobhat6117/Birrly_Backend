import type { TransactionSource, TransactionType } from '@prisma/client';

export type CreateTransactionInput = {
  type: TransactionType;
  amount: string;
  currency?: string;
  accountId?: string;
  categoryId?: string;
  categorySlug?: string;
  description?: string;
  transactionDate?: string;
  source?: TransactionSource;
  idempotencyKey?: string;
};

export type UpdateTransactionInput = {
  amount?: string;
  accountId?: string;
  categoryId?: string;
  description?: string | null;
  transactionDate?: string;
};

export type ListTransactionsQuery = {
  page: number;
  pageSize: number;
  type?: TransactionType;
  categoryId?: string;
  from?: string;
  to?: string;
};

export type TransactionDto = {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: string;
  currency: string;
  description: string | null;
  transactionDate: string;
  source: TransactionSource;
  createdAt: string;
};
