import { describe, expect, it } from 'vitest';
import { escapeHtml, parseSlashCommand } from '@/integrations/telegram/telegram-ui';

describe('parseSlashCommand', () => {
  it('parses command and args', () => {
    expect(parseSlashCommand('/feedback hello world')).toEqual({
      command: 'feedback',
      args: 'hello world',
    });
  });

  it('strips bot username suffix', () => {
    expect(parseSlashCommand('/start@BirrlyBot')).toEqual({ command: 'start', args: '' });
  });

  it('returns null for plain text', () => {
    expect(parseSlashCommand('80 taxi')).toBeNull();
  });
});

describe('escapeHtml', () => {
  it('escapes user-supplied markup', () => {
    expect(escapeHtml('<script>&')).toBe('&lt;script&gt;&amp;');
  });
});
