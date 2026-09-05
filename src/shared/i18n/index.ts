export type MessageKey =
  | 'welcome'
  | 'help'
  | 'dashboardMessage'
  | 'debtsTitle'
  | 'debtsEmpty'
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
  | 'languageSet'
  | 'feedbackPrompt'
  | 'feedbackReceived'
  | 'aiQuotaExceeded'
  | 'openAppButton'
  | 'btnDashboard'
  | 'btnHelp'
  | 'confirmButton'
  | 'cancelButton'
  | 'callbackSaved'
  | 'callbackCancelled'
  | 'callbackExpired'
  | 'callbackError';

const en: Record<MessageKey, string> = {
  welcome:
    '<b>Birrly</b> · Personal finance in Telegram\n\nHi {name}! Log spend in plain language and see what is left until payday in the Mini App.\n\n<b>Try saying</b>\n• <code>80 taxi</code>\n• <code>350 lunch</code>\n• <code>Abebe 2000</code>\n• <code>Remind me rent on the 1st</code>\n\nTap <b>Open Birrly</b> below or type /help for commands.',
  help:
    '<b>Commands</b>\n/start — Welcome\n/dashboard — This month summary\n/help — This guide\n/feedback — Send feedback\n\n<b>Natural language</b>\nWrite full sentences — Birrly understands Amharic, English, and mixed messages.\n• Free: {limit} AI parses per day\n• Premium: unlimited\n\n<b>Examples</b>\n• <code>I spent 350 on lunch today</code>\n• <code>80 taxi</code>\n• <code>Abebe owes me 2000</code>\n\n<b>Not a bank</b> — Birrly never reads your bank or guesses balances.',
  dashboardMessage:
    '<b>This month</b>\n\n💰 Income\n<code>{income} {currency}</code>\n\n💸 Expenses\n<code>{expenses} {currency}</code>\n\n✨ Remaining until payday\n<code>{remaining} {currency}</code>\n\nOpen the Mini App for categories, debts, and budgets.',
  debtsTitle: '<b>Open debts</b>',
  debtsEmpty: '<b>Open debts</b>\n\nNone right now. 🎉',
  askCategory: 'What did you spend the <code>{amount} {currency}</code> on?\n\nExample: <code>350 food</code>',
  askAmount: 'How much should I record?',
  askPerson: 'Who is this debt with?',
  askDate: 'Which date should I use?',
  confirmExpense: '💸 Record <code>{amount} {currency}</code> for <b>{category}</b>?',
  confirmIncome: '💰 Record <code>{amount} {currency}</code> income as <b>{category}</b>?',
  confirmDebt: '📒 <b>{person}</b> — <code>{amount} {currency}</code>\n\nSave this debt?',
  confirmReminder: '⏰ Remind you: <b>{title}</b>\n📅 {date}',
  recordedExpense: '✓ <code>{amount} {currency}</code> for {category} recorded.',
  recordedIncome: '✓ <code>{amount} {currency}</code> income recorded.',
  recordedDebt: '✓ Debt with <b>{person}</b> for <code>{amount} {currency}</code> saved.',
  recordedReminder: '✓ Reminder saved.',
  cancelled: 'Cancelled. Nothing was saved.',
  unrecognized:
    'I did not understand that.\n\nTry <code>80 taxi</code>, <code>Abebe 2000</code>, or /help.',
  aiUnavailable: 'AI is unavailable. Please enter amount and category, for example: <code>300 food</code>',
  aiQuotaExceeded:
    'You have used your <b>{limit}</b> free AI messages for today.\n\nTry a short line like <code>80 taxi</code>, or upgrade to Premium for unlimited natural language.',
  unauthorized: 'I could not verify this request.',
  internalError: 'Something went wrong. Please try again.',
  languageSet: 'Language set to English.',
  feedbackPrompt:
    '<b>Send feedback</b>\n\nReply with:\n<code>/feedback your message here</code>\n\nExample:\n<code>/feedback The dashboard is confusing</code>',
  feedbackReceived: 'Thanks — your feedback was received. We read every message. 🙏',
  openAppButton: '📱 Open Birrly',
  btnDashboard: '📊 Summary',
  btnHelp: '❓ Help',
  confirmButton: '✓ Confirm',
  cancelButton: 'Cancel',
  callbackSaved: 'Saved',
  callbackCancelled: 'Cancelled',
  callbackExpired: 'This confirmation expired.',
  callbackError: 'Could not save',
};

