import type { Prisma } from '@prisma/client';
import type { DbClient } from '@/database/prisma';

export type CreateAiInteractionInput = {
  userId: string;
  intent: string | null;
  success: boolean;
  provider: string;
  latencyMs?: number | null;
  inputText?: string | null;
  language?: string | null;
  predictedCommand?: Prisma.InputJsonValue;
};

export type AiInteractionOutcome = 'CONFIRMED' | 'EDITED' | 'CANCELED';

/** Prisma access only for the AI labeled-data table. No business decisions. */
export class AiInteractionRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateAiInteractionInput): Promise<{ id: string }> {
    const row = await this.db.aiInteraction.create({
      data: {
        userId: input.userId,
        intent: input.intent,
        success: input.success,
        provider: input.provider,
        latencyMs: input.latencyMs ?? null,
        inputText: input.inputText ?? null,
        language: input.language ?? null,
        predictedCommand: input.predictedCommand,
      },
      select: { id: true },
    });
    return row;
  }

  async setOutcome(
    id: string,
    outcome: AiInteractionOutcome,
    corrected: boolean,
    finalCommand?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.db.aiInteraction.update({
      where: { id },
      data: { outcome, corrected, finalCommand },
    });
  }
}
