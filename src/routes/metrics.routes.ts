/**
 * WitnessLedger — Metrics routes
 */
import { Router } from 'express';
import * as metricsCtrl from '../controllers/metrics.controller';

const router = Router();

router.get('/', metricsCtrl.getMetrics);

export default router;
