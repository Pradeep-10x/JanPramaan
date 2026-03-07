/**
 * WitnessLedger — Dashboard routes
 */
import { Router } from 'express';
import * as dashboardCtrl from '../controllers/dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

// Secure officer dashboard endpoint
router.get('/officer', authMiddleware, requireRole('OFFICER', 'ADMIN'), dashboardCtrl.getOfficerDashboard);

export default router;
