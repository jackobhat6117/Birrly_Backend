import { Router } from 'express';
import type { GroupSavingsController } from '@/modules/group-savings/group-savings.controller';

export function groupSavingsRoutes(controller: GroupSavingsController): Router {
  const router = Router();

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.post('/join', controller.join);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.delete);
  router.post('/:id/contributions', controller.addContribution);
  router.post('/:id/members', controller.addMemberByTelegramId);
  router.delete('/:id/members/:userId', controller.removeMember);
  router.post('/:id/link-chat', controller.linkTelegramChat);

  return router;
}
