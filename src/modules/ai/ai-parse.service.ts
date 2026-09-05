import type { AiInterpreter } from '@/modules/ai/ai.interpreter';
import type { AiUsageService, AiUsageStatus } from '@/modules/ai/ai-usage.service';
import type { ParseTextInput, StructuredCommand } from '@/modules/ai/ai.types';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import { FEATURE } from '@/shared/constants/features';

export type AiParseResult = {
  command: StructuredCommand;
  usage: AiUsageStatus;
  quotaExceeded: boolean;
  usedLlm: boolean;
};

export class AiParseService {
  constructor(
    private readonly interpreter: AiInterpreter,
    private readonly usage: AiUsageService,
    private readonly subscriptions: SubscriptionService,
    private readonly llmEnabled: boolean,
  ) {}

  async parseForUser(userId: string, input: ParseTextInput): Promise<AiParseResult> {
    const unlimited = await this.subscriptions.canAccess(userId, FEATURE.AI_NATURAL_LANGUAGE);
    const usage = await this.usage.getStatus(userId, unlimited);
    const useLlm = this.usage.canUseLlm(usage, this.llmEnabled);

    const command = await this.interpreter.interpret(input, { useLlm });
    const usedLlm = command.source === 'llm';

    if (usedLlm && !unlimited) {
      await this.usage.recordSuccessfulLlmParse(userId);
      usage.used += 1;
      usage.remaining = Math.max(0, usage.limit - usage.used);
    }

    const quotaExceeded =
      !unlimited &&
      !useLlm &&
      this.llmEnabled &&
      usage.remaining === 0 &&
      command.intent === 'UNKNOWN';

    return {
      command,
      usage,
      quotaExceeded,
      usedLlm,
    };
  }
}
