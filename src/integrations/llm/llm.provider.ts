import type { ParseTextInput, StructuredCommand } from '@/modules/ai/ai.types';

export interface LLMProvider {
  isEnabled(): boolean;
  parse(input: ParseTextInput): Promise<StructuredCommand>;
}

export class DisabledLLMProvider implements LLMProvider {
  isEnabled(): boolean {
    return false;
  }

  parse(_input: ParseTextInput): Promise<StructuredCommand> {
    return Promise.reject(new Error('LLM provider is disabled.'));
  }
}
