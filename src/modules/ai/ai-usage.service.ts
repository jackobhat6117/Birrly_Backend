import type Redis from 'ioredis';

export type AiUsageStatus = {
  unlimited: boolean;
  used: number;
  limit: number;
  remaining: number;
};

export class AiUsageService {
  constructor(
    private readonly redis: Redis,
    private readonly dailyLimit: number,
  ) {}

  private dailyKey(userId: string, day = new Date().toISOString().slice(0, 10)): string {
    return `ai-usage:${userId}:${day}`;
  }

  async getStatus(userId: string, unlimited: boolean): Promise<AiUsageStatus> {
    if (unlimited) {
      return {
        unlimited: true,
        used: 0,
        limit: 0,
        remaining: 0,
      };
    }

    const used = await this.getUsedToday(userId);
    return {
      unlimited: false,
      used,
      limit: this.dailyLimit,
      remaining: Math.max(0, this.dailyLimit - used),
    };
  }

  async getUsedToday(userId: string): Promise<number> {
    const raw = await this.redis.get(this.dailyKey(userId));
    return raw ? Number(raw) : 0;
  }

  async recordSuccessfulLlmParse(userId: string): Promise<number> {
    const key = this.dailyKey(userId);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 86_400);
    }
    return count;
  }

  canUseLlm(status: AiUsageStatus, llmEnabled: boolean): boolean {
    return llmEnabled && (status.unlimited || status.remaining > 0);
  }
}
