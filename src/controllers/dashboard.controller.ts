/**
 * WitnessLedger — Dashboard Controller
 * Provides custom views like the officer command center.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { IssueStatus, Department } from '../generated/prisma/client.js';

/**
 * Returns a paginated list of issues assigned to the officer, along with some personal stats.
 */
export async function getOfficerDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const officerId = req.user!.id;
    const { status, department, wardId, page = '1', limit = '20' } = req.query;

    const pageNumber = parseInt(page as string, 10) || 1;
    const pageSize = parseInt(limit as string, 10) || 20;
    const skip = (pageNumber - 1) * pageSize;

    // Filter build
    const whereClause: any = {
      assignedToId: officerId,
    };

    if (status && Object.values(IssueStatus).includes(status as IssueStatus)) {
      whereClause.status = status as IssueStatus;
    }
    if (department && Object.values(Department).includes(department as Department)) {
      whereClause.department = department as Department;
    }
    if (wardId) {
      whereClause.wardId = wardId;
    }

    // Run parallel queries including stats
    const [issues, totalCount, myPending, myResolved, mySlaBreaches] = await Promise.all([
      // Paginated issues
      prisma.issue.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          ward: { select: { name: true } },
          acceptedBy: { select: { name: true } },
        }
      }),
      // Total count for pagination
      prisma.issue.count({ where: whereClause }),
      
      // Top level stats for this officer
      prisma.issue.count({ where: { assignedToId: officerId, status: { notIn: [IssueStatus.VERIFIED, IssueStatus.COMPLETED, IssueStatus.REJECTED] } } }),
      prisma.issue.count({ where: { assignedToId: officerId, status: { in: [IssueStatus.VERIFIED, IssueStatus.COMPLETED] } } }),
      prisma.issue.count({ where: { assignedToId: officerId, slaDeadline: { lt: new Date() }, status: { notIn: [IssueStatus.VERIFIED, IssueStatus.COMPLETED, IssueStatus.REJECTED] } } })
    ]);

    res.json({
      officer_stats: {
        pending_issues: myPending,
        resolved_issues: myResolved,
        sla_breaches_active: mySlaBreaches,
      },
      pagination: {
        total: totalCount,
        page: pageNumber,
        limit: pageSize,
        total_pages: Math.ceil(totalCount / pageSize),
      },
      data: issues,
    });
  } catch (err) {
    next(err);
  }
}
