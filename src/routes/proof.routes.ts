/**
 * WitnessLedger — Proof routes
 */
import { Router } from 'express';
import * as proofCtrl from '../controllers/proof.controller';

const router = Router();

// Public endpoints
router.get('/:id/proof', proofCtrl.getProof);
router.get('/:id/qr', proofCtrl.getQR);

export default router;
