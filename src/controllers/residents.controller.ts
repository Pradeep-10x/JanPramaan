/**
 * WitnessLedger — Residents controller
 */
import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service';

export async function importResidents(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ code: 'NO_FILE', message: 'CSV file is required' });
      return;
    }

    const result = await notificationService.importResidents(req.file.buffer);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
