import { z } from 'zod';

export const ingestEventsSchema = z.object({
  events: z.array(z.unknown()).max(20),
});
