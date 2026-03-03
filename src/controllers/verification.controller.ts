/**
 * WitnessLedger — Verification controller
 * Handles inspector verification of issue resolution.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { IssueStatus, VerificationVerdict, Evidence } from '../generated/prisma/client.js';

interface IssueWithRelations {
  id: string;
  evidence: Evidence[];
  verification: { id: string } | null;
  [key: string]: any;
}

export async function verifyIssue(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const verdict = req.body.verdict as string;
    const remarks = req.body.remarks as string | undefined;

    if (!verdict || !['APPROVED', 'REJECTED'].includes(verdict)) {
      res.status(400).json({ code: 'INVALID_VERDICT', message: 'verdict must be APPROVED or REJECTED' });
      return;
    }

    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        evidence: true,
        verification: true,
      },
    }) as IssueWithRelations | null;

    if (!issue) {
      throw new AppError(404, 'NOT_FOUND', 'Issue not found');
    }

    if (issue.verification) {
      throw new AppError(409, 'ALREADY_VERIFIED', 'Issue has already been verified');
    }

    // Check evidence exists for APPROVED
    if (verdict === 'APPROVED') {
      const hasBefore = issue.evidence.some((e: Evidence) => e.type === 'BEFORE');
      const hasAfter = issue.evidence.some((e: Evidence) => e.type === 'AFTER');

      if (!hasBefore || !hasAfter) {
        if (!remarks) {
          throw new AppError(
            400,
            'MISSING_EVIDENCE',
            'Both BEFORE and AFTER evidence required for approval, or provide remarks to override',
          );
        }
      }
    }

    const newStatus =
      verdict === 'APPROVED' ? IssueStatus.VERIFIED : IssueStatus.IN_PROGRESS;

    const hasBothEvidence =
      issue.evidence.some((e: Evidence) => e.type === 'BEFORE') &&
      issue.evidence.some((e: Evidence) => e.type === 'AFTER');

    const [verification] = await prisma.$transaction([
      prisma.verification.create({
        data: {
          issueId: id,
          verifiedById: req.user!.id,
          verdict: verdict as VerificationVerdict,
          remarks: remarks || null,
          overrideNote: verdict === 'APPROVED' && !hasBothEvidence ? (remarks || null) : null,
        },
      }),
      prisma.issue.update({
        where: { id },
        data: { status: newStatus },
      }),
      prisma.auditLog.create({
        data: {
          issueId: id,
          actorId: req.user!.id,
          action: `ISSUE_${verdict}`,
          metadata: { verdict, remarks: remarks || null, newStatus },
        },
      }),
    ]);

    res.json({ verification, newStatus });
  } catch (err) {
    next(err);
  }
}
