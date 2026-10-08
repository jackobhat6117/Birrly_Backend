export type StructuredIntent =
  | 'CREATE_EXPENSE'
  | 'CREATE_INCOME'
  | 'CREATE_DEBT'
  | 'RECORD_DEBT_PAYMENT'
  | 'CREATE_REMINDER'
  | 'CREATE_BUDGET'
  | 'CREATE_SAVINGS_GOAL'
  | 'QUERY_SPENDING'
  | 'QUERY_BALANCE'
  | 'QUERY_DEBT'
  | 'QUERY_REPORT'
  | 'GREET'
  | 'WELLBEING'
  | 'THANKS'
  | 'UNKNOWN';

export type StructuredCommand = {
  intent: StructuredIntent;
  amount?: string;
  currency?: string;
  categorySlug?: string;
  /** Set when the slug is not on this account yet. Confirm offers to create it. */
  proposedCategoryName?: string;
  /** First-launch income answer: also store this amount as monthly income. */
  setMonthlyIncome?: boolean;
  description?: string;
  date?: string;
  personName?: string;
  debtType?: 'OWED_TO_ME' | 'I_OWE';
  reminderTitle?: string;
  confidence: number;
  missingFields: string[];
  source: 'llm' | 'fallback';
};

export type ParseTextInput = {
  text: string;
  language: string;
  currency: string;
  /**
   * Optional compact personalization hint (this user's frequent categories,
   * merchant→category habits, active goals). Conditions the LLM parser only —
   * the rule-based parser ignores it. Never authoritative; a hint, not a fact.
   */
  userContext?: string;
};
