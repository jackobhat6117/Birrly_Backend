import { Router } from 'express';
import type { CategoryController } from '@/modules/categories/category.controller';

export function categoryRoutes(controller: CategoryController): Router {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  return router;
}
