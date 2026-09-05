import { describe, expect, it } from 'vitest';
import { buildHelpfulNudge } from '@/integrations/telegram/nudge-message';

describe('helpful nudge', () => {
  it('avoids the old static unrecognized copy', () => {
    const nudge = buildHelpfulNudge('en', 'tell me a joke');
    expect(nudge).not.toContain("I did not understand");
    expect(nudge).not.toMatch(/Try <code>80 taxi<\/code>, <code>Abebe 2000<\/code>/);
  });

  it('picks balance hints when money is mentioned', () => {
    const nudge = buildHelpfulNudge('en', 'what about my cash situation');
    expect(nudge).toMatch(/money is left|remaining money|\/dashboard/i);
  });

  it('picks debt hints when debt is mentioned', () => {
    const nudge = buildHelpfulNudge('en', 'something about my loan with Abebe');
    expect(nudge).toContain('Abebe');
  });

  it('rotates general suggestions for different messages', () => {
    const a = buildHelpfulNudge('en', 'random gibberish alpha');
    const b = buildHelpfulNudge('en', 'random gibberish beta');
    expect(a).not.toBe(b);
  });

  it('supports compact mode for quota messages', () => {
    const nudge = buildHelpfulNudge('en', 'messy sentence', true);
    expect(nudge).toContain('short phrases');
    expect(nudge).not.toContain("I'm not sure about that one");
  });
});
