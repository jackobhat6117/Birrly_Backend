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
  | 'UNKNOWN';

export type StructuredCommand = {
  intent: StructuredIntent;
  amount?: string;
  currency?: string;
  categorySlug?: string;
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
};
