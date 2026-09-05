import { CATEGORY_ALIASES, SYSTEM_CATEGORIES } from '@/shared/constants/categories';
import type { ParseTextInput, StructuredCommand } from '@/modules/ai/ai.types';

const AMOUNT = '(\\d{1,12}(?:[.,]\\d{1,2})?)';
const CURRENCY = '(?:birr|br|etb|ብር)?';

function normalizeAmount(raw: string): string {
  return raw.replace(',', '.');
}

function resolveCategory(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const needle = text.toLowerCase().trim();
  if (CATEGORY_ALIASES[needle]) {
    return CATEGORY_ALIASES[needle];
  }

  const aliasHit = Object.entries(CATEGORY_ALIASES).find(([alias]) => needle.includes(alias));
  if (aliasHit) {
    return aliasHit[1];
  }

  const direct = SYSTEM_CATEGORIES.find(
    (category) => needle === category.slug || needle.includes(category.name.toLowerCase()),
  );
  return direct?.slug;
}

function command(
  partial: Omit<StructuredCommand, 'source' | 'missingFields'> & { missingFields?: string[] },
): StructuredCommand {
  return {
    ...partial,
    source: 'fallback',
    missingFields: partial.missingFields ?? [],
  };
}

export function parseWithFallback(input: ParseTextInput): StructuredCommand {
  const text = input.text.trim();
  const lower = text.toLowerCase();

  const debtPaidByPerson = text.match(
    new RegExp(`^(.+?)\\s+(?:paid|pay(?:ed)?|repaid)\\s+${AMOUNT}\\s*${CURRENCY}\\s*$`, 'i'),
  );
  if (debtPaidByPerson?.[1] && debtPaidByPerson[2]) {
    return command({
      intent: 'RECORD_DEBT_PAYMENT',
      personName: debtPaidByPerson[1].trim(),
      amount: normalizeAmount(debtPaidByPerson[2]),
      currency: input.currency,
      confidence: 0.84,
    });
  }

  const debtPaidToPerson = text.match(
    new RegExp(`^(?:paid|pay)\\s+(.+?)\\s+${AMOUNT}\\s*${CURRENCY}\\s*$`, 'i'),
  );
  if (debtPaidToPerson?.[1] && debtPaidToPerson[2]) {
    return command({
      intent: 'RECORD_DEBT_PAYMENT',
      personName: debtPaidToPerson[1].trim(),
      amount: normalizeAmount(debtPaidToPerson[2]),
      currency: input.currency,
      confidence: 0.84,
    });
  }

  const spent = text.match(
    new RegExp(
      `^(?:i\\s+)?(?:spent|paid)\\s+${AMOUNT}\\s*${CURRENCY}\\s*(?:on\\s+|for\\s+)?(.*)?$`,
      'i',
    ),
  );
  if (spent?.[1]) {
    const description = spent[2]?.trim() || undefined;
    const categorySlug = resolveCategory(description);
    const missingFields = categorySlug ? [] : ['categorySlug'];
    return command({
      intent: 'CREATE_EXPENSE',
      amount: normalizeAmount(spent[1]),
      currency: input.currency,
      categorySlug,
      description,
      confidence: categorySlug ? 0.86 : 0.6,
      missingFields,
    });
  }

  const salary = text.match(
    new RegExp(`^(?:${AMOUNT}\\s*${CURRENCY}\\s*(?:salary|wage|ደመወዝ)|(?:salary|ደመወዝ)\\s+${AMOUNT}\\s*${CURRENCY})$`, 'i'),
  );
  if (salary?.[1] || salary?.[2]) {
    return command({
      intent: 'CREATE_INCOME',
      amount: normalizeAmount(salary[1] ?? salary[2] ?? '0'),
      currency: input.currency,
      categorySlug: 'salary',
      description: 'Salary',
      confidence: 0.82,
    });
  }

  const income = text.match(
    new RegExp(
      `(?:i\\s+)?(?:received|earned|got|income)\\s+${AMOUNT}\\s*${CURRENCY}\\s*(?:from\\s+|as\\s+)?(.*)?`,
      'i',
    ),
  );
  if (income?.[1]) {
    const description = income[2]?.trim() || undefined;
    const categorySlug = resolveCategory(description) ?? 'salary';
    return command({
      intent: 'CREATE_INCOME',
      amount: normalizeAmount(income[1]),
      currency: input.currency,
      categorySlug,
      description,
      confidence: 0.8,
    });
  }

  const owedToMe = text.match(new RegExp(`(.+?)\\s+owes\\s+me\\s+${AMOUNT}\\s*${CURRENCY}`, 'i'));
  if (owedToMe?.[1] && owedToMe[2]) {
    return command({
      intent: 'CREATE_DEBT',
      personName: owedToMe[1].trim(),
      amount: normalizeAmount(owedToMe[2]),
      currency: input.currency,
      debtType: 'OWED_TO_ME',
      confidence: 0.9,
    });
  }

  const iOwe = text.match(new RegExp(`i\\s+owe\\s+(.+?)\\s+${AMOUNT}\\s*${CURRENCY}`, 'i'));
  if (iOwe?.[1] && iOwe[2]) {
    return command({
      intent: 'CREATE_DEBT',
      personName: iOwe[1].trim(),
      amount: normalizeAmount(iOwe[2]),
      currency: input.currency,
      debtType: 'I_OWE',
      confidence: 0.9,
    });
  }

  const reminder = text.match(/remind me to (.+?)(?: on (.+))?$/i);
  if (reminder?.[1]) {
    const missingFields = reminder[2] ? [] : ['date'];
    return command({
      intent: 'CREATE_REMINDER',
      reminderTitle: reminder[1].trim(),
      date: reminder[2]?.trim(),
      confidence: reminder[2] ? 0.8 : 0.55,
      missingFields,
    });
  }

  if (
    /^(?:hi|hello|hey|yo|good (?:morning|afternoon|evening)|selam|ሰላም)(?:\s+birrly)?[!?.\s]*$/i.test(text) ||
    /^birrly[!?,.\s]*$/i.test(text) ||
    /^hi there[!?.]*$/i.test(text)
  ) {
    return command({ intent: 'GREET', confidence: 0.95 });
  }

  if (
    /^(?:how are you|how r u|how are u|how'?s it going|what'?s up|whats up|sup|how do you do|you good|how you doing)(?:\s+birrly)?[!?.\s]*$/i.test(
      text,
    ) ||
    /^(?:እንዴት\s*(?:ነህ|ነሽ|ናችሁ|ነው))[!?.\s]*$/i.test(text)
  ) {
    return command({ intent: 'WELLBEING', confidence: 0.93 });
  }

  if (/^(?:thanks|thank you|thx|አመሰግናለሁ)(?:\s+birrly)?[!?.\s]*$/i.test(text)) {
    return command({ intent: 'THANKS', confidence: 0.92 });
  }

  if (
    /what(?:'s| is) my remaining/.test(lower) ||
    /how much (?:money |cash )?(?:do i )?(?:have |is )?left/.test(lower) ||
    /how much (?:money|cash) is left/.test(lower) ||
    /how much is left/.test(lower) ||
    /what(?:'s| is) (?:my )?(?:money |cash )?left/.test(lower) ||
    /what(?:'s| is) left(?: until payday)?/.test(lower) ||
    /remaining (?:money|cash|balance)/.test(lower) ||
    /(?:money|cash) (?:is )?left/.test(lower) ||
    /left until payday/.test(lower) ||
    /(?:my|what(?:'s| is) my) balance/.test(lower) ||
    /how much remaining/.test(lower) ||
    /how much do i have/.test(lower) ||
    /ምን ያህል ቀር/.test(text) ||
    /የቀረ(?:ው)?\s*(?:ገንዘብ|ብር)/.test(text) ||
    /ቀሪ\s*(?:ብር|ገንዘብ)/.test(text)
  ) {
    return command({ intent: 'QUERY_BALANCE', confidence: 0.88 });
  }

  if (
    /how much did i spend/.test(lower) ||
    /what did i spend/.test(lower) ||
    /spending/.test(lower)
  ) {
    return command({
      intent: 'QUERY_SPENDING',
      categorySlug: resolveCategory(lower),
      confidence: 0.7,
    });
  }

  if (/report|summary|this month|ማጠቃለያ|የዚህ ወር/.test(lower) || /የዚህ ወር/.test(text)) {
    return command({
      intent: 'QUERY_REPORT',
      confidence: 0.7,
    });
  }

  if (
    /(?:show|list|my)\s+debts?|who owes|debt|owe|owes|ዕዳ|ማን ይከፍ/.test(lower) &&
    !new RegExp(AMOUNT).test(text) &&
    !/(?:paid|pay)\s/.test(lower)
  ) {
    return command({
      intent: 'QUERY_DEBT',
      confidence: 0.6,
    });
  }

  const budgetLead = text.match(
    new RegExp(`^(?:budget|limit)\\s+${AMOUNT}\\s*${CURRENCY}\\s+(?:for\\s+)?(.+)$`, 'i'),
  );
  if (budgetLead?.[1]) {
    const categorySlug = resolveCategory(budgetLead[2]?.trim());
    return command({
      intent: 'CREATE_BUDGET',
      amount: normalizeAmount(budgetLead[1]),
      currency: input.currency,
      categorySlug,
      confidence: categorySlug ? 0.82 : 0.55,
      missingFields: categorySlug ? [] : ['categorySlug'],
    });
  }

  const budgetTrail = text.match(
    new RegExp(`^(.+?)\\s+budget\\s+(?:of\\s+|to\\s+)?${AMOUNT}\\s*${CURRENCY}\\s*$`, 'i'),
  );
  if (budgetTrail?.[1] && budgetTrail[2]) {
    const categorySlug = resolveCategory(budgetTrail[1].trim());
    return command({
      intent: 'CREATE_BUDGET',
      amount: normalizeAmount(budgetTrail[2]),
      currency: input.currency,
      categorySlug,
      confidence: categorySlug ? 0.82 : 0.55,
      missingFields: categorySlug ? [] : ['categorySlug'],
    });
  }

  const savingsLead = text.match(
    new RegExp(`^(?:save|savings?\\s+goal?)\\s+${AMOUNT}\\s*${CURRENCY}\\s+(?:for\\s+)?(.+)$`, 'i'),
  );
  if (savingsLead?.[1] && savingsLead[2]) {
    return command({
      intent: 'CREATE_SAVINGS_GOAL',
      amount: normalizeAmount(savingsLead[1]),
      currency: input.currency,
      description: savingsLead[2].trim(),
      confidence: 0.8,
    });
  }

  const savingsTrail = text.match(
    new RegExp(`^(.+?)\\s+(?:save|savings?)\\s+${AMOUNT}\\s*${CURRENCY}\\s*$`, 'i'),
  );
  if (savingsTrail?.[1] && savingsTrail[2]) {
    return command({
      intent: 'CREATE_SAVINGS_GOAL',
      amount: normalizeAmount(savingsTrail[2]),
      currency: input.currency,
      description: savingsTrail[1].trim(),
      confidence: 0.8,
    });
  }

  const shorthand = text.match(new RegExp(`^${AMOUNT}\\s+(.+)$`));
  if (shorthand?.[1] && shorthand[2]) {
    const description = shorthand[2].replace(new RegExp(`\\s*${CURRENCY}\\s*$`, 'i'), '').trim();
    const categorySlug = resolveCategory(description);
    return command({
      intent: 'CREATE_EXPENSE',
      amount: normalizeAmount(shorthand[1]),
      currency: input.currency,
      categorySlug,
      description,
      confidence: categorySlug ? 0.75 : 0.5,
      missingFields: categorySlug ? [] : ['categorySlug'],
    });
  }

  const personDebt = text.match(
    new RegExp(`^([\\p{L}][\\p{L}.'\\- ]{0,40}?)\\s+${AMOUNT}\\s*${CURRENCY}\\s*(?:ዕዳ|debt|iou)?$`, 'u'),
  );
  if (personDebt?.[1] && personDebt[2]) {
    const personName = personDebt[1].trim();
    if (!resolveCategory(personName) && !/^(i|pay|spent)$/i.test(personName)) {
      return command({
        intent: 'CREATE_DEBT',
        personName,
        amount: normalizeAmount(personDebt[2]),
        currency: input.currency,
        debtType: 'OWED_TO_ME',
        confidence: 0.72,
      });
    }
  }

  return command({
    intent: 'UNKNOWN',
    confidence: 0,
    missingFields: ['intent'],
  });
}
