/**
 * WitnessLedger — Evidence routes
 */
import { Router } from 'express';
import multer from 'multer';
import * as evidenceCtrl from '../controllers/evidence.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

// BEFORE/AFTER: INSPECTOR only. DOCUMENT: OFFICER/ADMIN/INSPECTOR.
// Fine-grained role + assignment check is enforced inside the service.
router.post('/:id/evidence', authMiddleware, requireRole('INSPECTOR', 'OFFICER', 'ADMIN'), upload.single('file'), evidenceCtrl.upload);
router.get('/:id/evidence', evidenceCtrl.list);

export default router;
