import { describe, expect, it } from 'vitest';
import { escapeHtml, formatCoachMessage, parseSlashCommand } from '@/integrations/telegram/telegram-ui';
import type { AuthenticatedUser } from '@/modules/users/user.types';
import type { CoachAnalysisDto } from '@/modules/coach/coach.types';

describe('parseSlashCommand', () => {
  it('parses command and args', () => {
    expect(parseSlashCommand('/feedback hello world')).toEqual({
      command: 'feedback',
      args: 'hello world',
    });
  });

  it('strips bot username suffix', () => {
    expect(parseSlashCommand('/start@BirrlyBot')).toEqual({ command: 'start', args: '' });
  });

  it('returns null for plain text', () => {
    expect(parseSlashCommand('80 taxi')).toBeNull();
  });
});

describe('escapeHtml', () => {
  it('escapes user-supplied markup', () => {
    expect(escapeHtml('<script>&')).toBe('&lt;script&gt;&amp;');
  });
});

describe('formatCoachMessage', () => {
  const user = { language: 'en', currency: 'ETB', firstName: 'Eyob' } as AuthenticatedUser;
  const analysis: CoachAnalysisDto = {
    lens: 'leaks',
    period: { year: 2026, month: 9 },
    headline: 'A few small leaks.',
    metrics: {
      income: '40000.00',
      expenses: '20000.00',
      savings: '20000.00',
      savingsRate: '50.00',
      healthScore: 80,
      recurringAnnualCost: '4800.00',
    },
    sections: [
      { title: 'Repeating charges', tone: 'warning', detail: 'Two charges recur.', recommendation: 'Cancel one.', impact: '≈ 4,800 ETB/yr' },
    ],
    disclaimer: 'not advice',
    generatedAt: new Date().toISOString(),
  };

  it('renders the lens label, health score, recurring cost, and section', () => {
    const msg = formatCoachMessage(user, analysis);
    expect(msg).toContain('Money leaks');
    expect(msg).toContain('80');
    expect(msg).toContain('4800.00 ETB');
    expect(msg).toContain('Repeating charges');
    expect(msg).toContain('Cancel one.');
    expect(msg).toContain('not financial advice');
  });

  it('escapes any HTML in the LLM-produced text', () => {
    const msg = formatCoachMessage(user, {
      ...analysis,
      headline: '<b>hi</b> & <script>',
    });
    expect(msg).toContain('&lt;b&gt;hi&lt;/b&gt; &amp; &lt;script&gt;');
  });

  it('omits the recurring line when there is no recurring cost', () => {
    const msg = formatCoachMessage(user, {
      ...analysis,
      metrics: { ...analysis.metrics, recurringAnnualCost: null },
    });
    expect(msg).not.toContain('Recurring / year');
  });
});
