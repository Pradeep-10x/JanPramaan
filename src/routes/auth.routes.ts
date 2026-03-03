/**
 * WitnessLedger — Auth routes
 */
import { Router } from 'express';
import * as authCtrl from '../controllers/auth.controller';
import { validateBody } from '../middleware/validation.middleware';

const router = Router();

router.post(
  '/register',
  validateBody([
    { field: 'name', required: true, type: 'string' },
    { field: 'password', required: true, type: 'string' },
  ]),
  authCtrl.register,
);

router.post(
  '/login',
  validateBody([
    { field: 'email', required: true, type: 'string' },
    { field: 'password', required: true, type: 'string' },
  ]),
  authCtrl.login,
);

export default router;
