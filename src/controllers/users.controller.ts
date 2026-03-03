/**
 * WitnessLedger — Users controller
 */
import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await userService.createUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await userService.getUserProfile(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
