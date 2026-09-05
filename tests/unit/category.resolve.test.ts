import { describe, expect, it, vi } from 'vitest';
import { CategoryService } from '@/modules/categories/category.service';
import type { CategoryRepository } from '@/modules/categories/category.repository';
import type { AuditService } from '@/modules/audit/audit.service';

function makeService(repo: Partial<CategoryRepository>) {
  const audit = { record: vi.fn() } as unknown as AuditService;
  return new CategoryService(repo as CategoryRepository, audit);
}

describe('CategoryService.resolve', () => {
  it('falls back to the system "Other" bucket when no category is supplied', async () => {
    const findBySlug = vi.fn().mockResolvedValue({ id: 'cat-other', slug: 'other-expense', kind: 'EXPENSE' });
    const service = makeService({ findBySlug });

    const result = await service.resolve('user-1', {}, 'EXPENSE');

    expect(findBySlug).toHaveBeenCalledWith('other-expense', 'user-1', 'EXPENSE');
    expect(result.id).toBe('cat-other');
  });

  it('uses the income "Other" bucket for income transactions', async () => {
    const findBySlug = vi.fn().mockResolvedValue({ id: 'cat-other-in', slug: 'other-income', kind: 'INCOME' });
    const service = makeService({ findBySlug });

    await service.resolve('user-1', {}, 'INCOME');

    expect(findBySlug).toHaveBeenCalledWith('other-income', 'user-1', 'INCOME');
  });

  it('still prefers an explicit category over the fallback', async () => {
    const findByIdForUser = vi.fn().mockResolvedValue({ id: 'cat-food', slug: 'food', kind: 'EXPENSE' });
    const findBySlug = vi.fn();
    const service = makeService({ findByIdForUser, findBySlug });

    const result = await service.resolve('user-1', { categoryId: 'cat-food' }, 'EXPENSE');

    expect(result.id).toBe('cat-food');
    expect(findBySlug).not.toHaveBeenCalled();
  });

  it('rejects when the fallback bucket is missing (unseeded database)', async () => {
    const service = makeService({ findBySlug: vi.fn().mockResolvedValue(null) });

    await expect(service.resolve('user-1', {}, 'EXPENSE')).rejects.toThrow('Category is required.');
  });
});
