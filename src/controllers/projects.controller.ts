/**
 * WitnessLedger — Projects controller
 */
import { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/project.service';
import { prisma } from '../prisma/client';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await projectService.createProject(
      {
        ...req.body,
        adminUnitId: req.body.adminUnitId ?? req.user!.adminUnitId,
      },
      req.user!.id,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await projectService.listProjects({
      adminUnitId: req.query.adminUnitId as string | undefined,
      status: req.query.status as any,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/projects/my-ward
 * Returns all projects in the logged-in citizen's ward — full transparency.
 */
export async function myWard(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user!.adminUnitId) {
      res.status(400).json({
        error: 'NO_WARD',
        message: 'Your account has no ward set. Update it via PATCH /api/users/me/ward',
      });
      return;
    }
    const result = await projectService.listProjects({
      adminUnitId: req.user!.adminUnitId,
      status: req.query.status as any,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await projectService.getProjectById(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await projectService.approveProject(id, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const logs = await prisma.auditLog.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, name: true } } },
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
}
