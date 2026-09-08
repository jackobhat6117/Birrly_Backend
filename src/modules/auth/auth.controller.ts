import type { Request, Response } from 'express';
import { z } from 'zod';
import { config } from '@/app/config';
import { verifyTelegramLoginWidget } from '@/integrations/telegram/telegram-auth';
import { asyncHandler } from '@/middleware/async-handler';
import type { UserService } from '@/modules/users/user.service';
import { signWebToken } from '@/modules/auth/web-token';
import { AppError, ERROR_CODE } from '@/shared/errors/app-error';

const telegramLoginSchema = z.object({
  id: z.string().min(1),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.string().min(1),
  hash: z.string().min(1),
});

export class AuthController {
  constructor(private readonly users: UserService) {}

  telegramLogin = asyncHandler(async (req: Request, res: Response) => {
    const parsed = telegramLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_FAILED, 'Invalid Telegram login data.');
    }

    const identity = verifyTelegramLoginWidget(parsed.data, config.telegram.botToken);
    const user = await this.users.ensureFromTelegram(identity);

    const { token, expiresAt } = signWebToken(
      { sub: user.id, tid: user.telegramId },
      config.web.jwtSecret,
      config.web.jwtExpiresSec,
    );

    res.json({ data: { token, expiresAt } });
  });
}
