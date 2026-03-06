/**
 * WitnessLedger — Projects routes
 */
import { Router } from 'express';
import * as projectsCtrl from '../controllers/projects.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import * as issuesCtrl from '../controllers/issues.controller';
import { upload } from '../controllers/issues.controller';
const router = Router();

router.post('/', authMiddleware, requireRole('ADMIN'), projectsCtrl.create);
router.get('/', projectsCtrl.list);
router.get('/my-ward', authMiddleware, projectsCtrl.myWard);  // all projects in citizen's ward
router.post('/:projectId/issues', authMiddleware, upload.single('photo'), issuesCtrl.create);
router.get('/:projectId/issues', issuesCtrl.list);

router.get('/:id', projectsCtrl.getById);
router.post('/:id/approve', authMiddleware, requireRole('ADMIN'), projectsCtrl.approve);
router.get('/:id/timeline', projectsCtrl.getTimeline);

export default router;
    