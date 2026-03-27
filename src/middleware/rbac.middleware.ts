/**
 * JanPramaan — Role-Based Access Control middleware
 * Restricts route access to specified roles.
 * Messages are translated via i18n.
 */
import { Request, Response, NextFunction } from 'express';
import { tError } from '../i18n/index.js';

/**
 * Factory that returns middleware allowing only the listed roles.
 * Must be placed AFTER authMiddleware in the chain.
 */
export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const lang = req.user?.lang || req.lang || 'en';

    if (!req.user) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: tError('AUTH_REQUIRED', lang) });
      return;
    }

    if (!allowed.includes(req.user.role)) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: tError('FORBIDDEN', lang),
      });
      return;
    }

    next();
  };
}
