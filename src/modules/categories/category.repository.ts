import type { CategoryKind, TransactionType } from '@prisma/client';
import type { DbClient } from '@/database/prisma';

export class CategoryRepository {
  constructor(private readonly db: DbClient) {}

  async listForUser(userId: string) {
    return this.db.category.findMany({
      where: {
        OR: [{ isSystem: true, userId: null }, { userId }],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async findByIdForUser(id: string, userId: string) {
    return this.db.category.findFirst({
      where: {
        id,
        OR: [{ isSystem: true, userId: null }, { userId }],
      },
    });
  }

  async findBySlug(slug: string, userId: string, type?: TransactionType) {
    const kinds: CategoryKind[] = type ? [type, 'BOTH'] : ['EXPENSE', 'INCOME', 'BOTH'];
    return this.db.category.findFirst({
      where: {
        slug,
        kind: { in: kinds },
        OR: [{ isSystem: true, userId: null }, { userId }],
      },
    });
  }

  async findBySlugForUser(slug: string, userId: string) {
    return this.db.category.findFirst({
      where: {
        slug,
        OR: [{ isSystem: true, userId: null }, { userId }],
      },
    });
  }

  async create(data: { userId: string; name: string; slug: string; kind: CategoryKind }) {
    return this.db.category.create({
      data: {
        userId: data.userId,
        name: data.name,
        slug: data.slug,
        kind: data.kind,
        isSystem: false,
      },
    });
  }
}
