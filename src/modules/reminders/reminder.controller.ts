import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import { createReminderSchema } from '@/modules/reminders/reminder.schema';
import type { ReminderService } from '@/modules/reminders/reminder.service';

export class ReminderController {
  constructor(private readonly reminders: ReminderService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.reminders.list(req.user!.id);
    res.json({ data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = createReminderSchema.parse(req.body);
    const data = await this.reminders.create(req.user!.id, req.user!.timezone, input);
    res.status(201).json({ data });
  });
}
