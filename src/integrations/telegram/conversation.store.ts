import { CONVERSATION_TTL_SECONDS } from '@/shared/constants/app';
import type Redis from 'ioredis';
import type { StructuredCommand } from '@/modules/ai/ai.types';

export type PendingConversation = {
  token: string;
  command: StructuredCommand;
  createdAt: string;
};

export class ConversationStore {
  constructor(private readonly redis: Redis) {}

  async save(userId: string, pending: PendingConversation): Promise<void> {
    const payload = JSON.stringify(pending);
    await this.redis.set(`conversation:${userId}`, payload, 'EX', CONVERSATION_TTL_SECONDS);
    await this.redis.set(`conversation-token:${pending.token}`, userId, 'EX', CONVERSATION_TTL_SECONDS);
  }

  async get(userId: string): Promise<PendingConversation | null> {
    const raw = await this.redis.get(`conversation:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as PendingConversation;
  }

  async getUserIdByToken(token: string): Promise<string | null> {
    return this.redis.get(`conversation-token:${token}`);
  }

  async clear(userId: string): Promise<void> {
    const pending = await this.get(userId);
    await this.redis.del(`conversation:${userId}`);
    if (pending) {
      await this.redis.del(`conversation-token:${pending.token}`);
    }
  }
}
