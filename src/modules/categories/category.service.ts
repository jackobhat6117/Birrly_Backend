import type { CategoryKind, TransactionType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { AppError, ConflictError, ERROR_CODE } from '@/shared/errors/app-error';
import type { AuditService } from '@/modules/audit/audit.service';
import type { CategoryRepository } from '@/modules/categories/category.repository';
import { FALLBACK_CATEGORY_SLUG } from '@/shared/constants/categories';
import { slugifyCategory } from '@/shared/utils/slug';

export class CategoryService {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string) {
    return this.categories.listForUser(userId);
  }

  async create(userId: string, input: { name: string; kind: CategoryKind }) {
    const name = input.name.trim();
    const slug = slugifyCategory(name);
    const existing = await this.categories.findBySlugForUser(slug, userId);
    if (existing) {
      throw new ConflictError('A category with that name already exists.');
    }

    try {
      const created = await this.categories.create({
        userId,
        name,
        slug,
        kind: input.kind,
      });
      await this.audit.record({
        userId,
        action: 'CATEGORY_CREATED',
        entityType: 'category',
        entityId: created.id,
        metadata: { slug, kind: created.kind },
      });
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('A category with that name already exists.');
      }
      throw error;
    }
  }

  async resolve(userId: string, input: { categoryId?: string; categorySlug?: string }, type: TransactionType) {
    if (input.categoryId) {
      const category = await this.categories.findByIdForUser(input.categoryId, userId);
      if (!category) {
        throw new AppError(ERROR_CODE.INVALID_CATEGORY, 'Category was not found.', 400);
      }
      if (category.kind !== 'BOTH' && category.kind !== type) {
        throw new AppError(ERROR_CODE.INVALID_CATEGORY, 'Category does not match the transaction type.', 400);
      }
      return category;
    }

    if (input.categorySlug) {
      const category = await this.categories.findBySlug(input.categorySlug, userId, type);
      if (!category) {
        throw new AppError(ERROR_CODE.INVALID_CATEGORY, 'Category was not found.', 400);
      }
      return category;
    }

    // No category supplied: fall back to the system "Other" bucket for this type
    // rather than rejecting. Capturing the amount matters more than classifying it.
    const fallback = await this.categories.findBySlug(FALLBACK_CATEGORY_SLUG[type], userId, type);
    if (!fallback) {
      throw new AppError(ERROR_CODE.INVALID_CATEGORY, 'Category is required.', 400);
    }
    return fallback;
  }
}
