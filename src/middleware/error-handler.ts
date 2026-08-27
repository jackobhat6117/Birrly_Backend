import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '@/shared/logger/logger';
import { AppError, ERROR_CODE } from '@/shared/errors/app-error';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: ERROR_CODE.VALIDATION_FAILED,
        message: 'Request validation failed.',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: req.requestId }, err.message);
    }

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error({ err, requestId: req.requestId }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: ERROR_CODE.INTERNAL,
      message: 'An unexpected error occurred.',
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} was not found.`,
    },
  });
}
