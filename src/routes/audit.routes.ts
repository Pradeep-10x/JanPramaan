/**
 * JanPramaan — Audit routes
 * Chain verification endpoints (ADMIN only).
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import * as auditCtrl from '../controllers/audit.controller';

const router = Router();

/**
 * @openapi
 * /api/audit/verify:
 *   get:
 *     summary: Verify global audit log chain integrity
 *     tags: [Audit]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Chain verification result
 */
router.get('/verify', authMiddleware, requireRole('ADMIN'), auditCtrl.verifyChain);

/**
 * @openapi
 * /api/audit/verify/{issueId}:
 *   get:
 *     summary: Verify audit chain for a specific issue
 *     tags: [Audit]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: issueId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chain verification result for the issue
 */
router.get('/verify/:issueId', authMiddleware, requireRole('ADMIN'), auditCtrl.verifyIssueChain);

export default router;
