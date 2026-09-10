import type { ParseTextInput } from '@/modules/ai/ai.types';
import type { ExpectedFields } from './score';

/**
 * Golden set for the rule-based parser (`parseWithFallback`). Each case is a real
 * message → the fields we expect. This is the seed of Birrly's AI eval corpus
 * (ADR 001/002); it currently scores the deterministic parser in CI, and the same
 * cases can later be replayed against the LLM parser offline.
 *
 * `knownGap: true` marks messages the rule parser is not expected to handle yet
 * (natural phrasing / reasoning that needs the LLM). They are reported as backlog,
 * not asserted — so we can watch them turn green as the parser or LLM improves.
 * Real captured corrections (ADR 002) should be distilled into new cases here.
 */
export type ParseCase = {
  id: string;
  group: string;
  input: ParseTextInput;
  expect: ExpectedFields;
  knownGap?: boolean;
  note?: string;
};

const etb = (text: string, language = 'en'): ParseTextInput => ({ text, language, currency: 'ETB' });

export const PARSE_CASES: ParseCase[] = [
  // --- Expenses: English ---
  {
    id: 'exp-en-sentence',
    group: 'expense',
    input: etb('I spent 350 birr on lunch'),
    expect: { intent: 'CREATE_EXPENSE', amount: '350', categorySlug: 'food', missingFields: [] },
  },
  {
    id: 'exp-en-paid-for',
    group: 'expense',
    input: etb('I paid 200 for the taxi yesterday'),
    expect: { intent: 'CREATE_EXPENSE', amount: '200', categorySlug: 'transport' },
  },
  {
    id: 'exp-en-shorthand',
    group: 'expense',
    input: etb('80 taxi'),
    expect: { intent: 'CREATE_EXPENSE', amount: '80', categorySlug: 'transport', missingFields: [] },
  },
  {
    id: 'exp-en-missing-category',
    group: 'expense',
    input: etb('I spent 500'),
    expect: { intent: 'CREATE_EXPENSE', amount: '500', missingFields: ['categorySlug'] },
  },

  // --- Expenses: Amharic / code-mixed ---
  {
    id: 'exp-am-shorthand-taxi',
    group: 'expense',
    input: etb('80 ታክሲ', 'am'),
    expect: { intent: 'CREATE_EXPENSE', amount: '80', categorySlug: 'transport', missingFields: [] },
  },
  {
    id: 'exp-am-shorthand-lunch',
    group: 'expense',
    input: etb('350 ምሳ', 'am'),
    expect: { intent: 'CREATE_EXPENSE', amount: '350', categorySlug: 'food', missingFields: [] },
  },

  // --- Income ---
  {
    id: 'inc-en-salary',
    group: 'income',
    input: etb('40000 salary'),
    expect: { intent: 'CREATE_INCOME', amount: '40000', categorySlug: 'salary' },
  },
  {
    id: 'inc-am-salary',
    group: 'income',
    input: etb('40000 ደመወዝ', 'am'),
    expect: { intent: 'CREATE_INCOME', amount: '40000', categorySlug: 'salary' },
  },
  {
    id: 'inc-en-received',
    group: 'income',
    input: etb('received 1500 from freelance'),
    expect: { intent: 'CREATE_INCOME', amount: '1500' },
  },

  // --- Debts / IOUs ---
  {
    id: 'debt-en-owed-to-me',
    group: 'debt',
    input: etb('Abebe owes me 2000 birr'),
    expect: { intent: 'CREATE_DEBT', personName: 'Abebe', debtType: 'OWED_TO_ME', amount: '2000' },
  },
  {
    id: 'debt-en-i-owe',
    group: 'debt',
    input: etb('I owe Sara 500'),
    expect: { intent: 'CREATE_DEBT', personName: 'Sara', debtType: 'I_OWE', amount: '500' },
  },
  {
    id: 'debt-shorthand',
    group: 'debt',
    input: etb('Abebe 2000'),
    expect: { intent: 'CREATE_DEBT', personName: 'Abebe', debtType: 'OWED_TO_ME', amount: '2000' },
  },
  {
    id: 'debt-payment',
    group: 'debt',
    input: etb('Abebe paid 1000'),
    expect: { intent: 'RECORD_DEBT_PAYMENT', personName: 'Abebe', amount: '1000' },
  },

  // --- Reminders ---
  {
    id: 'reminder-with-date',
    group: 'reminder',
    input: etb('remind me to pay rent on Monday'),
    expect: { intent: 'CREATE_REMINDER', reminderTitle: 'pay rent', missingFields: [] },
  },
  {
    id: 'reminder-no-date',
    group: 'reminder',
    input: etb('remind me to pay rent'),
    expect: { intent: 'CREATE_REMINDER', reminderTitle: 'pay rent', missingFields: ['date'] },
  },

  // --- Budgets & savings ---
  {
    id: 'budget-lead',
    group: 'planning',
    input: etb('budget 5000 for food'),
    expect: { intent: 'CREATE_BUDGET', amount: '5000', categorySlug: 'food' },
  },
  {
    id: 'savings-goal',
    group: 'planning',
    input: etb('save 100000 for a phone'),
    expect: { intent: 'CREATE_SAVINGS_GOAL', amount: '100000' },
  },

  // --- Queries ---
  {
    id: 'query-balance-en',
    group: 'query',
    input: etb("what's my remaining"),
    expect: { intent: 'QUERY_BALANCE' },
  },
  {
    id: 'query-balance-am',
    group: 'query',
    input: etb('ቀሪ ገንዘብ', 'am'),
    expect: { intent: 'QUERY_BALANCE' },
  },
  {
    id: 'query-spending',
    group: 'query',
    input: etb('how much did I spend'),
    expect: { intent: 'QUERY_SPENDING' },
  },
  {
    id: 'query-report',
    group: 'query',
    input: etb('show me this month'),
    expect: { intent: 'QUERY_REPORT' },
  },
  {
    id: 'query-debt',
    group: 'query',
    input: etb('who owes me'),
    expect: { intent: 'QUERY_DEBT' },
  },

  // --- Social intents ---
  { id: 'greet-en', group: 'social', input: etb('hello'), expect: { intent: 'GREET' } },
  { id: 'greet-am', group: 'social', input: etb('ሰላም', 'am'), expect: { intent: 'GREET' } },
  { id: 'wellbeing-en', group: 'social', input: etb('how are you'), expect: { intent: 'WELLBEING' } },
  { id: 'thanks-am', group: 'social', input: etb('አመሰግናለሁ', 'am'), expect: { intent: 'THANKS' } },

  // --- Known gaps: natural phrasing / reasoning the rule parser can't do yet.
  //     Documented as backlog (not asserted) — these are what the LLM closes.
  {
    id: 'gap-bought-lunch',
    group: 'expense',
    input: etb('I bought lunch for 350'),
    expect: { intent: 'CREATE_EXPENSE', amount: '350', categorySlug: 'food' },
    knownGap: true,
    note: 'no "spent/paid" lead-in; needs LLM',
  },
  {
    id: 'gap-balance-am-phrasing',
    group: 'query',
    input: etb('ምን ያህል ቀረኝ', 'am'),
    expect: { intent: 'QUERY_BALANCE' },
    knownGap: true,
    note: 'natural Amharic "ቀረኝ" not matched — parser only covers "ቀር"/"ቀሪ ገንዘብ". Real coverage gap surfaced by the eval.',
  },
  {
    id: 'gap-affordability',
    group: 'query',
    input: etb('can I afford a 5000 birr phone this month?'),
    expect: { intent: 'QUERY_BALANCE' },
    knownGap: true,
    note: 'affordability reasoning; future general-query intent',
  },
  {
    id: 'gap-mixed-sentence',
    group: 'expense',
    input: etb('took my friend out for dinner, cost me like 300'),
    expect: { intent: 'CREATE_EXPENSE', amount: '300', categorySlug: 'food' },
    knownGap: true,
    note: 'conversational, amount not adjacent to keyword; needs LLM',
  },
];
