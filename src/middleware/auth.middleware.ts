/**
 * JanPramaan — JWT authentication middleware
 * Validates Bearer tokens and attaches the decoded user to req.user.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../prisma/client';
import { tError } from '../i18n/index.js';

export interface JwtPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        adminUnitId: string | null;
        lang: string;
      };
    }
  }
}

/**
 * Require a valid JWT. Attaches user info to `req.user`.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const lang = req.lang || 'en';
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: tError('UNAUTHORIZED', lang) });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, adminUnitId: true, preferredLang: true },
    });

    if (!user) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: tError('USER_NOT_EXISTS', lang) });
      return;
    }

    // User's DB preference overrides header
    const userLang = user.preferredLang || lang;
    req.user = { id: user.id, role: user.role, adminUnitId: user.adminUnitId, lang: userLang };
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: tError('INVALID_TOKEN', lang) });
  }
}

/**
 * Optional auth — sets req.user if token is present, but does not reject.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, adminUnitId: true, preferredLang: true },
    });
    if (user) {
      req.user = {
        id: user.id,
        role: user.role,
        adminUnitId: user.adminUnitId,
        lang: user.preferredLang || req.lang || 'en',
      };
    }
  } catch {
    // Silent: token invalid but we don't block
  }
  next();
}
