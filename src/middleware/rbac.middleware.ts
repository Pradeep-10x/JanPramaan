/**
 * JanPramaan — Role-Based Access Control middleware
 * Restricts route access to specified roles.
 */
import { Request, Response, NextFunction } from 'express';

/**
 * Factory that returns middleware allowing only the listed roles.
 * Must be placed AFTER authMiddleware in the chain.
 */
export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    if (!allowed.includes(req.user.role)) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: `This action requires one of: ${allowed.join(', ')}`,
      });
      return;
    }

    next();
  };
}
