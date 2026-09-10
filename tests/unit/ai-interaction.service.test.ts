import { describe, expect, it, vi } from 'vitest';
import { AiInteractionService } from '@/modules/ai/ai-interaction.service';
import type { AiInteractionRepository } from '@/modules/ai/ai-interaction.repository';
import type { StructuredCommand } from '@/modules/ai/ai.types';

function command(overrides: Partial<StructuredCommand> = {}): StructuredCommand {
  return {
    intent: 'CREATE_EXPENSE',
    amount: '80',
    categorySlug: 'transport',
    description: 'taxi',
    confidence: 0.9,
    missingFields: [],
    source: 'llm',
    ...overrides,
  } as StructuredCommand;
}

function makeService(enabled: boolean) {
  const repo = {
    create: vi.fn().mockResolvedValue({ id: 'ai-1' }),
    setOutcome: vi.fn().mockResolvedValue(undefined),
  } as unknown as AiInteractionRepository;
  return { service: new AiInteractionService(repo, enabled), repo };
}

describe('AiInteractionService', () => {
  it('is a no-op when capture is disabled', async () => {
    const { service, repo } = makeService(false);

    const id = await service.recordParse({
      userId: 'u1',
      inputText: '80 taxi',
      language: 'en',
      command: command(),
      usedLlm: true,
    });
    await service.recordOutcome('ai-1', 'CONFIRMED', command(), command());

    expect(id).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.setOutcome).not.toHaveBeenCalled();
  });

  it('records a parse and returns the new id when enabled', async () => {
    const { service, repo } = makeService(true);

    const id = await service.recordParse({
      userId: 'u1',
      inputText: '80 taxi',
      language: 'en',
      command: command(),
      usedLlm: true,
    });

    expect(id).toBe('ai-1');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', intent: 'CREATE_EXPENSE', provider: 'llm', success: true }),
    );
  });

  it('marks provider rule and success false for an UNKNOWN parse', async () => {
    const { service, repo } = makeService(true);

    await service.recordParse({
      userId: 'u1',
      inputText: '???',
      language: 'en',
      command: command({ intent: 'UNKNOWN', source: 'fallback' }),
      usedLlm: false,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'rule', success: false }),
    );
  });

  it('flags corrected=false when the confirmed command equals the prediction', async () => {
    const { service, repo } = makeService(true);
    const predicted = command();

    await service.recordOutcome('ai-1', 'CONFIRMED', predicted, predicted);

    expect(repo.setOutcome).toHaveBeenCalledWith('ai-1', 'CONFIRMED', false, expect.any(Object));
  });

  it('flags corrected=true when the final command differs from the prediction', async () => {
    const { service, repo } = makeService(true);

    await service.recordOutcome(
      'ai-1',
      'EDITED',
      command({ categorySlug: 'transport' }),
      command({ categorySlug: 'food' }),
    );

    expect(repo.setOutcome).toHaveBeenCalledWith('ai-1', 'EDITED', true, expect.any(Object));
  });

  it('skips the outcome write when there is no interaction id', async () => {
    const { service, repo } = makeService(true);

    await service.recordOutcome(null, 'CANCELED');

    expect(repo.setOutcome).not.toHaveBeenCalled();
  });

  it('never throws if the repository fails (capture must not break the user action)', async () => {
    const repo = {
      create: vi.fn().mockRejectedValue(new Error('db down')),
      setOutcome: vi.fn().mockRejectedValue(new Error('db down')),
    } as unknown as AiInteractionRepository;
    const service = new AiInteractionService(repo, true);

    await expect(
      service.recordParse({ userId: 'u1', inputText: 'x', language: 'en', command: command(), usedLlm: false }),
    ).resolves.toBeNull();
    await expect(service.recordOutcome('ai-1', 'CONFIRMED', command(), command())).resolves.toBeUndefined();
  });
});
