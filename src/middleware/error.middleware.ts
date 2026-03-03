/**
 * WitnessLedger — Global error handling middleware
 * Catches unhandled errors and returns structured JSON responses.
 */
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { logger } from '../app';

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
  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
    return;
  }

  // Prisma unique-constraint violations
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({ code: 'CONFLICT', message: 'A record with that value already exists' });
    return;
  }

  // Prisma not-found
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Record not found' });
    return;
  }

  // Unexpected errors
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
}
