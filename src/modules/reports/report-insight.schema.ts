import { z } from 'zod';

// The LLM never returns free text — only this shape. If it fails to validate,
// the caller shows nothing rather than guess at what was meant.
export const monthlyInsightsResponseSchema = z.object({
  insights: z
    .array(
      z.object({
        message: z.string().min(1).max(220),
        tone: z.enum(['positive', 'neutral', 'warning']),
      }),
    )
    .min(1)
    .max(4),
});
