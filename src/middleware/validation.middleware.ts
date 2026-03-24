/**
 * JanPramaan — Request validation middleware
 * Lightweight schema validation using a simple declarative approach.
 * For production, swap with Zod or Joi.
 */
import { Request, Response, NextFunction } from 'express';

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
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.field} is required`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rule.type === 'number' && typeof value !== 'number') {
          errors.push(`${rule.field} must be a number`);
        }
        if (rule.type === 'string' && typeof value !== 'string') {
          errors.push(`${rule.field} must be a string`);
        }
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`${rule.field} must be one of: ${rule.enum.join(', ')}`);
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
