import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from '@/app/config';
import { createContainer } from '@/app/container';
import { health, ready } from '@/app/health';
import { createRoutes } from '@/app/routes';
import { adminRoutes } from '@/modules/admin/admin.routes';
import { env } from '@/app/env';
import { errorHandler, notFoundHandler } from '@/middleware/error-handler';
import { rateLimit } from '@/middleware/rate-limit';
import { requestId } from '@/middleware/request-id';

export function createApp() {
  const app = express();
  const container = createContainer();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin:
        config.corsOrigins.length > 0 ? config.corsOrigins : config.isProduction ? false : true,
      allowedHeaders: [
        'Accept',
        'Authorization',
        'Content-Type',
        'x-dev-telegram-id',
        'x-telegram-init-data',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);

  app.get('/health', health);
  app.get('/ready', ready);

  app.post(
    '/webhooks/telegram',
    rateLimit({ prefix: 'telegram-webhook', max: 300 }),
    container.telegramWebhookController.receive,
  );

  app.use('/api/v1/admin', adminRoutes(container.adminController));
  app.use('/api/v1', createRoutes(container));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, container };
}

export const appPort = env.PORT;
