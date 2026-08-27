import type { ReminderFrequency } from '@prisma/client';

export type CreateReminderInput = {
  title: string;
  notes?: string;
  frequency?: ReminderFrequency;
  runAt: string;
  debtId?: string;
};

export type ReminderDto = {
  id: string;
  title: string;
  notes: string | null;
  frequency: ReminderFrequency;
  nextRunAt: string;
  status: string;
  createdAt: string;
};

export interface ReminderScheduler {
  schedule(reminderId: string, runAt: Date): Promise<void>;
}
