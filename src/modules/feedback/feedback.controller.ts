import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import { createFeedbackSchema } from '@/modules/feedback/feedback.schema';
import type { FeedbackService } from '@/modules/feedback/feedback.service';

export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = createFeedbackSchema.parse(req.body);
    const data = await this.feedback.create(req.user!.id, input, 'APP');
    res.status(201).json({ data });
  });
}
