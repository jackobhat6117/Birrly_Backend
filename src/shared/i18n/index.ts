export type MessageKey =
  | 'welcome'
  | 'help'
  | 'askCategory'
  | 'askAmount'
  | 'askPerson'
  | 'askDate'
  | 'confirmExpense'
  | 'confirmIncome'
  | 'confirmDebt'
  | 'confirmReminder'
  | 'recordedExpense'
  | 'recordedIncome'
  | 'recordedDebt'
  | 'recordedReminder'
  | 'cancelled'
  | 'unrecognized'
  | 'aiUnavailable'
  | 'unauthorized'
  | 'internalError'
  | 'languageSet';

const en: Record<MessageKey, string> = {
  welcome:
    'Welcome to your personal finance assistant.\n\nYou can say things like:\n• 80 taxi\n• I spent 350 birr on lunch\n• Abebe 2000\n• Remind me to pay rent on the 1st\n\nOpen the dashboard anytime from the menu.',
  help: 'Send a short line such as “80 taxi” or “Abebe 2000”, or use /dashboard.',
  askCategory: 'What did you spend the {amount} {currency} on?',
  askAmount: 'How much should I record?',
  askPerson: 'Who is this debt with?',
  askDate: 'Which date should I use?',
  confirmExpense: '💸 Record {amount} {currency} for {category}?',
  confirmIncome: '💰 Record {amount} {currency} income as {category}?',
  confirmDebt: '📒 {person} — {amount} {currency}. Save this debt?',
  confirmReminder: '⏰ Remind you: {title} on {date}?',
  recordedExpense: '✓ {amount} {currency} {category} recorded.',
  recordedIncome: '✓ {amount} {currency} income recorded.',
  recordedDebt: '✓ Debt with {person} for {amount} {currency} saved.',
  recordedReminder: '✓ Reminder saved.',
  cancelled: 'Cancelled. Nothing was saved.',
  unrecognized: 'I did not understand that. Try “80 taxi” or “Abebe 2000”.',
  aiUnavailable: 'AI is unavailable. Please enter amount and category, for example: 300 food',
  unauthorized: 'I could not verify this request.',
  internalError: 'Something went wrong. Please try again.',
  languageSet: 'Language set to English.',
};

const am: Record<MessageKey, string> = {
  welcome:
    'እንኳን ደህና መጡ። ወጪዎን በቀላሉ ይመዝግቡ።\n\nለምሳሌ፦\n• 80 ታክሲ\n• Abebe 2000\n• 350 ምሳ',
  help: 'ለምሳሌ ይጻፉ፦ 80 ታክሲ ወይም Abebe 2000',
  askCategory: '{amount} {currency} ለምን አወጡ?',
  askAmount: 'ምን ያህል ልመዘግብ?',
  askPerson: 'ዕዳው ከማን ጋር ነው?',
  askDate: 'የትኛውን ቀን ልጠቀም?',
  confirmExpense: '💸 {amount} {currency} ለ{category} ይመዘገብ?',
  confirmIncome: '💰 {amount} {currency} ገቢ ይመዘገብ?',
  confirmDebt: '📒 {person} — {amount} {currency}። ይቀመጥ?',
  confirmReminder: '⏰ {title} በ{date}?',
  recordedExpense: '✓ {amount} {currency} {category} ተመዝግቧል።',
  recordedIncome: '✓ {amount} {currency} ገቢ ተመዝግቧል።',
  recordedDebt: '✓ ከ{person} ጋር {amount} {currency} ዕዳ ተቀምጧል።',
  recordedReminder: '✓ ማስታወሻ ተቀምጧል።',
  cancelled: 'ተሰርዟል። ምንም አልተቀመጠም።',
  unrecognized: 'አልገባኝም። እንደ “80 ታክሲ” ወይም “Abebe 2000” ይሞክሩ።',
  aiUnavailable: 'AI አይሰራም። መጠንና ምድብ ይጻፉ፦ 300 food',
  unauthorized: 'ጥያቄውን ማረጋገጥ አልተቻለም።',
  internalError: 'ችግር ተፈጥሯል። እንደገና ይሞክሩ።',
  languageSet: 'ቋንቋ ወደ አማርኛ ተቀይሯል።',
};

const catalogs: Record<string, Record<MessageKey, string>> = { en, am };

export function t(
  language: string,
  key: MessageKey,
  vars: Record<string, string | number> = {},
): string {
  const catalog = catalogs[language] ?? en;
  let template = catalog[key] ?? en[key];
  for (const [name, value] of Object.entries(vars)) {
    template = template.replaceAll(`{${name}}`, String(value));
  }
  return template;
}
