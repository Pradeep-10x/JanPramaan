/**
 * JanPramaan — i18n language detection middleware
 * Parses Accept-Language header and sets req.lang for downstream use.
 */
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      lang?: string;
    }
  }
}

/**
 * Extract language from Accept-Language header.
 * Supports: 'hi', 'hi-IN', 'en', 'en-US', etc.
 * Defaults to 'en'.
 */
export function i18nMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const acceptLang = req.headers['accept-language'] || '';
  // Check for Hindi first (hi, hi-IN, etc.)
  if (/\bhi\b/i.test(acceptLang)) {
    req.lang = 'hi';
  } else {
    req.lang = 'en';
  }
  next();
}
