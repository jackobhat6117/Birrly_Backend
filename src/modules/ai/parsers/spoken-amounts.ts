const ONES: Record<string, number> = {
  አንድ: 1,
  ሁለት: 2,
  ሶስት: 3,
  ሦስት: 3,
  አራት: 4,
  አምስት: 5,
  ስድስት: 6,
  ሰባት: 7,
  ስምንት: 8,
  ዘጠኝ: 9,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

const TENS: Record<string, number> = {
  አስር: 10,
  ሃያ: 20,
  ሀያ: 20,
  ሰላሳ: 30,
  አርባ: 40,
  ሃምሳ: 50,
  ሀምሳ: 50,
  ስልሳ: 60,
  ሰባ: 70,
  ሰማንያ: 80,
  ዘጠና: 90,
  ten: 10,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const SCALES: Record<string, number> = {
  መቶ: 100,
  ሺህ: 1000,
  ሺ: 1000,
  hundred: 100,
  thousand: 1000,
};

function tokenValue(token: string): { kind: 'one' | 'ten' | 'scale'; value: number } | undefined {
  const key = token.toLowerCase();
  if (key in ONES) return { kind: 'one', value: ONES[key]! };
  if (key in TENS) return { kind: 'ten', value: TENS[key]! };
  if (key in SCALES) return { kind: 'scale', value: SCALES[key]! };
  return undefined;
}

/** Turns a spoken amount ("ሰማንያ", "eighty", "ሁለት ሺህ") into digits so the rule parser can log it. */
export function replaceSpokenAmounts(text: string): string {
  const tokens = text.trim().split(/\s+/);
  const out: string[] = [];

  for (let i = 0; i < tokens.length; ) {
    const first = tokenValue(tokens[i] ?? '');
    if (!first) {
      out.push(tokens[i]!);
      i += 1;
      continue;
    }

    let total = 0;
    let current = 0;
    let consumed = 0;
    while (i + consumed < tokens.length) {
      const part = tokenValue(tokens[i + consumed] ?? '');
      if (!part) break;
      if (part.kind === 'scale') {
        total += (current || 1) * part.value;
        current = 0;
      } else {
        current += part.value;
      }
      consumed += 1;
    }

    total += current;
    out.push(String(total));
    i += consumed;
  }

  return out.join(' ');
}
