export const ERROR_CODE = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_CATEGORY: 'INVALID_CATEGORY',
  INVALID_DATE: 'INVALID_DATE',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  DEBT_NOT_FOUND: 'DEBT_NOT_FOUND',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  REMINDER_NOT_FOUND: 'REMINDER_NOT_FOUND',
  BUDGET_NOT_FOUND: 'BUDGET_NOT_FOUND',
  SAVINGS_GOAL_NOT_FOUND: 'SAVINGS_GOAL_NOT_FOUND',
  EQUB_NOT_FOUND: 'EQUB_NOT_FOUND',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  AI_PARSE_FAILED: 'AI_PARSE_FAILED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super(ERROR_CODE.UNAUTHORIZED, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You are not allowed to perform this operation.') {
    super(ERROR_CODE.FORBIDDEN, message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(code, message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(ERROR_CODE.CONFLICT, message, 409);
  }
}
