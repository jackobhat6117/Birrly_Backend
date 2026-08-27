import { describe, expect, it } from 'vitest';
import { parseDateInput } from '@/shared/utils/dates';

describe('parseDateInput', () => {
  it('parses ISO dates as calendar dates in UTC', () => {
    const date = parseDateInput('2026-09-01', 'Africa/Addis_Ababa');
    expect(date.toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  it('parses month names', () => {
    const date = parseDateInput('September 1', 'Africa/Addis_Ababa');
    expect(date.getUTCMonth()).toBe(8);
    expect(date.getUTCDate()).toBe(1);
  });
});
