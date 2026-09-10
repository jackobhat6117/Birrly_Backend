import type { Prisma } from '@prisma/client';
import type { StructuredCommand } from '@/modules/ai/ai.types';
import type {
  AiInteractionOutcome,
  AiInteractionRepository,
} from '@/modules/ai/ai-interaction.repository';
import { logger } from '@/shared/logger/logger';

export type RecordParseInput = {
  userId: string;
  inputText: string;
  language: string;
  command: StructuredCommand;
  usedLlm: boolean;
};

/**
 * Records AI parses and how the user resolved them, so predictions can be
 * scored against confirmed/corrected reality — the raw material for evals and
 * (later) fine-tuning. Every method is best-effort: capturing labels must never
 * break the user's action, and the whole thing is a no-op unless capture is
 * explicitly enabled (opt-in, consent-gated).
 */
export class AiInteractionService {
  constructor(
    private readonly repo: AiInteractionRepository,
    private readonly enabled: boolean,
  ) {}

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Returns the new interaction id (to carry through to the outcome), or null. */
  async recordParse(input: RecordParseInput): Promise<string | null> {
    if (!this.enabled) {
      return null;
    }
    try {
      const row = await this.repo.create({
        userId: input.userId,
        intent: input.command.intent,
        success: input.command.intent !== 'UNKNOWN',
        provider: input.usedLlm ? 'llm' : 'rule',
        inputText: input.inputText,
        language: input.language,
        predictedCommand: input.command as unknown as Prisma.InputJsonValue,
      });
      return row.id;
    } catch (error) {
      logger.warn({ err: error, userId: input.userId }, 'Failed to record AI parse');
      return null;
    }
  }

  /**
   * Marks how a parse resolved. `finalCommand` is the command as actually saved;
   * when it differs from the prediction the row is flagged `corrected` (a gold
   * training correction). CANCELED needs no final command.
   */
  async recordOutcome(
    id: string | null | undefined,
    outcome: AiInteractionOutcome,
    predicted?: StructuredCommand,
    finalCommand?: StructuredCommand,
  ): Promise<void> {
    if (!this.enabled || !id) {
      return;
    }
    try {
      const corrected =
        outcome === 'EDITED' ||
        (Boolean(predicted) &&
          Boolean(finalCommand) &&
          JSON.stringify(predicted) !== JSON.stringify(finalCommand));
      await this.repo.setOutcome(
        id,
        outcome,
        corrected,
        finalCommand as unknown as Prisma.InputJsonValue | undefined,
      );
    } catch (error) {
      logger.warn({ err: error, interactionId: id }, 'Failed to record AI outcome');
    }
  }

  /**
   * Records a later user edit of an AI-created record as a gold correction
   * (outcome EDITED, corrected). Used when a transaction that came from an AI
   * parse is edited in the Mini App — the richest correction signal.
   */
  async recordEdit(id: string | null | undefined, finalFields: Record<string, unknown>): Promise<void> {
    if (!this.enabled || !id) {
      return;
    }
    try {
      await this.repo.setOutcome(id, 'EDITED', true, finalFields as Prisma.InputJsonValue);
    } catch (error) {
      logger.warn({ err: error, interactionId: id }, 'Failed to record AI edit');
    }
  }
}
