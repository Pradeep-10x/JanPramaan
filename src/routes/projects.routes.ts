/**
 * WitnessLedger — Projects routes
 */
import { Router } from 'express';
import * as projectsCtrl from '../controllers/projects.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

router.post('/', authMiddleware, requireRole('ADMIN'), projectsCtrl.create);
router.get('/', projectsCtrl.list);
router.get('/:id', projectsCtrl.getById);
router.post('/:id/approve', authMiddleware, requireRole('ADMIN'), projectsCtrl.approve);
router.get('/:id/timeline', projectsCtrl.getTimeline);

export default router;
