import { describe, expect, it } from 'vitest';
import { parseWithFallback } from '@/modules/ai/parsers/fallback-parser';

describe('fallback parser', () => {
  it('logs a spoken Amharic expense', () => {
    const result = parseWithFallback({
      text: 'ሰማንያ ብር ታክሲ',
      language: 'am',
      currency: 'ETB',
    });

    expect(result.intent).toBe('CREATE_EXPENSE');
    expect(result.amount).toBe('80');
    expect(result.categorySlug).toBe('transport');
  });

  it('logs spoken income, debt, budget, and savings without saying birr', () => {
    const lunch = parseWithFallback({ text: 'ምሳ ሰማንያ', language: 'am', currency: 'ETB' });
    expect(lunch.intent).toBe('CREATE_EXPENSE');
    expect(lunch.amount).toBe('80');
    expect(lunch.categorySlug).toBe('food');

    const salary = parseWithFallback({ text: 'ደመወዝ አርባ ሺህ', language: 'am', currency: 'ETB' });
    expect(salary.intent).toBe('CREATE_INCOME');
    expect(salary.amount).toBe('40000');
    expect(salary.categorySlug).toBe('salary');

    const debt = parseWithFallback({ text: 'አበበ ሁለት ሺህ', language: 'am', currency: 'ETB' });
    expect(debt.intent).toBe('CREATE_DEBT');
    expect(debt.personName).toBe('አበበ');
    expect(debt.amount).toBe('2000');

    const paid = parseWithFallback({ text: 'አበበ ከፈለኝ አምስት መቶ', language: 'am', currency: 'ETB' });
    expect(paid.intent).toBe('RECORD_DEBT_PAYMENT');
    expect(paid.personName).toBe('አበበ');
    expect(paid.amount).toBe('500');

    const budget = parseWithFallback({ text: 'ባጀት አምስት ሺህ ምሳ', language: 'am', currency: 'ETB' });
    expect(budget.intent).toBe('CREATE_BUDGET');
    expect(budget.amount).toBe('5000');
    expect(budget.categorySlug).toBe('food');

    const savings = parseWithFallback({ text: 'ለስልክ አስር ሺህ ቁጠባ', language: 'am', currency: 'ETB' });
    expect(savings.intent).toBe('CREATE_SAVINGS_GOAL');
    expect(savings.amount).toBe('10000');
    expect(savings.description).toBe('ስልክ');
  });

  it('logs a dollar amount when the voice note says dollar', () => {
    const result = parseWithFallback({ text: 'eighty dollars taxi', language: 'en', currency: 'ETB' });
    expect(result.intent).toBe('CREATE_EXPENSE');
    expect(result.amount).toBe('80');
    expect(result.currency).toBe('USD');
    expect(result.categorySlug).toBe('transport');
  });

  it('logs a spoken English expense', () => {
    const result = parseWithFallback({
      text: 'eighty birr taxi',
      language: 'en',
      currency: 'ETB',
    });

    expect(result.intent).toBe('CREATE_EXPENSE');
    expect(result.amount).toBe('80');
    expect(result.categorySlug).toBe('transport');
  });

  it('parses an expense in natural language', () => {
    const result = parseWithFallback({
      text: 'I spent 350 birr on lunch',
      language: 'en',
      currency: 'ETB',
    });

    expect(result.intent).toBe('CREATE_EXPENSE');
    expect(result.amount).toBe('350');
    expect(result.categorySlug).toBe('food');
    expect(result.missingFields).toEqual([]);
  });

  it('asks for a category when it is missing', () => {
    const result = parseWithFallback({
      text: 'I spent 500',
      language: 'en',
      currency: 'ETB',
    });

    expect(result.intent).toBe('CREATE_EXPENSE');
    expect(result.missingFields).toContain('categorySlug');
  });

  it('parses a debt owed to the user', () => {
    const result = parseWithFallback({
      text: 'Abebe owes me 2000 birr',
      language: 'en',
      currency: 'ETB',
    });

    expect(result.intent).toBe('CREATE_DEBT');
    expect(result.personName).toBe('Abebe');
    expect(result.debtType).toBe('OWED_TO_ME');
    expect(result.amount).toBe('2000');
  });

  it('parses a reminder', () => {
    const result = parseWithFallback({
      text: 'Remind me to pay rent on September 1',
      language: 'en',
      currency: 'ETB',
    });

    expect(result.intent).toBe('CREATE_REMINDER');
    expect(result.reminderTitle).toBe('pay rent');
    expect(result.date).toBe('September 1');
  });

  it('parses shorthand expenses including Amharic', () => {
    const taxi = parseWithFallback({ text: '80 taxi', language: 'en', currency: 'ETB' });
    expect(taxi.intent).toBe('CREATE_EXPENSE');
    expect(taxi.amount).toBe('80');
    expect(taxi.categorySlug).toBe('transport');

    const amharic = parseWithFallback({ text: '80 ታክሲ', language: 'am', currency: 'ETB' });
    expect(amharic.intent).toBe('CREATE_EXPENSE');
    expect(amharic.categorySlug).toBe('transport');
  });

  it('parses category-first shorthand such as taxi 80', () => {
    const taxi = parseWithFallback({ text: 'taxi 80', language: 'en', currency: 'ETB' });
    expect(taxi.intent).toBe('CREATE_EXPENSE');
    expect(taxi.amount).toBe('80');
    expect(taxi.categorySlug).toBe('transport');
    expect(taxi.confidence).toBeGreaterThanOrEqual(0.7);
    expect(taxi.missingFields).toEqual([]);

    const withCurrency = parseWithFallback({ text: 'taxi 80 birr', language: 'en', currency: 'ETB' });
    expect(withCurrency.intent).toBe('CREATE_EXPENSE');
    expect(withCurrency.amount).toBe('80');
    expect(withCurrency.categorySlug).toBe('transport');

    const amharic = parseWithFallback({ text: 'ታክሲ 80', language: 'am', currency: 'ETB' });
    expect(amharic.intent).toBe('CREATE_EXPENSE');
    expect(amharic.categorySlug).toBe('transport');

    const lunch = parseWithFallback({ text: 'lunch 350', language: 'en', currency: 'ETB' });
    expect(lunch.intent).toBe('CREATE_EXPENSE');
    expect(lunch.amount).toBe('350');
    expect(lunch.categorySlug).toBe('food');
  });

  it('parses salary shorthand as income', () => {
    const result = parseWithFallback({ text: '40000 salary', language: 'en', currency: 'ETB' });
    expect(result.intent).toBe('CREATE_INCOME');
    expect(result.amount).toBe('40000');
    expect(result.categorySlug).toBe('salary');
  });

  it('parses a person and amount as an IOU owed to the user', () => {
    const result = parseWithFallback({ text: 'Abebe 2000', language: 'en', currency: 'ETB' });
    expect(result.intent).toBe('CREATE_DEBT');
    expect(result.personName).toBe('Abebe');
    expect(result.amount).toBe('2000');
    expect(result.debtType).toBe('OWED_TO_ME');
  });

  it('parses greetings, wellbeing, and balance questions', () => {
    expect(parseWithFallback({ text: 'Hi Birrly', language: 'en', currency: 'ETB' }).intent).toBe('GREET');
    expect(parseWithFallback({ text: 'hello', language: 'en', currency: 'ETB' }).intent).toBe('GREET');
    expect(parseWithFallback({ text: 'how are you', language: 'en', currency: 'ETB' }).intent).toBe('WELLBEING');
    expect(parseWithFallback({ text: 'thanks', language: 'en', currency: 'ETB' }).intent).toBe('THANKS');

    expect(
      parseWithFallback({ text: 'how much money is left', language: 'en', currency: 'ETB' }).intent,
    ).toBe('QUERY_BALANCE');
    expect(parseWithFallback({ text: 'how much is left', language: 'en', currency: 'ETB' }).intent).toBe(
      'QUERY_BALANCE',
    );

    const balance = parseWithFallback({
      text: 'what is my remaining money',
      language: 'en',
      currency: 'ETB',
    });
    expect(balance.intent).toBe('QUERY_BALANCE');

    expect(parseWithFallback({ text: 'ምን ያህል ቀርቷል', language: 'am', currency: 'ETB' }).intent).toBe(
      'QUERY_BALANCE',
    );
  });

  it('parses debt payments, budgets, and savings goals', () => {
    const payment = parseWithFallback({ text: 'Abebe paid 500', language: 'en', currency: 'ETB' });
    expect(payment.intent).toBe('RECORD_DEBT_PAYMENT');
    expect(payment.personName).toBe('Abebe');
    expect(payment.amount).toBe('500');

    const budget = parseWithFallback({ text: 'budget 5000 food', language: 'en', currency: 'ETB' });
    expect(budget.intent).toBe('CREATE_BUDGET');
    expect(budget.amount).toBe('5000');
    expect(budget.categorySlug).toBe('food');

    const savings = parseWithFallback({
      text: 'save 10000 for phone',
      language: 'en',
      currency: 'ETB',
    });
    expect(savings.intent).toBe('CREATE_SAVINGS_GOAL');
    expect(savings.amount).toBe('10000');
    expect(savings.description).toBe('phone');
  });
});
