import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { LlmHttpError } from '@/integrations/llm/llm-error';
import { logger } from '@/shared/logger/logger';

const HASAB_TRANSCRIBE_URL = 'https://api.hasab.ai/api/v1/upload-audio';
const ADDIS_SCRIBE_URL = 'https://api.addisassistant.com/api/v1/scribe/transcribe';
const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TRANSCRIBE_TIMEOUT_MS = 20_000;
const ADDIS_TIMEOUT_MS = 45_000;

export type SpeechConfig = {
  hasabApiKey: string;
  hasabLanguage: string;
  addisApiKey: string;
  addisSttBackend: 'standard' | 'turbo';
  groqApiKey: string;
  whisperModel: string;
  geminiApiKey: string;
  geminiModel: string;
};

function hasabAccepts(mimeType: string): boolean {
  return /mpeg|mp3|wav|mp4|m4a/i.test(mimeType);
}

/** Telegram voice notes are OGG. Hasab accepts WAV, MP3, or M4A. */
export function convertToWav(audio: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 'wav', 'pipe:1']);
    const chunks: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', () => reject(new Error('ffmpeg is required to send voice notes to Hasab.')));
    child.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
        return;
      }
      reject(new Error(stderr.trim() || 'Could not convert the voice note for Hasab.'));
    });
    child.stdin.write(audio);
    child.stdin.end();
  });
}

export class SpeechTranscriber {
  constructor(
    private readonly options: SpeechConfig & { fetchImpl?: typeof fetch },
  ) {}

  isEnabled(): boolean {
    return (
      this.options.hasabApiKey.trim().length > 0 ||
      this.options.addisApiKey.trim().length > 0 ||
      this.options.groqApiKey.trim().length > 0 ||
      this.options.geminiApiKey.trim().length > 0
    );
  }

  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    if (this.options.hasabApiKey.trim()) {
      try {
        return await this.transcribeWithHasab(audio, mimeType);
      } catch (error) {
        logger.warn({ err: error }, 'Hasab transcription failed');
        if (!this.hasBackup('hasab')) {
          throw error;
        }
      }
    }
    if (this.options.addisApiKey.trim()) {
      try {
        return await this.transcribeWithAddis(audio, mimeType);
      } catch (error) {
        logger.warn({ err: error }, 'Addis transcription failed');
        if (!this.hasBackup('addis')) {
          throw error;
        }
      }
    }
    if (this.options.groqApiKey.trim()) {
      return this.transcribeWithGroq(audio, mimeType);
    }
    if (this.options.geminiApiKey.trim()) {
      return this.transcribeWithGemini(audio, mimeType);
    }
    throw new Error('Speech transcription is not configured.');
  }

  private hasBackup(failed: 'hasab' | 'addis'): boolean {
    return (
      (failed === 'hasab' && this.options.addisApiKey.trim().length > 0) ||
      this.options.groqApiKey.trim().length > 0 ||
      this.options.geminiApiKey.trim().length > 0
    );
  }

  private async transcribeWithHasab(audio: Buffer, mimeType: string): Promise<string> {
    let upload = hasabAccepts(mimeType)
      ? { bytes: audio, mimeType, filename: mimeType.includes('wav') ? 'voice.wav' : 'voice.mp3' }
      : { bytes: audio, mimeType, filename: 'voice.ogg' };
    if (!hasabAccepts(mimeType)) {
      try {
        upload = { bytes: await convertToWav(audio), mimeType: 'audio/wav', filename: 'voice.wav' };
      } catch (error) {
        logger.warn({ err: error }, 'Voice conversion failed; sending the original file to Hasab');
      }
    }
    const language = this.options.hasabLanguage.trim() || 'amh';
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(upload.bytes)], { type: upload.mimeType }), upload.filename);
    form.append('transcribe', 'true');
    form.append('translate', 'false');
    form.append('summarize', 'false');
    form.append('is_meeting', 'false');
    form.append('language', language);
    form.append('source_language', language);

    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(HASAB_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.options.hasabApiKey.trim()}` },
      body: form,
      signal: AbortSignal.timeout(ADDIS_TIMEOUT_MS),
    });
    const raw = await response.text();
    let payload: { transcription?: string; audio?: { transcription?: string }; message?: string } = {};
    try {
      payload = JSON.parse(raw) as typeof payload;
    } catch {
      throw new LlmHttpError(raw.slice(0, 180) || `Hasab transcription failed (${response.status})`, response.status || 502);
    }
    const transcript = payload.transcription ?? payload.audio?.transcription;
    if (!response.ok || transcript === undefined) {
      throw new LlmHttpError(payload.message ?? `Hasab transcription failed (${response.status})`, response.status || 502);
    }
    return transcript.trim();
  }

  private async transcribeWithAddis(audio: Buffer, mimeType: string): Promise<string> {
    const extension = mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : 'ogg';
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(audio)], { type: mimeType }), `voice.${extension}`);

    const backend = this.options.addisSttBackend === 'turbo' ? 'turbo' : 'standard';
    const url = `${ADDIS_SCRIBE_URL}?backend=${backend}&request_id=${encodeURIComponent(randomUUID())}`;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'x-api-key': this.options.addisApiKey.trim() },
      body: form,
      signal: AbortSignal.timeout(ADDIS_TIMEOUT_MS),
    });
    const payload = (await response.json()) as {
      data?: { text?: string };
      error?: { message?: string };
      message?: string;
    };
    if (!response.ok) {
      throw new LlmHttpError(
        payload.error?.message ?? payload.message ?? `Addis transcription failed (${response.status})`,
        response.status,
      );
    }
    return payload.data?.text?.trim() ?? '';
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
