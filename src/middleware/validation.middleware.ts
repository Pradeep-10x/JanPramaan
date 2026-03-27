/**
 * JanPramaan — Request validation middleware
 * Lightweight schema validation using a simple declarative approach.
 * Validation error messages are translated via i18n.
 */
import { Request, Response, NextFunction } from 'express';
import { tValidation } from '../i18n/index.js';

interface FieldRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean';
  enum?: string[];
}

/**
 * Factory returning middleware that validates req.body against rules.
 */
export function validateBody(rules: FieldRule[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const lang = req.user?.lang || req.lang || 'en';
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(tValidation('FIELD_REQUIRED', lang, rule.field));
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rule.type === 'number' && typeof value !== 'number') {
          errors.push(tValidation('FIELD_MUST_NUMBER', lang, rule.field));
        }
        if (rule.type === 'string' && typeof value !== 'string') {
          errors.push(tValidation('FIELD_MUST_STRING', lang, rule.field));
        }
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(tValidation('FIELD_MUST_ENUM', lang, rule.field, rule.enum.join(', ')));
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: errors.join('; ') });
      return;
    }

    next();
  };
}
