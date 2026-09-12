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
  | 'upgradeButton'
  | 'btnDashboard'
  | 'btnHelp'
  | 'confirmButton'
  | 'cancelButton'
  | 'callbackSaved'
  | 'callbackCancelled'
  | 'callbackExpired'
  | 'callbackError'
  | 'equbJoinNotFound'
  | 'equbJoinAlready'
  | 'equbJoinFull'
  | 'equbJoinPick'
  | 'equbJoinedToast'
  | 'equbJoinedConfirm'
  | 'coachTitle'
  | 'coachPremiumOnly'
  | 'coachUnavailable'
  | 'coachScore'
  | 'coachRecurring'
  | 'coachDisclaimer'
  | 'digestTitle'
  | 'digestFigures'
  | 'digestHighlights'
  | 'digestCoachTip'
  | 'digestFooter'
  | 'reminderNotificationTitle'
  | 'debtLent'
  | 'debtBorrowed';

const en: Record<MessageKey, string> = {
  welcome:
    '<b>Birrly</b> · Personal finance in Telegram\n\nHi {name}! Log spend in plain language and see what is left until payday in the Mini App.\n\n<b>Try saying</b>\n• <code>80 taxi</code>\n• <code>350 lunch</code>\n• <code>Abebe 2000</code>\n• <code>Remind me rent on the 1st</code>\n\nTap <b>Open Birrly</b> below or type /help for commands.',
  help:
    '<b>Commands</b>\n/start — Welcome\n/dashboard — This month summary\n/coach — Money Coach (Premium)\n/help — This guide\n/feedback — Send feedback\n\n<b>Natural language</b>\nWrite full sentences — Birrly understands Amharic, English, and mixed messages.\n• Free: {limit} AI parses per day\n• Premium: unlimited\n\n<b>Examples</b>\n• <code>Hi Birrly</code> — greet\n• <code>how are you</code> — small talk\n• <code>how much money is left</code> — balance\n• <code>I spent 350 on lunch today</code>\n• <code>80 taxi</code> / <code>80 ታክሲ</code>\n• <code>Abebe owes me 2000</code>\n• <code>Abebe paid 500</code> — debt payment\n• <code>budget 5000 food</code> — set budget\n• <code>save 10000 for phone</code> — savings goal\n\n<b>Not a bank</b> — Birrly never reads your bank or guesses balances.',
  dashboardMessage:
    '<b>This month</b>\n\n💰 Income\n<code>{income} {currency}</code>\n\n💸 Expenses\n<code>{expenses} {currency}</code>\n\n✨ Remaining until payday\n<code>{remaining} {currency}</code>\n\nOpen the Mini App for categories, debts, and budgets.',
  balanceMessage:
    '<b>Remaining until payday</b>\n<code>{remaining} {currency}</code>\n\n💰 Income <code>{income} {currency}</code>\n💸 Spent <code>{expenses} {currency}</code>\n\nAsk anytime — or log spend with <code>80 taxi</code>.',
  greetReply:
    'Hi {name}! 👋\n\nI can help you:\n• see <b>remaining money</b> — try <code>how much money is left</code>\n• <b>log spend</b> — <code>80 taxi</code> or <code>I spent 350 on lunch</code>\n• track <b>debts</b> — <code>Abebe 2000</code>\n\nTap a button below or type /help.',
  wellbeingReply:
    'Doing well, thanks for asking! 🙂\n\nI am Birrly — your finance helper. Ask <code>how much money is left</code>, log <code>80 taxi</code>, or tap a button below.',
  thanksReply: 'You are welcome! 🙂 Need anything else? Try <code>/dashboard</code> or log a quick expense.',
  debtsTitle: '<b>Lent &amp; borrowed</b>',
  debtsEmpty: '<b>Lent &amp; borrowed</b>\n\nNothing outstanding right now. 🎉',
  askCategory: 'What did you spend the <code>{amount} {currency}</code> on?\n\nExample: <code>350 food</code>',
  askAmount: 'How much should I record?',
  askPerson: 'Who is this debt with?',
  askDate: 'Which date should I use?',
  confirmExpense: '💸 Record <code>{amount} {currency}</code> for <b>{category}</b>?',
  confirmIncome: '💰 Record <code>{amount} {currency}</code> income as <b>{category}</b>?',
  confirmDebt: '📒 <b>{direction}</b>\n{person} — <code>{amount} {currency}</code>\n\nSave this?',
  confirmReminder: '⏰ Remind you: <b>{title}</b>\n📅 {date}',
  confirmBudget: '📊 Set <b>{category}</b> budget to <code>{amount} {currency}</code> this month?',
  confirmSavingsGoal: '🎯 Savings goal <b>{goal}</b> — target <code>{amount} {currency}</code>?',
  confirmDebtPayment: '💳 Record <code>{amount} {currency}</code> payment from <b>{person}</b>?',
  recordedExpense: '✓ <code>{amount} {currency}</code> for {category} recorded.',
  recordedIncome: '✓ <code>{amount} {currency}</code> income recorded.',
  recordedDebt: '✓ {direction}: <b>{person}</b> — <code>{amount} {currency}</code> saved.',
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
    "You've used your <b>{limit}</b> free AI messages for today — it resets tomorrow. 💡 You can still log anytime with shorthand like <code>80 taxi</code> or <code>Abebe 2000</code>.\n\nWant to chat in full sentences without limits? Upgrade to Premium for unlimited AI.",
  unauthorized: 'I could not verify this request.',
  internalError: 'Something went wrong. Please try again.',
  languageSet: 'Language set to English.',
  feedbackPrompt:
    '<b>Send feedback</b>\n\nReply with:\n<code>/feedback your message here</code>\n\nExample:\n<code>/feedback The dashboard is confusing</code>',
  feedbackReceived: 'Thanks — your feedback was received. We read every message. 🙏',
  openAppButton: '📱 Open Birrly',
  upgradeButton: '⭐ Upgrade to Premium',
  btnDashboard: '📊 Summary',
  btnHelp: '❓ Help',
  confirmButton: '✓ Confirm',
  cancelButton: 'Cancel',
  callbackSaved: 'Saved',
  callbackCancelled: 'Cancelled',
  callbackExpired: 'This confirmation expired.',
  callbackError: 'Could not save',
  equbJoinNotFound: 'This Equb invite link is no longer valid.',
  equbJoinAlready: "You're already in <b>{equb}</b> as {name}.",
  equbJoinFull: 'Everyone in <b>{equb}</b> has already joined.',
  equbJoinPick: "You're joining <b>{equb}</b>. Which member are you?",
  equbJoinedToast: 'Joined',
  equbJoinedConfirm: "You're in. You'll get a message here when a contribution is due or it's your turn to collect.",
  coachTitle: '🧭 <b>Money Coach</b> · {lens}',
  coachPremiumOnly: 'The Money Coach is a Premium feature. Upgrade in the Mini App to get a personalized read of your cash flow, leaks, and a monthly audit.',
  coachUnavailable: 'Your coach is warming up — log a bit more this month and try again. (It also needs Premium AI enabled.)',
  coachScore: '📊 Health score: <b>{score}</b>/100',
  coachRecurring: '🔁 Recurring / year: <b>{amount} {currency}</b>',
  coachDisclaimer: 'A look at your own logged spending — not financial advice.',
  digestTitle: '📊 <b>Your monthly summary</b> · {period}',
  digestFigures:
    '💰 Income <code>{income} {currency}</code>\n💸 Expenses <code>{expenses} {currency}</code>\n✨ Saved <code>{savings} {currency}</code> ({rate}%)',
  digestHighlights: '\n<b>Highlights</b>',
  digestCoachTip: '\n💡 {tip}',
  digestFooter: '\nOpen Birrly for the full report.',
  reminderNotificationTitle: '⏰ <b>Reminder</b>',
  debtLent: 'You lent',
  debtBorrowed: 'You borrowed',
};

