/**
 * WitnessLedger — Metrics controller
 * Computes on-demand KPIs from the database.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { IssueStatus } from '../generated/prisma/client.js';

export async function getMetrics(_req: Request, res: Response, next: NextFunction) {
  try {
    const totalIssues = await prisma.issue.count();
    const verifiedIssues = await prisma.issue.count({ where: { status: IssueStatus.VERIFIED } });

    // Average resolution time: from ASSIGNED → VERIFIED
    const verifiedWithAssignment = await prisma.issue.findMany({
      where: { status: IssueStatus.VERIFIED },
      select: { createdAt: true, updatedAt: true, slaDeadline: true },
    });

    let totalResolutionHours = 0;
    let slaCompliant = 0;
    for (const issue of verifiedWithAssignment) {
      const hours = (issue.updatedAt.getTime() - issue.createdAt.getTime()) / (1000 * 60 * 60);
      totalResolutionHours += hours;
      if (issue.slaDeadline && issue.updatedAt <= issue.slaDeadline) {
        slaCompliant++;
      }
    }

    const avgResolutionTimeHours =
      verifiedWithAssignment.length > 0
        ? Math.round((totalResolutionHours / verifiedWithAssignment.length) * 100) / 100
        : null;

    // Proof coverage: issues with both BEFORE and AFTER evidence
    const issuesWithBefore = await prisma.evidence.findMany({
      where: { type: 'BEFORE' },
      select: { issueId: true },
      distinct: ['issueId'],
    });
    const issuesWithAfter = await prisma.evidence.findMany({
      where: { type: 'AFTER' },
      select: { issueId: true },
      distinct: ['issueId'],
    });

    const beforeSet = new Set(issuesWithBefore.map((e) => e.issueId));
    const bothCount = issuesWithAfter.filter((e) => beforeSet.has(e.issueId)).length;

    res.json({
      total_issues: totalIssues,
      verified_issues: verifiedIssues,
      verified_percent: totalIssues > 0 ? Math.round((verifiedIssues / totalIssues) * 10000) / 100 : 0,
      avg_resolution_time_hours: avgResolutionTimeHours,
      sla_compliance_percent:
        verifiedWithAssignment.length > 0
          ? Math.round((slaCompliant / verifiedWithAssignment.length) * 10000) / 100
          : null,
      proof_coverage_count: bothCount,
      proof_coverage_percent:
        totalIssues > 0 ? Math.round((bothCount / totalIssues) * 10000) / 100 : 0,
    });
  } catch (err) {
    next(err);
  }
}
