import type { MonthlyDigest, DigestTone } from '@/modules/digest/digest.types';
import { t } from '@/shared/i18n';
import { escapeHtml } from '@/integrations/telegram/telegram-ui';

const TONE_MARK: Record<DigestTone, string> = {
  positive: '✅',
  neutral: '•',
  warning: '⚠️',
};

/**
 * Renders a MonthlyDigest into a Telegram message (title + HTML body). All
 * dynamic text (LLM headline/insights/tip) is escaped; the deterministic
 * figures are wrapped in <code>. This is the only place digest content becomes
 * a Telegram string — the domain never formats messages.
 */
export function formatDigestMessage(digest: MonthlyDigest): { title: string; body: string } {
  const lang = digest.language;
  const period = `${digest.period.year}-${String(digest.period.month).padStart(2, '0')}`;

  const title = t(lang, 'digestTitle', { period });

  const lines: string[] = [
    t(lang, 'digestFigures', {
      income: escapeHtml(digest.income),
      expenses: escapeHtml(digest.expenses),
      savings: escapeHtml(digest.savings),
      rate: escapeHtml(digest.savingsRate),
      currency: escapeHtml(digest.currency),
    }),
  ];

  const highlights: string[] = [];
  if (digest.coachHeadline) {
    highlights.push(`✨ <b>${escapeHtml(digest.coachHeadline)}</b>`);
  }
  for (const insight of digest.insights) {
    highlights.push(`${TONE_MARK[insight.tone] ?? '•'} ${escapeHtml(insight.message)}`);
  }
  if (highlights.length > 0) {
    lines.push(t(lang, 'digestHighlights'));
    lines.push(highlights.join('\n'));
  }

  if (digest.coachTip) {
    lines.push(t(lang, 'digestCoachTip', { tip: escapeHtml(digest.coachTip) }));
  }

  lines.push(t(lang, 'digestFooter'));

  return { title, body: lines.join('\n') };
}
