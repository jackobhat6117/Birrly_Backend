type NudgeTopic = 'balance' | 'spending' | 'debt' | 'budget' | 'savings' | 'income' | 'general';

type NudgeSuggestion = {
  label: string;
  example: string;
};

const EN_INTRO =
  "I'm not sure about that one — here's what Birrly can do for you:\n\n{suggestions}\n\nTap <b>Summary</b> below or type /help for the full guide.";

const AM_INTRO =
  "እርግጠኛ አልሆንኩም — ቢርሊ እነዚህን ሊረዳዎ ይችላል:\n\n{suggestions}\n\n<b>ማጠቃለያ</b> ይጫኑ ወይም /help ይጻፉ።";

const EN_SUGGESTIONS: Record<NudgeTopic, NudgeSuggestion[]> = {
  balance: [
    { label: 'See what is left', example: 'how much money is left' },
    { label: 'This month overview', example: '/dashboard' },
    { label: 'Income vs spent', example: 'what is my remaining money' },
  ],
  spending: [
    { label: 'Log an expense', example: 'I spent 350 on lunch' },
    { label: 'Quick shorthand', example: '80 taxi' },
    { label: 'Category spending', example: 'how much did I spend on food' },
  ],
  debt: [
    { label: 'Track money someone owes you', example: 'Abebe owes me 2000' },
    { label: 'Record a payment', example: 'Abebe paid 500' },
    { label: 'List open debts', example: 'show my debts' },
  ],
  budget: [
    { label: 'Set a monthly budget', example: 'budget 5000 food' },
    { label: 'Category limit', example: 'food budget 5000' },
    { label: 'Check summary', example: '/dashboard' },
  ],
  savings: [
    { label: 'Start a savings goal', example: 'save 10000 for phone' },
    { label: 'Named goal', example: 'phone save 15000' },
    { label: 'See progress in app', example: 'Open Birrly Mini App' },
  ],
  income: [
    { label: 'Record salary', example: '40000 salary' },
    { label: 'Other income', example: 'I received 5000 from freelance' },
    { label: 'Check balance after', example: 'how much money is left' },
  ],
  general: [
    { label: 'Balance until payday', example: 'how much money is left' },
    { label: 'Log spend', example: 'I spent 350 on lunch' },
    { label: 'Month summary', example: '/dashboard' },
    { label: 'Track a debt', example: 'Abebe owes me 2000' },
    { label: 'Set a budget', example: 'budget 5000 food' },
    { label: 'Savings goal', example: 'save 10000 for phone' },
    { label: 'Say hi', example: 'Hi Birrly' },
    { label: 'Mixed Amharic OK', example: '80 ታክሲ' },
  ],
};

const AM_SUGGESTIONS: Record<NudgeTopic, NudgeSuggestion[]> = {
  balance: [
    { label: 'የቀረ ገንዘብ', example: 'how much money is left' },
    { label: 'የወር ማጠቃለያ', example: '/dashboard' },
    { label: 'ገቢ እና ወጪ', example: 'what is my remaining money' },
  ],
  spending: [
    { label: 'ወጪ መዝግብ', example: 'I spent 350 on lunch' },
    { label: 'ቀላል መንገድ', example: '80 ታክሲ' },
    { label: 'በfood ላይ ወጪ', example: 'how much did I spend on food' },
  ],
  debt: [
    { label: 'ዕዳ መዝግብ', example: 'Abebe 2000' },
    { label: 'ክፍያ', example: 'Abebe paid 500' },
    { label: 'ክፍት ዕዳ', example: 'show my debts' },
  ],
  budget: [
    { label: 'ባጀት ሰር', example: 'budget 5000 food' },
    { label: 'food limit', example: 'food budget 5000' },
    { label: 'ማጠቃለያ', example: '/dashboard' },
  ],
  savings: [
    { label: 'ቁሳች ጀምር', example: 'save 10000 for phone' },
    { label: 'phone goal', example: 'phone save 15000' },
    { label: 'Mini App', example: 'Open Birrly' },
  ],
  income: [
    { label: 'ደመወዝ', example: '40000 salary' },
    { label: 'ገቢ', example: 'I received 5000' },
    { label: 'ቀሪ', example: 'how much money is left' },
  ],
  general: [
    { label: 'ቀሪ ገንዘብ', example: 'how much money is left' },
    { label: 'ወጪ', example: '80 taxi' },
    { label: 'ማጠቃለያ', example: '/dashboard' },
    { label: 'ዕዳ', example: 'Abebe 2000' },
    { label: 'ባጀት', example: 'budget 5000 food' },
    { label: 'ቁሳች', example: 'save 10000 for phone' },
  ],
};

function hashText(text: string): number {
  let hash = 0;
  for (const char of text) {
    hash = (hash + char.charCodeAt(0)) % 9973;
  }
  return hash;
}

function detectTopic(text: string): NudgeTopic {
  const lower = text.toLowerCase();

  if (/balance|left|remaining|payday|ቀር|ቀሪ|ገንዘብ|money|cash|birr|etb|ብር/.test(lower + text)) {
    return 'balance';
  }
  if (/budget|limit|ባጀት/.test(lower + text)) {
    return 'budget';
  }
  if (/save|saving|goal|ቁሳች/.test(lower + text)) {
    return 'savings';
  }
  if (/debt|owe|owes|paid|iou|loan|ዕዳ|ክፍ/.test(lower + text)) {
    return 'debt';
  }
  if (/salary|income|earn|received|paid me|ደመወዝ|ገቢ/.test(lower + text)) {
    return 'income';
  }
  if (/spent|spend|expense|buy|bought|cost|paid for|lunch|taxi|food|transport|ወጪ|አወጣ|ገዛ/.test(lower + text)) {
    return 'spending';
  }
  if (/\d/.test(text)) {
    return 'spending';
  }

  return 'general';
}

function pickSuggestions(language: string, topic: NudgeTopic, text: string): NudgeSuggestion[] {
  const pool = (language === 'am' ? AM_SUGGESTIONS : EN_SUGGESTIONS)[topic];
  const count = topic === 'general' ? 3 : 2;
  const offset = hashText(text) % pool.length;

  const picked: NudgeSuggestion[] = [];
  for (let i = 0; i < count; i += 1) {
    picked.push(pool[(offset + i) % pool.length]!);
  }
  return picked;
}

function formatSuggestions(language: string, suggestions: NudgeSuggestion[]): string {
  void language;
  return suggestions
    .map((item) => {
      const example = `<code>${item.example}</code>`;
      return `• ${item.label} — ${example}`;
    })
    .join('\n');
}

export function buildHelpfulNudge(language: string, text = '', compact = false): string {
  const topic = detectTopic(text);
  const suggestions = formatSuggestions(language, pickSuggestions(language, topic, text || 'fallback'));

  if (compact) {
    const lead = language === 'am' ? 'እስከ ነገ ድረስ ቀላል መንገዶች:' : 'You can still use short phrases like these:';
    return `${lead}\n\n${suggestions}`;
  }

  const intro = language === 'am' ? AM_INTRO : EN_INTRO;
  return intro.replace('{suggestions}', suggestions);
}
