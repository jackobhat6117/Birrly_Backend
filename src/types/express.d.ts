import type { AuthenticatedUser } from '@/modules/users/user.types';
import type { AdminTokenPayload } from '@/modules/admin/admin.auth';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthenticatedUser;
      admin?: AdminTokenPayload;
    }
  }
}

export {};
