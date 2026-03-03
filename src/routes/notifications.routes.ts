/**
 * WitnessLedger — Notifications routes
 */
import { Router } from 'express';
import * as notificationsCtrl from '../controllers/notifications.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

router.get('/issue/:id', authMiddleware, requireRole('ADMIN', 'OFFICER'), notificationsCtrl.notifyForIssue);

export default router;
