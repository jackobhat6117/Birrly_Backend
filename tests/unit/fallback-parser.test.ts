import { describe, expect, it } from 'vitest';
import { parseWithFallback } from '@/modules/ai/parsers/fallback-parser';

describe('fallback parser', () => {
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

  it('parses greetings and balance questions', () => {
    expect(parseWithFallback({ text: 'Hi Birrly', language: 'en', currency: 'ETB' }).intent).toBe('GREET');
    expect(parseWithFallback({ text: 'hello', language: 'en', currency: 'ETB' }).intent).toBe('GREET');
    expect(parseWithFallback({ text: 'thanks', language: 'en', currency: 'ETB' }).intent).toBe('THANKS');

    const balance = parseWithFallback({
      text: 'what is my remaining money',
      language: 'en',
      currency: 'ETB',
    });
    expect(balance.intent).toBe('QUERY_BALANCE');
  });
});
