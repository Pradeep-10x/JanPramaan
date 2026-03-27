/**
 * JanPramaan — Global error handling middleware
 * Catches unhandled errors and returns structured JSON responses.
 * All user-facing messages are translated via i18n.
 */
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { logger } from '../app';
import { tError } from '../i18n/index.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Express error handler — must be registered last in the middleware chain.
 */
export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const lang = req.user?.lang || req.lang || 'en';

  // Known application errors
  if (err instanceof AppError) {
    const translated = tError(err.code, lang, err.message);
    res.status(err.statusCode).json({ code: err.code, message: translated });
    return;
  }

  // Prisma unique-constraint violations
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({ code: 'CONFLICT', message: tError('CONFLICT', lang) });
    return;
  }

  // Prisma not-found
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json({ code: 'NOT_FOUND', message: tError('NOT_FOUND', lang) });
    return;
  }

  // Unexpected errors
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ code: 'INTERNAL_ERROR', message: tError('INTERNAL_ERROR', lang) });
}
