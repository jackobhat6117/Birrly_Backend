export type BotCommandDef = {
  command: string;
  description: string;
};

export const BOT_COMMANDS_EN: BotCommandDef[] = [
  { command: 'start', description: 'Welcome & open Birrly' },
  { command: 'dashboard', description: 'This month — income, spend, remaining' },
  { command: 'help', description: 'Commands & how to log spend' },
  { command: 'feedback', description: 'Send product feedback' },
];

export const BOT_COMMANDS_AM: BotCommandDef[] = [
  { command: 'start', description: 'እንኳን ደህና መጡ እና ቢርሊ ክፈት' },
  { command: 'dashboard', description: 'የዚህ ወር ገቢ፣ ወጪ እና የቀረ' },
  { command: 'help', description: 'አዘዞች እና እንዴት መመዝገብ' },
  { command: 'feedback', description: 'አስተያየት ላክ' },
];

export const BOT_DESCRIPTION_EN =
  'Birrly — know what you have left until payday.\n\nLog spend in plain language (80 taxi, Abebe 2000). Open the Mini App for your full picture.\n\nETB · Ethiopia · Not a bank.';

export const BOT_DESCRIPTION_AM =
  'ቢርሊ — እስከ የደመወዝ ቀን ምን እንደቀረ ይወቁ።\n\nወጪዎን በቀላል ቋንቋ ይመዝግቡ (80 ታክሲ፣ Abebe 2000)። ሙሉ ምስል በ Mini App ውስጥ ይመልከቱ።\n\nETB · Ethiopia · Not a bank.';

export const BOT_SHORT_DESCRIPTION_EN = 'Personal finance in Telegram — ETB, payday-aware.';

export const BOT_SHORT_DESCRIPTION_AM = 'በቴሌግራም የግል ገንዘብ — ETB፣ የደመወዝ ቀን።';
