import type { ParseTextInput } from '@/modules/ai/ai.types';
import { TRANSACTION_PARSER_PROMPT_V1 } from '@/modules/ai/prompts/transaction-parser.v1';
import { SYSTEM_CATEGORIES } from '@/shared/constants/categories';

export function buildParserPrompt(input: ParseTextInput): string {
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
${input.userContext ? `\n${input.userContext}\n` : ''}
User message:
${input.text}`;
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  return JSON.parse(candidate) as unknown;
}
