/**
 * WitnessLedger — Evidence routes
 */
import { Router } from 'express';
import multer from 'multer';
import * as evidenceCtrl from '../controllers/evidence.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

// Mounted under /api/issues/:id — these are sub-routes
router.post('/:id/evidence', authMiddleware, upload.single('file'), evidenceCtrl.upload);
router.get('/:id/evidence', evidenceCtrl.list);

export default router;
