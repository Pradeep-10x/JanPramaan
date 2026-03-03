/**
 * WitnessLedger — Residents routes
 */
import { Router } from 'express';
import multer from 'multer';
import * as residentsCtrl from '../controllers/residents.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.post('/import', authMiddleware, requireRole('ADMIN'), upload.single('file'), residentsCtrl.importResidents);

export default router;
