import { z } from 'zod';
import { COACH_LENSES } from '@/modules/coach/coach.types';

/**
 * The LLM returns only this shape — a headline plus 1–6 narrated sections.
 * If it fails to validate, the caller returns null and the client hides the
 * card rather than showing a guess (same contract as monthly insights).
 */
export const coachAnalysisResponseSchema = z.object({
  headline: z.string().min(1).max(160),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        tone: z.enum(['positive', 'neutral', 'warning']),
        detail: z.string().min(1).max(400),
        recommendation: z.string().min(1).max(400).optional(),
        impact: z.string().min(1).max(80).optional(),
      }),
    )
    .min(1)
    .max(6),
});

export const coachQuerySchema = z.object({
  lens: z.enum(COACH_LENSES),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  refresh: z.coerce.boolean().optional(),
});

export type CoachQuery = z.infer<typeof coachQuerySchema>;
