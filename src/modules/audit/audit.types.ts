export type AuditAction =
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_UPDATED'
  | 'TRANSACTION_DELETED'
  | 'DEBT_CREATED'
  | 'DEBT_PAYMENT_CREATED'
  | 'REMINDER_CREATED'
  | 'SUBSCRIPTION_STARTED'
  | 'USER_CREATED'
  | 'CATEGORY_CREATED'
  | 'BUDGET_CREATED'
  | 'BUDGET_UPDATED'
  | 'BUDGET_DELETED'
  | 'SAVINGS_GOAL_CREATED'
  | 'SAVINGS_CONTRIBUTED'
  | 'SAVINGS_GOAL_DELETED'
  | 'SAVINGS_PACE_UPDATED';

export type AuditEntry = {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};
