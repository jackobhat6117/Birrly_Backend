import { config } from '@/app/config';
import type { AuthenticatedUser } from '@/modules/users/user.types';
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
