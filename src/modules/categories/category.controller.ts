import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import { createCategorySchema } from '@/modules/categories/category.schema';
import type { CategoryService } from '@/modules/categories/category.service';

export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.categories.list(req.user!.id);
    res.json({ data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = createCategorySchema.parse(req.body);
    const data = await this.categories.create(req.user!.id, input);
    res.status(201).json({ data });
  });
}
