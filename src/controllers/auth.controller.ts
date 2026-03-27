/**
 * JanPramaan — Auth controller
 * All user-facing messages are bilingual via i18n.
 */
import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email is required' });
      return;
    }
    const result = await authService.registerUser({ ...req.body, lang: req.lang || 'en' });

    res.status(201).json(result);
  } catch (err: any) {
    if (err.statusCode === 400) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
}

export async function verifyRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, otp } = req.body;
    const result = await authService.verifyAndLoginUser(email, otp, req.lang);
    res.json(result);
  } catch (err: any) {
    if (err.statusCode === 400 || err.statusCode === 401) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.loginUser({ ...req.body, lang: req.lang || 'en' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.sendForgotPasswordOtp(req.body.email, req.lang);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, otp, newPassword } = req.body;
    const result = await authService.resetPassword(email, otp, newPassword, req.lang);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
