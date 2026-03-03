/**
 * WitnessLedger — Notifications controller
 */
import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service';

export async function notifyForIssue(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : 50;
    const result = await notificationService.notifyNearbyResidents(
      id,
      req.user!.id,
      radius,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
