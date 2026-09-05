import { TRANSACTION_PARSER_PROMPT_V1 } from '@/modules/ai/prompts/transaction-parser.v1';
import type { ParseTextInput, StructuredCommand } from '@/modules/ai/ai.types';
import { SYSTEM_CATEGORIES } from '@/shared/constants/categories';
import type { LLMProvider } from '@/integrations/llm/llm.provider';

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

function buildParserPrompt(input: ParseTextInput): string {
  const categorySlugs = SYSTEM_CATEGORIES.map((category) => category.slug).join(', ');
  return `${TRANSACTION_PARSER_PROMPT_V1}

Allowed intents:
CREATE_EXPENSE, CREATE_INCOME, CREATE_DEBT, RECORD_DEBT_PAYMENT, CREATE_REMINDER,
CREATE_BUDGET, CREATE_SAVINGS_GOAL, QUERY_SPENDING, QUERY_BALANCE, QUERY_DEBT,
QUERY_REPORT, GREET, WELLBEING, THANKS, UNKNOWN

Allowed categorySlug values (lowercase): ${categorySlugs}

debtType: OWED_TO_ME when someone owes the user, I_OWE when the user owes someone.

Return a single JSON object with these fields:
- intent (required)
- amount (string, optional)
- currency (string, optional, default ${input.currency})
- categorySlug (optional, for expenses/budgets/queries)
- description (optional; savings goal name for CREATE_SAVINGS_GOAL)
- date (ISO date string, optional)
- personName (optional, for debts and debt payments)
- debtType (optional: OWED_TO_ME or I_OWE)
- reminderTitle (optional)
- confidence (number 0-1, required)
- missingFields (string array, e.g. amount, categorySlug, personName, description)
- source must be "llm"

User language hint: ${input.language}
Default currency: ${input.currency}

User message:
${input.text}`;
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  return JSON.parse(candidate) as unknown;
}

export class GeminiLlmProvider implements LLMProvider {
  constructor(
    private readonly options: {
      apiKey: string;
      model?: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  isEnabled(): boolean {
    return this.options.apiKey.trim().length > 0;
  }

  async parse(input: ParseTextInput): Promise<StructuredCommand> {
    if (!this.isEnabled()) {
      throw new Error('Gemini LLM is not configured.');
    }

    const model = this.options.model?.trim() || DEFAULT_GEMINI_MODEL;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.options.apiKey.trim())}`;

    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildParserPrompt(input) }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const payload = (await response.json()) as GeminiGenerateResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Gemini request failed (${response.status})`);
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    const parsed = extractJsonObject(text) as Omit<StructuredCommand, 'source'>;
    return {
      ...parsed,
      source: 'llm',
      currency: parsed.currency ?? input.currency,
      missingFields: parsed.missingFields ?? [],
    };
  }
}
