import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError, ERROR_CODE } from '@/shared/errors/app-error';

type RequestPart = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodType, part: RequestPart = 'body'): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(
        new AppError(ERROR_CODE.VALIDATION_FAILED, 'Request validation failed.', 422, result.error.flatten()),
      );
      return;
    }

    // Express 5 makes `query` (and sometimes `params`) a getter; assign via defineProperty.
    Object.defineProperty(req, part, {
      value: result.data,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    next();
  };
