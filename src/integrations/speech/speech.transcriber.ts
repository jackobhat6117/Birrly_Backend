import { LlmHttpError } from '@/integrations/llm/llm-error';

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TRANSCRIBE_TIMEOUT_MS = 20_000;

export type SpeechConfig = {
  groqApiKey: string;
  whisperModel: string;
  geminiApiKey: string;
  geminiModel: string;
};

export class SpeechTranscriber {
  constructor(
    private readonly options: SpeechConfig & { fetchImpl?: typeof fetch },
  ) {}

  isEnabled(): boolean {
    return this.options.groqApiKey.trim().length > 0 || this.options.geminiApiKey.trim().length > 0;
  }

  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    if (this.options.groqApiKey.trim()) {
      return this.transcribeWithGroq(audio, mimeType);
    }
    if (this.options.geminiApiKey.trim()) {
      return this.transcribeWithGemini(audio, mimeType);
    }
    throw new Error('Speech transcription is not configured.');
  }

  private async transcribeWithGroq(audio: Buffer, mimeType: string): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), 'voice.ogg');
    form.append('model', this.options.whisperModel.trim() || 'whisper-large-v3-turbo');
    form.append(
      'prompt',
      'Personal finance voice note. English, Amharic, or mixed. Keep amounts and names.',
    );

    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.options.groqApiKey.trim()}` },
      body: form,
      signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    });
    const payload = (await response.json()) as { text?: string; error?: { message?: string } };
    if (!response.ok) {
      throw new LlmHttpError(payload.error?.message ?? `Groq transcription failed (${response.status})`, response.status);
    }
    return payload.text?.trim() ?? '';
  }

  private async transcribeWithGemini(audio: Buffer, mimeType: string): Promise<string> {
    const model = this.options.geminiModel.trim() || 'gemini-3.5-flash-lite';
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.options.geminiApiKey.trim())}`;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Transcribe this voice note exactly. The speaker may use English, Amharic, or both. Return only the spoken words.',
              },
              { inlineData: { mimeType, data: audio.toString('base64') } },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1024,
          ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'minimal' as const } } : {}),
        },
      }),
      signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    });
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new LlmHttpError(payload.error?.message ?? `Gemini transcription failed (${response.status})`, response.status);
    }
    return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
  }
}
