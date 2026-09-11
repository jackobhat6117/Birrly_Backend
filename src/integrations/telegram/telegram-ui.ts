import { config } from '@/app/config';
import type { AuthenticatedUser } from '@/modules/users/user.types';
import type { CoachAnalysisDto } from '@/modules/coach/coach.types';
import { t, type MessageKey } from '@/shared/i18n';

export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function parseSlashCommand(
  text: string,
): { command: string; args: string } | null {
  const match = text.trim().match(/^\/(\w+)(?:@\S*)?(?:\s+(.*))?$/i);
  if (!match?.[1]) return null;
  return { command: match[1].toLowerCase(), args: (match[2] ?? '').trim() };
}

type DashboardNumbers = {
  income: string;
  expenses: string;
  remaining: string;
};

export function formatBalanceMessage(
  user: AuthenticatedUser,
  dashboard: DashboardNumbers,
): string {
  return t(user.language, 'balanceMessage', {
    remaining: escapeHtml(dashboard.remaining),
    income: escapeHtml(dashboard.income),
    expenses: escapeHtml(dashboard.expenses),
    currency: escapeHtml(user.currency),
  });
}

export function formatDashboardMessage(
  user: AuthenticatedUser,
  dashboard: DashboardNumbers,
): string {
  return t(user.language, 'dashboardMessage', {
    name: escapeHtml(user.firstName ?? 'there'),
    income: escapeHtml(dashboard.income),
    expenses: escapeHtml(dashboard.expenses),
    remaining: escapeHtml(dashboard.remaining),
    currency: escapeHtml(user.currency),
  });
}

const COACH_LENS_LABEL: Record<string, { en: string; am: string }> = {
  cashflow: { en: 'Cash flow', am: 'የገንዘብ ፍሰት' },
  leaks: { en: 'Money leaks', am: 'የገንዘብ መፍሰሻ' },
  audit: { en: 'Audit', am: 'ግምገማ' },
};

const COACH_TONE_MARK: Record<string, string> = {
  positive: '🟢',
  neutral: '🔵',
  warning: '🟠',
};

/** Renders an AI Money Coach analysis as a Telegram HTML message. The headline
 * and section text arrive already in the user's language (the coach prompt is
 * localized); the labels/score/disclaimer come from i18n. LLM text is escaped. */
export function formatCoachMessage(user: AuthenticatedUser, analysis: CoachAnalysisDto): string {
  const lang = user.language === 'am' ? 'am' : 'en';
  const label = COACH_LENS_LABEL[analysis.lens]?.[lang] ?? analysis.lens;

  const lines: string[] = [
    t(user.language, 'coachTitle', { lens: label }),
    '',
    escapeHtml(analysis.headline),
    '',
    t(user.language, 'coachScore', { score: analysis.metrics.healthScore }),
  ];

  if (analysis.metrics.recurringAnnualCost) {
    lines.push(
      t(user.language, 'coachRecurring', {
        amount: escapeHtml(analysis.metrics.recurringAnnualCost),
        currency: escapeHtml(user.currency),
      }),
    );
  }

  lines.push('');
  for (const section of analysis.sections) {
    const mark = COACH_TONE_MARK[section.tone] ?? '•';
    lines.push(`${mark} <b>${escapeHtml(section.title)}</b> — ${escapeHtml(section.detail)}`);
    if (section.recommendation) {
      lines.push(`   → ${escapeHtml(section.recommendation)}`);
    }
    if (section.impact) {
      lines.push(`   <b>${escapeHtml(section.impact)}</b>`);
    }
  }

  lines.push('');
  lines.push(`<i>${escapeHtml(t(user.language, 'coachDisclaimer'))}</i>`);
  return lines.join('\n');
}

export function formatSpendingMessage(
  user: AuthenticatedUser,
  dashboard: DashboardNumbers & { topCategories: Array<{ name: string; amount: string }> },
  categorySlug?: string,
): string {
  let lines: string[];
  if (categorySlug) {
    const needle = categorySlug.toLowerCase();
    const hit = dashboard.topCategories.find(
      (row) => row.name.toLowerCase().includes(needle) || needle.includes(row.name.toLowerCase()),
    );
    lines = hit
      ? [`• ${escapeHtml(hit.name)}: <code>${escapeHtml(hit.amount)} ${escapeHtml(user.currency)}</code>`]
      : [`• ${escapeHtml(categorySlug)}: <code>0 ${escapeHtml(user.currency)}</code>`];
  } else if (dashboard.topCategories.length > 0) {
    lines = dashboard.topCategories.map(
      (row) => `• ${escapeHtml(row.name)}: <code>${escapeHtml(row.amount)} ${escapeHtml(user.currency)}</code>`,
    );
  } else {
    lines = [`• <code>0 ${escapeHtml(user.currency)}</code>`];
  }

  return t(user.language, 'spendingMessage', {
    lines: lines.join('\n'),
    total: escapeHtml(dashboard.expenses),
    currency: escapeHtml(user.currency),
  });
}

export function formatDebtsMessage(
  user: AuthenticatedUser,
  lines: string[],
): string {
  if (lines.length === 0) {
    return t(user.language, 'debtsEmpty');
  }
  const body = lines.map((line) => `• ${escapeHtml(line)}`).join('\n');
  return `${t(user.language, 'debtsTitle')}\n${body}`;
}

export function confirmKeyboard(language: string, token: string) {
  return {
    inline_keyboard: [
      [
        { text: t(language, 'confirmButton'), callback_data: `ok:${token}` },
        { text: t(language, 'cancelButton'), callback_data: `no:${token}` },
      ],
    ],
  };
}

export function startKeyboard(language: string) {
  const url = config.telegram.miniAppUrl;
  const rows: Array<Array<{ text: string; web_app?: { url: string }; callback_data?: string }>> =
    [];

  if (url) {
    rows.push([{ text: t(language, 'openAppButton'), web_app: { url } }]);
  }

  rows.push([
    { text: t(language, 'btnDashboard'), callback_data: 'cmd:dashboard' },
    { text: t(language, 'btnHelp'), callback_data: 'cmd:help' },
  ]);

  return { inline_keyboard: rows };
}

/** Over-quota upsell keyboard: one-tap into the Mini App to upgrade, plus the
 * usual quick actions. Falls back to quick actions only when no Mini App URL. */
export function upgradeKeyboard(language: string) {
  const url = config.telegram.miniAppUrl;
  const rows: Array<Array<{ text: string; web_app?: { url: string }; callback_data?: string }>> = [];
  if (url) {
    rows.push([{ text: t(language, 'upgradeButton'), web_app: { url } }]);
  }
  rows.push([
    { text: t(language, 'btnDashboard'), callback_data: 'cmd:dashboard' },
    { text: t(language, 'btnHelp'), callback_data: 'cmd:help' },
  ]);
  return { inline_keyboard: rows };
}

export function helpKeyboard(language: string) {
  const url = config.telegram.miniAppUrl;
  if (!url) return undefined;
  return {
    inline_keyboard: [[{ text: t(language, 'openAppButton'), web_app: { url } }]],
  };
}

export function htmlConfirmText(user: AuthenticatedUser, key: MessageKey, vars: Record<string, string>): string {
  const safe = Object.fromEntries(
    Object.entries(vars).map(([name, value]) => [name, escapeHtml(value)]),
  ) as Record<string, string>;
  return t(user.language, key, safe);
}
