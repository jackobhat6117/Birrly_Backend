export class LlmHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'LlmHttpError';
  }
}

/** Quota, rate limit, or a transient provider outage — safe to try the next provider. */
export function isRetryableLlmError(error: unknown): boolean {
  if (error instanceof LlmHttpError) {
    return error.status === 429 || error.status === 503 || error.status === 502 || error.status === 504;
  }
  if (error instanceof Error) {
    return /429|resource exhausted|quota|rate limit|unavailable/i.test(error.message);
  }
  return false;
}
