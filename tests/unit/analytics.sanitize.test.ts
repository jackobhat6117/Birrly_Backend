import { describe, expect, it } from 'vitest';
import { sanitizeProductEvents } from '@/modules/analytics/analytics.constants';

describe('sanitizeProductEvents', () => {
  it('keeps allow-listed screen views and features and drops the rest', () => {
    const accepted = sanitizeProductEvents([
      { name: 'SCREEN_VIEW', screen: 'home' },
      { name: 'SCREEN_VIEW', screen: 'wallet' },
      { name: 'FEATURE_USED', screen: 'add_transaction' },
      { name: 'FEATURE_USED', screen: 'hack' },
      { name: 'TOUR_COMPLETED' },
      { name: 'EXPLODE', screen: 'home' },
      { amount: '40000' },
      'nope',
    ]);

    expect(accepted).toEqual([
      { name: 'SCREEN_VIEW', screen: 'home' },
      { name: 'FEATURE_USED', screen: 'add_transaction' },
      { name: 'TOUR_COMPLETED', screen: null },
    ]);
  });

  it('returns an empty list for non-arrays', () => {
    expect(sanitizeProductEvents({ events: [] })).toEqual([]);
  });
});
