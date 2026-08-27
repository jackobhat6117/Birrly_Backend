import { Router } from 'express';
import type { ReminderController } from '@/modules/reminders/reminder.controller';

export function reminderRoutes(controller: ReminderController): Router {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  return router;
}
