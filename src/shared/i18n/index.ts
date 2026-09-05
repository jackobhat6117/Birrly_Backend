export type MessageKey =
  | 'welcome'
  | 'help'
  | 'dashboardMessage'
  | 'balanceMessage'
  | 'greetReply'
  | 'wellbeingReply'
  | 'thanksReply'
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
  | 'confirmBudget'
  | 'confirmSavingsGoal'
  | 'confirmDebtPayment'
  | 'recordedExpense'
  | 'recordedIncome'
  | 'recordedDebt'
  | 'recordedReminder'
  | 'recordedBudget'
  | 'recordedSavingsGoal'
  | 'recordedDebtPayment'
  | 'spendingMessage'
  | 'askGoalName'
  | 'debtNotFound'
  | 'planLimitReached'
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
    '<b>Commands</b>\n/start — Welcome\n/dashboard — This month summary\n/help — This guide\n/feedback — Send feedback\n\n<b>Natural language</b>\nWrite full sentences — Birrly understands Amharic, English, and mixed messages.\n• Free: {limit} AI parses per day\n• Premium: unlimited\n\n<b>Examples</b>\n• <code>Hi Birrly</code> — greet\n• <code>how are you</code> — small talk\n• <code>how much money is left</code> — balance\n• <code>I spent 350 on lunch today</code>\n• <code>80 taxi</code> / <code>80 ታክሲ</code>\n• <code>Abebe owes me 2000</code>\n• <code>Abebe paid 500</code> — debt payment\n• <code>budget 5000 food</code> — set budget\n• <code>save 10000 for phone</code> — savings goal\n\n<b>Not a bank</b> — Birrly never reads your bank or guesses balances.',
  dashboardMessage:
    '<b>This month</b>\n\n💰 Income\n<code>{income} {currency}</code>\n\n💸 Expenses\n<code>{expenses} {currency}</code>\n\n✨ Remaining until payday\n<code>{remaining} {currency}</code>\n\nOpen the Mini App for categories, debts, and budgets.',
  balanceMessage:
    '<b>Remaining until payday</b>\n<code>{remaining} {currency}</code>\n\n💰 Income <code>{income} {currency}</code>\n💸 Spent <code>{expenses} {currency}</code>\n\nAsk anytime — or log spend with <code>80 taxi</code>.',
  greetReply:
    'Hi {name}! 👋\n\nI can help you:\n• see <b>remaining money</b> — try <code>how much money is left</code>\n• <b>log spend</b> — <code>80 taxi</code> or <code>I spent 350 on lunch</code>\n• track <b>debts</b> — <code>Abebe 2000</code>\n\nTap a button below or type /help.',
  wellbeingReply:
    'Doing well, thanks for asking! 🙂\n\nI am Birrly — your finance helper. Ask <code>how much money is left</code>, log <code>80 taxi</code>, or tap a button below.',
  thanksReply: 'You are welcome! 🙂 Need anything else? Try <code>/dashboard</code> or log a quick expense.',
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
  confirmBudget: '📊 Set <b>{category}</b> budget to <code>{amount} {currency}</code> this month?',
  confirmSavingsGoal: '🎯 Savings goal <b>{goal}</b> — target <code>{amount} {currency}</code>?',
  confirmDebtPayment: '💳 Record <code>{amount} {currency}</code> payment from <b>{person}</b>?',
  recordedExpense: '✓ <code>{amount} {currency}</code> for {category} recorded.',
  recordedIncome: '✓ <code>{amount} {currency}</code> income recorded.',
  recordedDebt: '✓ Debt with <b>{person}</b> for <code>{amount} {currency}</code> saved.',
  recordedReminder: '✓ Reminder saved.',
  recordedBudget: '✓ <b>{category}</b> budget set to <code>{amount} {currency}</code>.',
  recordedSavingsGoal: '✓ Savings goal <b>{goal}</b> — <code>{amount} {currency}</code> target saved.',
  recordedDebtPayment: '✓ <code>{amount} {currency}</code> payment from <b>{person}</b> recorded.',
  spendingMessage:
    '<b>Spending this month</b>\n{lines}\n\nTotal expenses <code>{total} {currency}</code>',
  askGoalName: 'What is this savings goal for?\n\nExample: <code>save 10000 for phone</code>',
  debtNotFound: 'No open debt found for <b>{person}</b>. Check with /dashboard or the Mini App.',
  planLimitReached: 'You reached your free plan limit for this feature. Upgrade to Premium or use the Mini App.',
  cancelled: 'Cancelled. Nothing was saved.',
  unrecognized:
    'I did not understand that.\n\nTry <code>80 taxi</code>, <code>Abebe 2000</code>, or /help.',
  aiUnavailable: 'AI is unavailable. Please enter amount and category, for example: <code>300 food</code>',
  aiQuotaExceeded:
    'You have used your <b>{limit}</b> free AI messages for today.\n\nUpgrade to Premium for unlimited natural language, or use the quick options below.',
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
  balanceMessage:
    '<b>እስከ payday የቀረ</b>\n<code>{remaining} {currency}</code>\n\n💰 ገቢ <code>{income} {currency}</code>\n💸 ወጪ <code>{expenses} {currency}</code>',
  greetReply:
    'ሰላም {name}! 👋\n\n• የቀረ ገንዘብ — <code>how much money is left</code>\n• ወጪ — <code>80 taxi</code>\n• ዕዳ — <code>Abebe 2000</code>\n\nከታች ያለውን ቁልፍ ይጫኑ ወይም /help ይጻፉ።',
  wellbeingReply:
    'በጣም ደህና ነኝ — አመሰግናለሁ! 🙂\n\nእኔ ቢርሊ ነኝ። <code>how much money is left</code> ይጠይቁ ወይም <code>80 taxi</code> ይጻፉ።',
  thanksReply: 'አይደለም! 🙂 ሌላ ነገር ከፈለጉ <code>/dashboard</code> ይሞክሩ።',
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
  confirmBudget: '📊 <b>{category}</b> በዚህ ወር <code>{amount} {currency}</code> ባጀት?',
  confirmSavingsGoal: '🎯 <b>{goal}</b> — <code>{amount} {currency}</code> ቁሳች?',
  confirmDebtPayment: '💳 ከ<b>{person}</b> <code>{amount} {currency}</code> ክፍያ ይመዘገብ?',
  recordedExpense: '✓ <code>{amount} {currency}</code> {category} ተመዝግቧል።',
  recordedIncome: '✓ <code>{amount} {currency}</code> ገቢ ተመዝግቧል።',
  recordedDebt: '✓ ከ<b>{person}</b> ጋር <code>{amount} {currency}</code> ዕዳ ተቀምጧል።',
  recordedReminder: '✓ ማስታወሻ ተቀምጧል።',
  recordedBudget: '✓ <b>{category}</b> ባጀት <code>{amount} {currency}</code> ተሰናይቷል።',
  recordedSavingsGoal: '✓ <b>{goal}</b> ቁሳች <code>{amount} {currency}</code> ተቀምጧል።',
  recordedDebtPayment: '✓ ከ<b>{person}</b> <code>{amount} {currency}</code> ክፍያ ተመዝግቧል።',
  spendingMessage: '<b>የዚህ ወር ወጪ</b>\n{lines}\n\nጠቅላላ <code>{total} {currency}</code>',
  askGoalName: 'ቁሳችው ለምንድን ነው?\n\nለምሳሌ፦ <code>save 10000 for phone</code>',
  debtNotFound: 'ለ<b>{person}</b> ክፍት ዕዳ አልተገኘም።',
  planLimitReached: 'ለዚህ ባህሪ የነፃ እቅድ ገደብዎን reached። Premium ይሞክሩ።',
  cancelled: 'ተሰርዟል። ምንም አልተቀመጠም።',
  unrecognized: 'አልገባኝም። <code>80 ታክሲ</code> ወይም /help ይሞክሩ።',
  aiUnavailable: 'AI አይሰራም። <code>300 food</code> ይጻፉ።',
  aiQuotaExceeded:
    'ለዛሬ <b>{limit}</b> ነፃ AI መልእክቶች ጨርሰዋል።\n\nለገደብ የሌለው ፕሪሚየም ይቀይሩ፣ ወይም ከታች ያሉትን ቀላል መንገዶች ይሞክሩ።',
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
