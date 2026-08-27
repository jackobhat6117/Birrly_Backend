import type { AuthenticatedUser } from '@/modules/users/user.types';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthenticatedUser;
    }
  }
}

export {};
