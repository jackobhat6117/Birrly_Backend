import type { LLMProvider } from '@/integrations/llm/llm.provider';
import { structuredCommandSchema } from '@/modules/ai/ai.schema';
import type { ParseTextInput, StructuredCommand } from '@/modules/ai/ai.types';
import { parseWithFallback } from '@/modules/ai/parsers/fallback-parser';
import { logger } from '@/shared/logger/logger';

/**
 * A rule hit at or above this confidence is trusted outright — the shorthand and
 * clear sentences the rule parser is good at ("80 taxi", "Abebe owes me 2000",
 * "I spent 350 on lunch"). These are handled instantly and cost nothing, so they
 * never burn an LLM call or a free user's daily AI quota. Below it, the message
 * is ambiguous enough to be worth the LLM (when available).
 */
const RULE_CONFIDENCE_THRESHOLD = 0.7;

export class AiInterpreter {
  constructor(private readonly llmProvider: LLMProvider) {}

  /**
   * Rules-first cascade:
   *  1. Run the (free, instant) rule parser.
   *  2. A confident rule hit is returned as-is — no LLM call.
   *  3. Otherwise, if the LLM is allowed and enabled, use it; a good LLM result
   *     wins, an UNKNOWN one yields to any rule hit we have.
   *  4. If the LLM is off/over-quota/errors, we still return the rule result —
   *     the core logging path always works.
   */
  async interpret(
    input: ParseTextInput,
    options: { useLlm?: boolean } = {},
  ): Promise<StructuredCommand> {
    const useLlm = options.useLlm ?? true;
    const rule = structuredCommandSchema.parse(parseWithFallback(input));

    if (rule.intent !== 'UNKNOWN' && rule.confidence >= RULE_CONFIDENCE_THRESHOLD) {
      return rule;
    }

    if (useLlm && this.llmProvider.isEnabled()) {
      try {
        const validated = structuredCommandSchema.parse(await this.llmProvider.parse(input));
        if (validated.intent !== 'UNKNOWN') {
          return validated;
        }
        // LLM was unsure — prefer any rule hit we have over a shared UNKNOWN.
        return rule.intent !== 'UNKNOWN' ? rule : validated;
      } catch (error) {
        // Never silent: a rejected key, unreachable provider, or bad LLM JSON
        // used to look identical to "AI off". Log it so operators can see the
        // real reason the bot is running on the rule-based parser.
        logger.warn(
          { err: error, language: input.language },
          'LLM parse failed; falling back to rule-based parser',
        );
        return rule;
      }
    }

    return rule;
  }
}
