import { describe, expect, it, vi } from 'vitest';
import { SpeechTranscriber } from '@/integrations/speech/speech.transcriber';

const base = {
  groqApiKey: '',
  whisperModel: 'whisper-large-v3-turbo',
  geminiApiKey: '',
  geminiModel: 'gemini-3.5-flash-lite',
};

describe('SpeechTranscriber', () => {
  it('is disabled without a Groq or Gemini key', () => {
    expect(new SpeechTranscriber(base).isEnabled()).toBe(false);
  });

  it('sends a voice note to Groq Whisper when a Groq key is set', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(String(init?.headers && (init.headers as Record<string, string>).Authorization)).toContain('Bearer groq');
      expect(init?.body).toBeInstanceOf(FormData);
      return { ok: true, status: 200, json: async () => ({ text: '80 taxi' }) };
    });

    const text = await new SpeechTranscriber({
      ...base,
      groqApiKey: 'groq',
      geminiApiKey: 'gemini',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).transcribe(Buffer.from('audio'), 'audio/ogg');

    expect(text).toBe('80 taxi');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('uses Gemini audio when only a Gemini key is set', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '350 lunch' }] } }] }),
    }));

    const text = await new SpeechTranscriber({
      ...base,
      geminiApiKey: 'gemini',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).transcribe(Buffer.from('audio'), 'audio/ogg');

    expect(text).toBe('350 lunch');
  });
});
