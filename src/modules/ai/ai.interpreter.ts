import type { LLMProvider } from '@/integrations/llm/llm.provider';
import { structuredCommandSchema } from '@/modules/ai/ai.schema';
import type { ParseTextInput, StructuredCommand } from '@/modules/ai/ai.types';
import { parseWithFallback } from '@/modules/ai/parsers/fallback-parser';

export class AiInterpreter {
  constructor(private readonly llmProvider: LLMProvider) {}

  async interpret(
    input: ParseTextInput,
    options: { useLlm?: boolean } = {},
  ): Promise<StructuredCommand> {
    const useLlm = options.useLlm ?? true;
    if (useLlm && this.llmProvider.isEnabled()) {
      try {
        const parsed = await this.llmProvider.parse(input);
        return structuredCommandSchema.parse(parsed);
      } catch {
        const fallback = parseWithFallback(input);
        return structuredCommandSchema.parse(fallback);
      }
    }

    const fallback = parseWithFallback(input);
    return structuredCommandSchema.parse(fallback);
  }
}
