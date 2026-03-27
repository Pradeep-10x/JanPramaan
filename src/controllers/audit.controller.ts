/**
 * JanPramaan — Audit controller
 * Exposes chain verification endpoints for ADMIN users.
 */
import { Request, Response, NextFunction } from 'express';
import { verifyAuditChain } from '../services/audit.service';

/**
 * GET /api/audit/verify
 * Verify the global audit log chain integrity.
 */
export async function verifyChain(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await verifyAuditChain();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/audit/verify/:issueId
 * Verify the audit log chain for a specific issue.
 */
export async function verifyIssueChain(req: Request, res: Response, next: NextFunction) {
  try {
    const issueId = req.params.issueId as string;
    const result = await verifyAuditChain(issueId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
