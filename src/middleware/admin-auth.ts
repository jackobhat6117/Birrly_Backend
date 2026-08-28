import type { RequestHandler } from 'express';
import { config } from '@/app/config';
import { verifyAdminToken } from '@/modules/admin/admin.auth';
import { UnauthorizedError } from '@/shared/errors/app-error';

export function createAdminAuthMiddleware(): RequestHandler {
  return (req, _res, next) => {
    try {
      const header = req.header('authorization');
      const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!token) {
        next(new UnauthorizedError());
        return;
      }
      req.admin = verifyAdminToken(token, config.admin.jwtSecret);
      next();
    } catch (error) {
      next(error);
    }
  };
}
