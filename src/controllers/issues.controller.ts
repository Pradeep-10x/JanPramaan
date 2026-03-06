/**
 * WitnessLedger — Issues controller
 */
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as issueService from '../services/issue.service';
import { prisma } from '../prisma/client';
import { tryExtractPhotoLocation } from '../services/exif.service';
import { getNearestWard } from '../services/adminUnit.service';

export const upload = multer({ storage: multer.memoryStorage() });

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    let latitude: number | undefined;
    let longitude: number | undefined;

    // ── Step 1: Try photo EXIF first ──────────────────────────
    if (req.file) {
      const exif = await tryExtractPhotoLocation(req.file.buffer);
      if (exif) {
        // ✅ Photo has valid GPS + fresh timestamp
        latitude  = exif.lat;
        longitude = exif.lng;
      }
      // ❌ Photo has no GPS / too old → fall through to device GPS
    }

    // ── Step 2: Fall back to device GPS sent by frontend ─────
    if (latitude === undefined || longitude === undefined) {
      const deviceLat = parseFloat(req.body.deviceLat);
      const deviceLng = parseFloat(req.body.deviceLng);
      if (!isNaN(deviceLat) && !isNaN(deviceLng)) {
        latitude  = deviceLat;
        longitude = deviceLng;
      }
    }

    // ── Step 3: Location is required — reject if still missing ─
    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({
        error: 'LOCATION_REQUIRED',
        message: 'Could not determine location. Please allow GPS access or upload a photo with location enabled.',
      });
      return;
    }

    // ── Step 4: Always auto-detect ward — never trust body ────
    const nearest = await getNearestWard(latitude, longitude);

    const result = await issueService.createIssue({
      title:       req.body.title,
      description: req.body.description,
      department:  req.body.department,
      projectId:   typeof req.params.projectId === 'string' ? req.params.projectId : (req.body.projectId as string | undefined),
      createdById: req.user!.id,
      latitude,
      longitude,
      wardId: nearest.wardId,   // always auto-detected, never from body
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}


// ...existing code...
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const rawProjectId = req.params.projectId ?? req.query.projectId;
    const projectId = typeof rawProjectId === 'string' ? rawProjectId : undefined;

    const result = await issueService.listIssues({
      wardId: req.query.wardId as string | undefined,
      status: req.query.status as any,
      assignedToId: req.query.assignedTo as string | undefined,
      projectId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
// ...existing code...

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await issueService.getIssueById(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await issueService.assignIssue(id, req.user!.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function accept(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await issueService.acceptIssue(id, req.user!.id, req.user!.adminUnitId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await issueService.rejectIssue(
      id,
      req.user!.id,
      req.user!.adminUnitId,
      req.body.reason,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function convert(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await issueService.convertIssueToProject(id, req.user!.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function toggleDuplicate(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await issueService.toggleDuplicate(
      id,
      req.user!.id,
      req.body.duplicateOfId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const logs = await prisma.auditLog.findMany({
      where: { issueId: id },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, name: true } } },
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
}
