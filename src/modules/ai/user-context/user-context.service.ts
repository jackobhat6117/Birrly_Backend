import type Redis from 'ioredis';
import type { RawUserContext, UserContextRepository } from '@/modules/ai/user-context/user-context.repository';
import { logger } from '@/shared/logger/logger';

const CACHE_TTL_SECONDS = 600; // 10 min — derived data, cheap to recompute
const WINDOW_DAYS = 90;
const MAX_HINT_CHARS = 600;

/**
 * The personalization layer (ADR 001, step 3). Assembles a compact per-user
 * profile — frequent categories, merchant→category habits, active goals — and
 * renders it as a prompt hint that conditions the LLM parser on *this* user.
 *
 * Memory + retrieval, not a model per user. Cached in Redis (short TTL); every
 * failure path degrades to "no personalization" so it can never break parsing.
 */
export class UserContextService {
  constructor(
    private readonly repo: UserContextRepository,
    private readonly redis: Redis,
  ) {}

  private cacheKey(userId: string): string {
    return `user-context:${userId}`;
  }

  async get(userId: string): Promise<RawUserContext | null> {
    const key = this.cacheKey(userId);
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as RawUserContext;
      }
    } catch {
      // Cache miss/unavailable — fall through to a fresh load.
    }

    const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const context = await this.repo.load(userId, windowStart);
    if (!context) {
      return null;
    }

    try {
      await this.redis.set(key, JSON.stringify(context), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // Non-fatal — personalization works uncached too.
    }
    return context;
  }

  /**
   * Compact hint block for the LLM parser, or empty string when there's nothing
   * useful yet (a brand-new user). Never throws — personalization is best-effort.
   */
  async getPromptHint(userId: string): Promise<string> {
    try {
      const context = await this.get(userId);
      if (!context) return '';
      return renderPromptHint(context);
    } catch (error) {
      logger.warn({ err: error, userId }, 'Failed to build user context hint');
      return '';
    }
  }

  /** Invalidate after the user's data materially changes (e.g. a new category habit). */
  async invalidate(userId: string): Promise<void> {
    try {
      await this.redis.del(this.cacheKey(userId));
    } catch {
      // ignore
    }
  }
}

export function renderPromptHint(context: RawUserContext): string {
  const lines: string[] = [];
  if (context.frequentCategories.length > 0) {
    lines.push(
      `- Categories this user logs most: ${context.frequentCategories
        .map((c) => c.slug)
        .join(', ')}.`,
    );
  }
  if (context.merchantHints.length > 0) {
    lines.push(
      `- This user's shorthand → category: ${context.merchantHints
        .map((h) => `"${h.term}"→${h.categorySlug}`)
        .join(', ')}.`,
    );
  }
  if (context.activeGoals.length > 0) {
    lines.push(`- Active savings goals: ${context.activeGoals.join(', ')}.`);
  }
  if (context.paydayDay) {
    lines.push(`- Payday is day ${context.paydayDay} of the month.`);
  }

  if (lines.length === 0) {
    return '';
  }

  const block = [
    'Personalization hints (use only to disambiguate; never invent from these):',
    ...lines,
  ].join('\n');

  return block.length > MAX_HINT_CHARS ? block.slice(0, MAX_HINT_CHARS) : block;
}
