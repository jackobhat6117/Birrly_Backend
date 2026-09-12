import { describe, expect, it } from 'vitest';
import { formatReminderMessage } from '@/integrations/telegram/telegram-ui';

describe('formatReminderMessage', () => {
  it('localizes the title label (English)', () => {
    const { title } = formatReminderMessage('en', 'Pay rent');
    expect(title).toContain('Reminder');
  });

  it('localizes the title label (Amharic)', () => {
    const { title } = formatReminderMessage('am', 'Pay rent');
    expect(title).toContain('ማስታወሻ');
  });

  it('includes notes when present', () => {
    const { body } = formatReminderMessage('en', 'Pay rent', 'Landlord: 8000 ETB');
    expect(body).toContain('Pay rent');
    expect(body).toContain('Landlord: 8000 ETB');
  });

  it('omits an empty/whitespace notes line', () => {
    const { body } = formatReminderMessage('en', 'Pay rent', '   ');
    expect(body).toBe('<b>Pay rent</b>');
  });

  it('escapes HTML in user-authored title and notes', () => {
    const { body } = formatReminderMessage('en', '<b>x</b>', 'a & b < c');
    expect(body).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(body).toContain('a &amp; b &lt; c');
  });
});