const am: Record<MessageKey, string> = {
  welcome:
    '<b>ቢርሊ</b> · በቴሌግራም የግል ገንዘብ\n\nሰላም {name}! ወጪዎን በቀላል ቋንቋ ይመዝግቡ። እስከ የደመወዝ ቀን የቀረውን በ Mini App ይመልከቱ።\n\n<b>ለምሳሌ</b>\n• <code>80 ታክሲ</code>\n• <code>350 ምሳ</code>\n• <code>Abebe 2000</code>\n\n<b>ቢርሊ ክፈት</b> ይጫኑ ወይም /help ይጻፉ።',
  help:
    '<b>አዘዞች</b>\n/start — እንኳን ደህና መጡ\n/dashboard — የዚህ ወር ማጠቃለያ\n/help — ይህ መመሪያ\n/feedback — አስተያየት\n\n<b>ተፈጥሯዊ ቋንቋ</b>\nሙሉ ዓረፍተ ነገር ይጻፉ።\n• ነፃ፦ ቀንበር {limit} AI\n• ፕሪሚየም፦ ገደብ የለም\n\n<b>ባንክ አይደለም</b> — ቢርሊ ባንክዎን አይከፍትም።',
  dashboardMessage:
    '<b>የዚህ ወር</b>\n\n💰 ገቢ\n<code>{income} {currency}</code>\n\n💸 ወጪ\n<code>{expenses} {currency}</code>\n\n✨ እስከ payday\n<code>{remaining} {currency}</code>',
  debtsTitle: '<b>ክፍት ዕዳዎች</b>',
  debtsEmpty: '<b>ክፍት ዕዳዎች</b>\n\nአሁን የለም። 🎉',
  askCategory: '<code>{amount} {currency}</code> ለምን አወጡ?\n\nለምሳሌ፦ <code>350 food</code>',
  askAmount: 'ምን ያህል ልመዘግብ?',
  askPerson: 'ዕዳው ከማን ጋር ነው?',
  askDate: 'የትኛውን ቀን ልጠቀም?',
  confirmExpense: '💸 <code>{amount} {currency}</code> ለ<b>{category}</b> ይመዘገብ?',
  confirmIncome: '💰 <code>{amount} {currency}</code> ገቢ ለ<b>{category}</b> ይመዘገብ?',
  confirmDebt: '📒 <b>{person}</b> — <code>{amount} {currency}</code>\n\nይቀመጥ?',
  confirmReminder: '⏰ <b>{title}</b>\n📅 {date}',
  recordedExpense: '✓ <code>{amount} {currency}</code> {category} ተመዝግቧል።',
  recordedIncome: '✓ <code>{amount} {currency}</code> ገቢ ተመዝግቧል።',
  recordedDebt: '✓ ከ<b>{person}</b> ጋር <code>{amount} {currency}</code> ዕዳ ተቀምጧል።',
  recordedReminder: '✓ ማስታወሻ ተቀምጧል።',
  cancelled: 'ተሰርዟል። ምንም አልተቀመጠም።',
  unrecognized: 'አልገባኝም። <code>80 ታክሲ</code> ወይም /help ይሞክሩ።',
  aiUnavailable: 'AI አይሰራም። <code>300 food</code> ይጻፉ።',
  aiQuotaExceeded:
    'ለዛሬ <b>{limit}</b> ነፃ AI መልእክቶች ጨርሰዋል።\n\n<code>80 taxi</code> ይሞክሩ ወይም ለገደብ የሌለው ፕሪሚየም ይቀይሩ።',
  unauthorized: 'ጥያቄውን ማረጋገጥ አልተቻለም።',
  internalError: 'ችግር ተፈጥሯል። እንደገና ይሞክሩ።',
  languageSet: 'ቋንቋ ወደ አማርኛ ተቀይሯል።',
  feedbackPrompt: '<b>አስተያየት</b>\n\n<code>/feedback መልእክትዎ</code> ይላኩ',
  feedbackReceived: 'አመሰግናለሁ — አስተያየትዎ ተቀብሏል። 🙏',
  openAppButton: '📱 ቢርሊ ክፈት',
  btnDashboard: '📊 ማጠቃለያ',
  btnHelp: '❓ መረጃ',
  confirmButton: '✓ አረጋግጥ',
  cancelButton: 'ሰርዝ',
  callbackSaved: 'ተቀምጧል',
  callbackCancelled: 'ተሰርዟል',
  callbackExpired: 'ጊዜው አልፏል።',
  callbackError: 'መቀመጥ አልተቻለም',
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
