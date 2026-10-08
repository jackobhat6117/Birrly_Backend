import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from '@/app/config';
import { createContainer } from '@/app/container';
import { health, ready } from '@/app/health';
import { createRoutes } from '@/app/routes';
import { adminRoutes } from '@/modules/admin/admin.routes';
import { authRoutes } from '@/modules/auth/auth.routes';
import { testRoutes } from '@/modules/test/test.routes';
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
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!requestOrigin) {
          callback(null, true);
          return;
        }

        if (config.corsOrigins.length > 0) {
          const isAllowed = config.corsOrigins.some((allowed) => {
            if (allowed === '*' || allowed === requestOrigin) return true;
            // Match wildcards like https://*.vercel.app
            if (allowed.includes('*')) {
              const regex = new RegExp(`^${allowed.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);
              return regex.test(requestOrigin);
            }
            return false;
          });
          callback(null, isAllowed);
          return;
        }

        // In non-production, allow any origin; in production default to Vercel/localhost domains if unspecified
        if (!config.isProduction) {
          callback(null, true);
          return;
        }

        // Default allow Vercel previews/deployments if CORS_ORIGIN was omitted
        if (requestOrigin.endsWith('.vercel.app')) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
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

  if (config.isOat) {
    app.use('/api/v1/test', testRoutes(container.testController));
  }

  app.use('/api/v1/admin', adminRoutes(container.adminController));
  // Public — no TMA auth; rate-limited inside authRoutes
  app.use('/api/v1/auth', authRoutes(container.authController));
  app.use('/api/v1', createRoutes(container));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, container };
}

export const appPort = env.PORT;
