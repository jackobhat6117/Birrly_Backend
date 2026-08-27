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

    req[part] = result.data as typeof req.body;
    next();
  };