const am: Record<MessageKey, string> = {
  welcome:
    '<b>ቢርሊ</b> · በቴሌግራም የግል ገንዘብ\n\nሰላም {name}! ወጪዎን በቀላል ቋንቋ ይመዝግቡ። እስከ የደመወዝ ቀን የቀረውን በ Mini App ይመልከቱ።\n\n<b>ለምሳሌ</b>\n• <code>80 ታክሲ</code>\n• <code>350 ምሳ</code>\n• <code>Abebe 2000</code>\n\n<b>ቢርሊ ክፈት</b> ይጫኑ ወይም /help ይጻፉ።',
  help:
    '<b>አዘዞች</b>\n/start — እንኳን ደህና መጡ\n/dashboard — የዚህ ወር ማጠቃለያ\n/coach — የገንዘብ አማካሪ (ፕሪሚየም)\n/help — ይህ መመሪያ\n/feedback — አስተያየት\n\n<b>ተፈጥሯዊ ቋንቋ</b>\nሙሉ ዓረፍተ ነገር ይጻፉ።\n• ነፃ፦ ቀንበር {limit} AI\n• ፕሪሚየም፦ ገደብ የለም\n\n<b>ባንክ አይደለም</b> — ቢርሊ ባንክዎን አይከፍትም።',
  dashboardMessage:
    '<b>የዚህ ወር</b>\n\n💰 ገቢ\n<code>{income} {currency}</code>\n\n💸 ወጪ\n<code>{expenses} {currency}</code>\n\n✨ እስከ payday\n<code>{remaining} {currency}</code>',
  balanceMessage:
    '<b>እስከ payday የቀረ</b>\n<code>{remaining} {currency}</code>\n\n💰 ገቢ <code>{income} {currency}</code>\n💸 ወጪ <code>{expenses} {currency}</code>',
  greetReply:
    'ሰላም {name}! 👋\n\n• የቀረ ገንዘብ — <code>how much money is left</code>\n• ወጪ — <code>80 taxi</code>\n• ዕዳ — <code>Abebe 2000</code>\n\nከታች ያለውን ቁልፍ ይጫኑ ወይም /help ይጻፉ።',
  wellbeingReply:
    'በጣም ደህና ነኝ — አመሰግናለሁ! 🙂\n\nእኔ ቢርሊ ነኝ። <code>how much money is left</code> ይጠይቁ ወይም <code>80 taxi</code> ይጻፉ።',
  thanksReply: 'አይደለም! 🙂 ሌላ ነገር ከፈለጉ <code>/dashboard</code> ይሞክሩ።',
  debtsTitle: '<b>ያበደሩት እና የተበደሩት</b>',
  debtsEmpty: '<b>ያበደሩት እና የተበደሩት</b>\n\nአሁን ምንም የለም። 🎉',
  askCategory: '<code>{amount} {currency}</code> ለምን አወጡ?\n\nለምሳሌ፦ <code>350 food</code>',
  askAmount: 'ምን ያህል ልመዘግብ?',
  askPerson: 'ዕዳው ከማን ጋር ነው?',
  askDate: 'የትኛውን ቀን ልጠቀም?',
  confirmExpense: '💸 <code>{amount} {currency}</code> ለ<b>{category}</b> ይመዘገብ?',
  confirmIncome: '💰 <code>{amount} {currency}</code> ገቢ ለ<b>{category}</b> ይመዘገብ?',
  confirmDebt: '📒 <b>{direction}</b>\n{person} — <code>{amount} {currency}</code>\n\nይቀመጥ?',
  confirmReminder: '⏰ <b>{title}</b>\n📅 {date}',
  confirmBudget: '📊 <b>{category}</b> በዚህ ወር <code>{amount} {currency}</code> ባጀት?',
  confirmSavingsGoal: '🎯 <b>{goal}</b> — <code>{amount} {currency}</code> ቁሳች?',
  confirmDebtPayment: '💳 ከ<b>{person}</b> <code>{amount} {currency}</code> ክፍያ ይመዘገብ?',
  recordedExpense: '✓ <code>{amount} {currency}</code> {category} ተመዝግቧል።',
  recordedIncome: '✓ <code>{amount} {currency}</code> ገቢ ተመዝግቧል።',
  recordedDebt: '✓ {direction}: <b>{person}</b> — <code>{amount} {currency}</code> ተቀምጧል።',
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
    'ለዛሬ <b>{limit}</b> ነፃ AI መልእክቶች ጨርሰዋል — ነገ እንደገና ይጀምራል። 💡 እንደ <code>80 taxi</code> ወይም <code>Abebe 2000</code> ባሉ አጭር መንገዶች መመዝገብ ይችላሉ።\n\nበሙሉ ዓረፍተ ነገር ያለ ገደብ ማውራት ይፈልጋሉ? ላልተገደበ AI ወደ ፕሪሚየም ይሻሻሉ።',
  unauthorized: 'ጥያቄውን ማረጋገጥ አልተቻለም።',
  internalError: 'ችግር ተፈጥሯል። እንደገና ይሞክሩ።',
  languageSet: 'ቋንቋ ወደ አማርኛ ተቀይሯል።',
  feedbackPrompt: '<b>አስተያየት</b>\n\n<code>/feedback መልእክትዎ</code> ይላኩ',
  feedbackReceived: 'አመሰግናለሁ — አስተያየትዎ ተቀብሏል። 🙏',
  openAppButton: '📱 ቢርሊ ክፈት',
  upgradeButton: '⭐ ወደ ፕሪሚየም ይሻሻሉ',
  btnDashboard: '📊 ማጠቃለያ',
  btnHelp: '❓ መረጃ',
  confirmButton: '✓ አረጋግጥ',
  cancelButton: 'ሰርዝ',
  callbackSaved: 'ተቀምጧል',
  callbackCancelled: 'ተሰርዟል',
  callbackExpired: 'ጊዜው አልፏል።',
  callbackError: 'መቀመጥ አልተቻለም',
  equbJoinNotFound: 'ይህ የእቁብ መጋበዣ ሊንክ ከእንግዲህ አይሰራም።',
  equbJoinAlready: 'በ<b>{equb}</b> ውስጥ እንደ {name} አስቀድመው አሉ።',
  equbJoinFull: 'ሁሉም የ<b>{equb}</b> አባላት አስቀድመው ተቀላቅለዋል።',
  equbJoinPick: '<b>{equb}</b> እየተቀላቀሉ ነው። የትኛው አባል ነዎት?',
  equbJoinedToast: 'ተቀላቅለዋል',
  equbJoinedConfirm: 'ተቀላቅለዋል። መዋጮ ሲደርስ ወይም የመቀበል ተራዎ ሲሆን እዚህ መልእክት ይደርስዎታል።',
  coachTitle: '🧭 <b>የገንዘብ አማካሪ</b> · {lens}',
  coachPremiumOnly: 'የገንዘብ አማካሪ የፕሪሚየም አገልግሎት ነው። የገንዘብ ፍሰትዎን፣ መፍሰሻዎችን እና ወርሃዊ ግምገማ ለማግኘት በ Mini App ይሻሻሉ።',
  coachUnavailable: 'አማካሪዎ በዝግጅት ላይ ነው — በዚህ ወር ትንሽ ተጨማሪ መዝግበው እንደገና ይሞክሩ። (ፕሪሚየም AI መንቃት አለበት።)',
  coachScore: '📊 የጤና ነጥብ: <b>{score}</b>/100',
  coachRecurring: '🔁 ተደጋጋሚ / ዓመት: <b>{amount} {currency}</b>',
  coachDisclaimer: 'የራስዎን የወጪ መዝገብ ዕይታ ነው — የገንዘብ ምክር አይደለም።',
  digestTitle: '📊 <b>የወርሃዊ ማጠቃለያ</b> · {period}',
  digestFigures:
    '💰 ገቢ <code>{income} {currency}</code>\n💸 ወጪ <code>{expenses} {currency}</code>\n✨ ቁጠባ <code>{savings} {currency}</code> ({rate}%)',
  digestHighlights: '\n<b>ዋና ነጥቦች</b>',
  digestCoachTip: '\n💡 {tip}',
  digestFooter: '\nሙሉ ሪፖርት ለማየት ቢርሊ ይክፈቱ።',
  reminderNotificationTitle: '⏰ <b>ማስታወሻ</b>',
  debtLent: 'ያበደሩት',
  debtBorrowed: 'የተበደሩት',
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
