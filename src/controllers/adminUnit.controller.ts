/**
 * WitnessLedger — AdminUnit controller
 */
import { Request, Response, NextFunction } from 'express';
import * as adminUnitService from '../services/adminUnit.service';

export async function listUnits(req: Request, res: Response, next: NextFunction) {
  try {
    const type = req.query.type as any;
    const result = await adminUnitService.listAdminUnits(type);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createUnit(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminUnitService.createAdminUnit(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getChildren(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminUnitService.getChildren(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
