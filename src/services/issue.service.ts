/**
 * JanPramaan — Issue service
 * Core issue lifecycle: creation with auto-assignment, listing, assignment,
 * conversion to project, and duplicate toggling.
 */
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { IssueStatus, IssuePriority, ProjectStatus, Role, EvidenceType } from '../generated/prisma/client.js';
import { config } from '../config';
import { notify, notifyWardOfficers } from './notification.service.js';
import { haversineDistance } from '../utils/geo.util.js';
import { classifyDepartment } from './classification.service.js';
import { tError, tNotify } from '../i18n/index.js';

/** Issues within this radius (metres) are flagged as potential duplicates on creation. */
const DUPLICATE_RADIUS_METRES = 100;

/** Minimum text similarity (0-1) to consider two issue titles as potential duplicates. */
const DUPLICATE_TEXT_THRESHOLD = 0.6;

/**
 * Compute normalised Levenshtein similarity between two strings.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
function textSimilarity(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1;
  const maxLen = Math.max(al.length, bl.length);
  if (maxLen === 0) return 1;

  // Levenshtein distance via bottom-up DP (single-row optimisation)
  const prev = Array.from({ length: bl.length + 1 }, (_, i) => i);
  for (let i = 1; i <= al.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= bl.length; j++) {
      const temp = prev[j];
      prev[j] = al[i - 1] === bl[j - 1]
        ? prevDiag
        : 1 + Math.min(prev[j], prev[j - 1], prevDiag);
      prevDiag = temp;
    }
  }
  return 1 - prev[bl.length] / maxLen;
}

/**
 * Convert a degree offset to approximate metres (at the equator).
 * Used to pre-filter DB rows by bounding box before running haversine.
 */
const DEGREE_PER_METRE = 1 / 111_320; // ≈ 1 degree latitude = 111.32 km

/**
 * Returns a 0-100 progress score for an issue based on its current status.
 * Useful for progress bars / dashboards.
 */
export function getProgressScore(status: IssueStatus): number {
  const scores: Record<IssueStatus, number> = {
    [IssueStatus.OPEN]:                 5,
    [IssueStatus.ACCEPTED]:            15,
    [IssueStatus.REJECTED]:             0,
    [IssueStatus.ASSIGNED]:            25,
    [IssueStatus.INSPECTING]:          40,
    [IssueStatus.CONTRACTOR_ASSIGNED]: 55,
    [IssueStatus.INSPECTING_WORK]:     70,
    [IssueStatus.UNDER_REVIEW]:        85,
    [IssueStatus.IN_PROGRESS]:         55,
    [IssueStatus.COMPLETED]:           95,
    [IssueStatus.VERIFIED]:           100,
  };
  return scores[status] ?? 0;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  department?: string;
  latitude: number;
  longitude: number;
  wardId: string;
  createdById: string;
  projectId?: string;
}

export interface AssignInput {
  assignedToId: string;
  slaHours?: number;
}

export interface ConvertInput {
  title: string;
  description?: string;
  budget?: number;
}

/**
 * Create a new issue. Status always starts as OPEN.
 * An officer may be pre-routed via assignedToId for dashboard visibility,
 * but the issue must be explicitly accepted before work begins.
 */
export async function createIssue(input: CreateIssueInput) {
  // ── Auto-classify department ──────────────────────────────────────────────
  // Citizen can override via the form; otherwise NLP auto-classifies.
  const classification = classifyDepartment(input.title, input.description);
  const resolvedDepartment = input.department || classification.department;

  // Validate ward exists and is type WARD
  const ward = await prisma.adminUnit.findUnique({ where: { id: input.wardId } });
  if (!ward || ward.type !== 'WARD') {
    throw new AppError(400, 'INVALID_WARD', tError('INVALID_WARD'));
  }
   
  if (input.projectId) {
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) {
      throw new AppError(400, 'INVALID_PROJECT', tError('INVALID_PROJECT'));
    }
  }

  // Find an officer in the ward using round-robin (the one who was assigned an issue longest ago)
  const officers = await prisma.user.findMany({
    where: { adminUnitId: input.wardId, role: Role.OFFICER },
    include: {
      assignedIssues: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  
  let officer = null;
  if (officers.length > 0) {
    officers.sort((a, b) => {
      const timeA = a.assignedIssues[0]?.createdAt.getTime() || 0;
      const timeB = b.assignedIssues[0]?.createdAt.getTime() || 0;
      return timeA - timeB; // Oldest time first
    });
    officer = officers[0];
  }

  const issue = await prisma.issue.create({
    data: {
      title: input.title,
      description: input.description,
      department: resolvedDepartment as any,
      latitude: input.latitude,
      longitude: input.longitude,
      wardId: input.wardId,
      createdById: input.createdById,
      assignedToId: officer?.id,
      status: IssueStatus.OPEN,
      projectId: input.projectId,
    },
    include: {
      ward: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      issueId: issue.id,
      actorId: input.createdById,
      action: 'ISSUE_CREATED',
      metadata: {
        routedToOfficer: officer?.id ?? null,
        status: issue.status,
      },
    },
  });

  // Notify all officers in the ward about the new issue
  await notifyWardOfficers(
    input.wardId,
    tNotify('NEW_ISSUE_TITLE'),
    tNotify('NEW_ISSUE_BODY', undefined, issue.title, issue.ward.name),
    { issueId: issue.id },
  );

  // ── Duplicate Detection ──────────────────────────────────────────────────
  // Two-signal approach: geo proximity (haversine ≤ 100m) OR text similarity (≥ 60%).
  // Pre-filter with a lat/lng bounding box to avoid loading thousands of rows.
  const margin = DUPLICATE_RADIUS_METRES * DEGREE_PER_METRE * 2; // generous bbox
  const candidateIssues = await prisma.issue.findMany({
    where: {
      wardId: input.wardId,
      id:     { not: issue.id },
      status: { notIn: [IssueStatus.REJECTED, IssueStatus.VERIFIED, IssueStatus.COMPLETED] },
      department: resolvedDepartment as any,
    },
    select: { id: true, title: true, status: true, latitude: true, longitude: true },
    take: 200, // cap to avoid memory issues in dense wards
    orderBy: { createdAt: 'desc' }, // prioritise recent issues
  });

  const potentialDuplicates = candidateIssues
    .map((i) => {
      const distanceMetres = Math.round(haversineDistance(input.latitude, input.longitude, i.latitude, i.longitude));
      const titleSimilarity = Math.round(textSimilarity(input.title, i.title) * 100);
      return {
        id:              i.id,
        title:           i.title,
        status:          i.status,
        distanceMetres,
        titleSimilarity, // 0-100 percentage
        matchReason:     distanceMetres <= DUPLICATE_RADIUS_METRES && titleSimilarity >= DUPLICATE_TEXT_THRESHOLD * 100
          ? 'GEO_AND_TEXT' as const
          : distanceMetres <= DUPLICATE_RADIUS_METRES
          ? 'GEO_PROXIMITY' as const
          : 'TEXT_SIMILARITY' as const,
      };
    })
    .filter((i) => i.distanceMetres <= DUPLICATE_RADIUS_METRES || i.titleSimilarity >= DUPLICATE_TEXT_THRESHOLD * 100)
    .sort((a, b) => {
      // Prioritise matches that hit both signals
      const aScore = (a.matchReason === 'GEO_AND_TEXT' ? 0 : 1);
      const bScore = (b.matchReason === 'GEO_AND_TEXT' ? 0 : 1);
      if (aScore !== bScore) return aScore - bScore;
      return a.distanceMetres - b.distanceMetres;
    });

  if (potentialDuplicates.length > 0) {
    await notifyWardOfficers(
      input.wardId,
      tNotify('DUPLICATE_WARNING_TITLE'),
      tNotify('DUPLICATE_WARNING_BODY', undefined, issue.title, potentialDuplicates.length, DUPLICATE_RADIUS_METRES),
      { issueId: issue.id },
    );
  }

  return { ...issue, progressScore: getProgressScore(issue.status), potentialDuplicates, classification };
}

/**
 * Accept an issue (OFFICER/ADMIN action).
 * Transitions status from OPEN → ACCEPTED and records the accepting user.
 */
export async function acceptIssue(
  issueId: string,
  actorId: string,
  actorAdminUnitId: string | null,
  priority?: IssuePriority,
) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', tError('NOT_FOUND'));
  }

  if (issue.status !== IssueStatus.OPEN && issue.status !== IssueStatus.ASSIGNED) {
    throw new AppError(400, 'INVALID_STATUS', tError('INVALID_STATUS'));
  }

  // Ward-match check: actor must belong to the same ward as the issue
  if (!actorAdminUnitId || actorAdminUnitId !== issue.wardId) {
    throw new AppError(403, 'FORBIDDEN', tError('FORBIDDEN'));
  }

  // Check authorization: Must be the currently assigned officer OR an Admin
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (issue.assignedToId && issue.assignedToId !== actorId && actor?.role !== Role.ADMIN) {
    throw new AppError(403, 'FORBIDDEN', tError('FORBIDDEN'));
  }

  const now = new Date();

  const [updated] = await prisma.$transaction([
    prisma.issue.update({
      where: { id: issueId },
      data: {
        status: IssueStatus.ACCEPTED,
        acceptedById: actorId,
        acceptedAt: now,
        ...(priority ? { priority } : {}),
      },
      include: {
        ward: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        acceptedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.create({
      data: {
        issueId,
        actorId,
        action: 'ISSUE_ACCEPTED',
        metadata: {
          previousStatus: issue.status,
          ...(priority ? { priority } : {}),
        },
      },
    }),
  ]);

  // Notify the citizen who raised the issue
  await notify(
    issue.createdById,
    tNotify('ISSUE_ACCEPTED_TITLE'),
    tNotify('ISSUE_ACCEPTED_BODY', undefined, issue.title),
    { issueId },
  );

  // ── Auto-assign Inspector ─────────────────────────────────────────────────
  // Pick the least-busy inspector in the ward (one with no active inspections first,
  // otherwise fall back to any inspector in the ward).
  const freeInspector = await prisma.user.findFirst({
    where: {
      adminUnitId: issue.wardId,
      role: Role.INSPECTOR,
      inspectedIssues: {
        none: { status: { in: [IssueStatus.INSPECTING, IssueStatus.IN_PROGRESS, IssueStatus.INSPECTING_WORK] } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const inspector = freeInspector ?? await prisma.user.findFirst({
    where: { adminUnitId: issue.wardId, role: Role.INSPECTOR },
    orderBy: { createdAt: 'asc' },
  });

  let autoAssignedInspector: { id: string; name: string } | null = null;

  if (inspector) {
    await prisma.$transaction([
      prisma.issue.update({
        where: { id: issueId },
        data:  { inspectorId: inspector.id, status: IssueStatus.INSPECTING },
      }),
      prisma.auditLog.create({
        data: {
          issueId,
          actorId: null,   // system-triggered
          action:  'INSPECTOR_AUTO_ASSIGNED',
          metadata: { inspectorId: inspector.id, inspectorName: inspector.name },
        },
      }),
    ]);
    await notify(
      inspector.id,
      tNotify('INSPECTION_ASSIGNMENT'),
      tNotify('INSPECTION_ASSIGN_BODY', undefined, issue.title),
      { issueId },
    );
    await notify(
      issue.createdById,
      tNotify('INSPECTOR_ASSIGNED_TITLE'),
      tNotify('INSPECTOR_ASSIGNED_BODY', undefined, issue.title),
      { issueId },
    );
    autoAssignedInspector = { id: inspector.id, name: inspector.name };
  }

  return {
    ...updated,
    progressScore: getProgressScore(autoAssignedInspector ? IssueStatus.INSPECTING : IssueStatus.ACCEPTED),
    autoAssignedInspector,
  };
}

/**
 * Reject an issue (OFFICER/ADMIN action).
 * Transitions status from OPEN → REJECTED with a mandatory reason.
 */
export async function rejectIssue(
  issueId: string,
  actorId: string,
  actorAdminUnitId: string | null,
  reason: string,
) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', tError('NOT_FOUND'));
  }

  if (issue.status !== IssueStatus.OPEN && issue.status !== IssueStatus.ASSIGNED) {
    throw new AppError(400, 'INVALID_STATUS', tError('INVALID_STATUS'));
  }

  if (!actorAdminUnitId || actorAdminUnitId !== issue.wardId) {
    throw new AppError(403, 'FORBIDDEN', tError('FORBIDDEN'));
  }

  // Check authorization: Must be the currently assigned officer OR an Admin
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (issue.assignedToId && issue.assignedToId !== actorId && actor?.role !== Role.ADMIN) {
    throw new AppError(403, 'FORBIDDEN', tError('FORBIDDEN'));
  }

  if (!reason || reason.trim().length === 0) {
    throw new AppError(400, 'MISSING_REASON', tError('MISSING_REASON'));
  }

  const now = new Date();

  const [updated] = await prisma.$transaction([
    prisma.issue.update({
      where: { id: issueId },
      data: {
        status: IssueStatus.REJECTED,
        rejectedById: actorId,
        rejectedAt: now,
        rejectionReason: reason.trim(),
      },
      include: {
        ward: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        rejectedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.create({
      data: {
        issueId,
        actorId,
        action: 'ISSUE_REJECTED',
        metadata: { reason: reason.trim() },
      },
    }),
  ]);

  // Notify the citizen who raised the issue
  await notify(
    issue.createdById,
    tNotify('ISSUE_REJECTED_TITLE'),
    tNotify('ISSUE_REJECTED_BODY', undefined, issue.title, reason.trim()),
    { issueId },
  );

  return updated;
}

/**
 * List issues with optional filters.
 */
export async function listIssues(filters: {
  wardId?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignedToId?: string;
  inspectorId?: string;
  contractorId?: string;
  projectId?: string;
  createdById?: string;
}) {
  
  // If an assignment filter is provided (which maps to assignedToId, inspectorId, or contractorId from the controller),
  // we want to return issues where the user matches ANY of those roles.
  const assignmentOrClause = (filters.assignedToId || filters.inspectorId || filters.contractorId) 
    ? [
        { assignedToId: filters.assignedToId || undefined },
        { inspectorId: filters.inspectorId || undefined },
        { contractorId: filters.contractorId || undefined }
      ].filter(condition => Object.values(condition)[0] !== undefined)
    : undefined;

  const issues = await prisma.issue.findMany({
    where: {
      ...(filters.wardId      && { wardId:       filters.wardId }),
      ...(filters.status      && { status:       filters.status }),
      ...(filters.priority    && { priority:     filters.priority }),
      ...(filters.projectId   && { projectId:    filters.projectId }),
      ...(filters.createdById && { createdById:  filters.createdById }),
      ...(assignmentOrClause && assignmentOrClause.length > 0 && { OR: assignmentOrClause })
    },
    include: {
      ward: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      inspector:  { select: { id: true, name: true } },
      contractor: { select: { id: true, name: true } },
      _count: { select: { evidence: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return issues.map((i) => ({ ...i, progressScore: getProgressScore(i.status) }));
}

/**
 * Get a single issue with full details and evidence.
 */
export async function getIssueById(id: string) {
  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      ward: true,
      project: { select: { id: true, title: true, status: true } },
      createdBy:  { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      acceptedBy: { select: { id: true, name: true } },
      rejectedBy: { select: { id: true, name: true } },
      inspector:  { select: { id: true, name: true } },
      contractor: { select: { id: true, name: true } },
      evidence: {
        orderBy: { uploadedAt: 'asc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
      verification: {
        include: { verifiedBy: { select: { id: true, name: true } } },
      },
      duplicateOf: { select: { id: true, title: true } },
    },
  });

  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', tError('NOT_FOUND'));
  }

  // Fetch timeline (audit logs)
  const timeline = await prisma.auditLog.findMany({
    where: { issueId: id },
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { id: true, name: true } } },
  });

  // ── Structured photo summary ─────────────────────────────────────────────
  // Group evidence by type so consumers don't need to filter themselves.
  const photos = {
    citizen: issue.evidence.find((e) => e.type === 'CITIZEN') ?? null,
    before:  issue.evidence.find((e) => e.type === 'BEFORE')  ?? null,
    after:   issue.evidence.find((e) => e.type === 'AFTER')   ?? null,
  };

  return { ...issue, timeline, progressScore: getProgressScore(issue.status), photos };
}

/**
 * (Re-)assign an issue to a user (OFFICER/ADMIN action).
 */
export async function assignIssue(issueId: string, actorId: string, input: AssignInput) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', tError('NOT_FOUND'));
  }

  // Check authorization: Must be the currently assigned officer OR an Admin
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  const isAssignedOfficer = issue.assignedToId === actorId;
  const isAdmin = actor?.role === Role.ADMIN;
  
  if (!isAssignedOfficer && !isAdmin) {
    throw new AppError(403, 'FORBIDDEN', tError('FORBIDDEN'));
  }

  const assignee = await prisma.user.findUnique({ where: { id: input.assignedToId } });
  if (!assignee) {
    throw new AppError(400, 'INVALID_USER', tError('INVALID_USER'));
  }
  if (assignee.role !== Role.OFFICER && assignee.role !== Role.ADMIN) {
    throw new AppError(400, 'INVALID_ROLE', tError('INVALID_ROLE'));
  }
  if (assignee.adminUnitId !== issue.wardId) {
    throw new AppError(403, 'WRONG_WARD', tError('WRONG_WARD'));
  }

  const [updated] = await prisma.$transaction([
    prisma.issue.update({
      where: { id: issueId },
      data: {
        assignedToId: input.assignedToId,
        status: IssueStatus.OPEN,
      },
    }),
    prisma.auditLog.create({
      data: {
        issueId,
        actorId,
        action: 'ISSUE_ASSIGNED',
        metadata: { assignedToId: input.assignedToId },
      },
    }),
  ]);

  // Notify the officer who was assigned
  await notify(
    input.assignedToId,
    tNotify('ISSUE_ASSIGNED_TITLE'),
    tNotify('ISSUE_ASSIGNED_BODY', undefined, issue.title),
    { issueId },
  );

  return updated;
}

/**
 * Convert an issue into a proposed project (OFFICER only, atomic transaction).
 */
export async function convertIssueToProject(
  issueId: string,
  actorId: string,
  input: ConvertInput,
) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', tError('NOT_FOUND'));
  }

  // Resolve project status based on actor's role (mirrors project.service.ts logic)
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
  const projectStatus = actor?.role === Role.ADMIN
    ? ProjectStatus.ACTIVE    // ADMIN → auto-approved
    : ProjectStatus.PROPOSED; // OFFICER → needs admin approval

  // Use a transaction to ensure atomicity
  const [project] = await prisma.$transaction([
    prisma.project.create({
      data: {
        title: input.title,
        description: input.description ?? '',
        budget: input.budget,
        status: projectStatus,
        adminUnitId: issue.wardId,
        createdById: actorId,
      },
    }),
    // Defer further updates — we'll use the result outside
  ]);

  // Now link issue and update status
  await prisma.$transaction([
    prisma.issue.update({
      where: { id: issueId },
      data: {
        projectId: project.id,
        status: IssueStatus.IN_PROGRESS,
      },
    }),
    prisma.auditLog.create({
      data: {
        issueId,
        projectId: project.id,
        actorId,
        action: 'ISSUE_CONVERTED_TO_PROJECT',
        metadata: { projectTitle: input.title, budget: input.budget, projectStatus },
      },
    }),
  ]);

  // Notify the citizen who raised the issue
  await notify(
    issue.createdById,
    tNotify('ISSUE_UPGRADED_TITLE'),
    tNotify('ISSUE_UPGRADED_BODY', undefined, issue.title, input.title),
    { issueId, projectId: project.id },
  );

  return project;
}

/**
 * Toggle duplicate status on an issue.
 * Includes cycle detection: prevents A→B→A or deeper circular chains.
 */
export async function toggleDuplicate(issueId: string, actorId: string, duplicateOfId?: string) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', tError('NOT_FOUND'));
  }

  if (duplicateOfId) {
    // Self-reference guard
    if (duplicateOfId === issueId) {
      throw new AppError(400, 'SELF_DUPLICATE', tError('SELF_DUPLICATE'));
    }

    const original = await prisma.issue.findUnique({ where: { id: duplicateOfId } });
    if (!original) {
      throw new AppError(400, 'INVALID_ISSUE', tError('INVALID_ISSUE'));
    }

    // ── Cycle detection ──────────────────────────────────────────────────────
    // Walk the duplicate chain from the target issue upward.
    // If we encounter the current issueId, linking would create a cycle.
    const MAX_CHAIN_DEPTH = 20; // safety limit to prevent infinite loops
    let current = original;
    let depth = 0;
    while (current.duplicateOfId && depth < MAX_CHAIN_DEPTH) {
      if (current.duplicateOfId === issueId) {
        throw new AppError(
          400,
          'DUPLICATE_CYCLE',
          'Cannot mark as duplicate — this would create a circular chain',
        );
      }
      current = await prisma.issue.findUnique({ where: { id: current.duplicateOfId } }) as any;
      if (!current) break;
      depth++;
    }
  }

  const newDuplicateOfId = issue.duplicateOfId ? null : (duplicateOfId ?? null);

  const [updated] = await prisma.$transaction([
    prisma.issue.update({
      where: { id: issueId },
      data: { duplicateOfId: newDuplicateOfId },
    }),
    prisma.auditLog.create({
      data: {
        issueId,
        actorId,
        action: newDuplicateOfId ? 'ISSUE_MARKED_DUPLICATE' : 'ISSUE_UNMARKED_DUPLICATE',
        metadata: { duplicateOfId: newDuplicateOfId },
      },
    }),
  ]);

  return updated;
}

/**
 * Assign an inspector to an issue (OFFICER/ADMIN action).
 * Issue must be ACCEPTED. Inspector must have INSPECTOR role.
 * Status transitions: ACCEPTED → INSPECTING
 */
export async function assignInspector(issueId: string, actorId: string, inspectorId: string) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw new AppError(404, 'NOT_FOUND', tError('NOT_FOUND'));
  if (issue.status !== IssueStatus.ACCEPTED && issue.status !== IssueStatus.INSPECTING)
    throw new AppError(400, 'INVALID_STATUS', tError('INVALID_STATUS'));

  const inspector = await prisma.user.findUnique({ where: { id: inspectorId } });
  if (!inspector || inspector.role !== Role.INSPECTOR)
    throw new AppError(400, 'INVALID_USER', tError('INVALID_USER'));
  if (inspector.adminUnitId !== issue.wardId)
    throw new AppError(403, 'WRONG_WARD', tError('WRONG_WARD'));

  const [updated] = await prisma.$transaction([
    prisma.issue.update({
      where: { id: issueId },
      data: { inspectorId, status: IssueStatus.INSPECTING },
      include: {
        inspector: { select: { id: true, name: true } },
        ward: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.create({
      data: {
        issueId, actorId,
        action: 'INSPECTOR_ASSIGNED',
        metadata: { inspectorId, inspectorName: inspector.name },
      },
    }),
  ]);

  // Notify the inspector
  await notify(
    inspectorId,
    tNotify('INSPECTION_ASSIGNMENT'),
    tNotify('INSPECTION_ASSIGN_BODY', undefined, issue.title),
    { issueId },
  );

  // Notify the citizen
  await notify(
    issue.createdById,
    tNotify('INSPECTOR_ASSIGNED_TITLE'),
    tNotify('INSPECTOR_ASSIGNED_BODY', undefined, issue.title),
    { issueId },
  );

  return updated;
}

/**
 * Hire a contractor for an issue (OFFICER/ADMIN action).
 * Issue must be INSPECTING and a BEFORE photo must already be uploaded.
 * Status transitions: INSPECTING → IN_PROGRESS
 * Optionally set a work deadline (slaDeadline) for the contractor.
 */
export async function hireContractor(
  issueId: string,
  actorId: string,
  contractorId: string,
  slaDeadline?: string,  // optional ISO date string
) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { evidence: { where: { type: EvidenceType.BEFORE } } },
  });
  if (!issue) throw new AppError(404, 'NOT_FOUND', tError('NOT_FOUND'));
  if (issue.status !== IssueStatus.INSPECTING)
    throw new AppError(400, 'INVALID_STATUS', 'Inspector must be assigned first (status must be INSPECTING)');
  if (issue.evidence.length === 0)
    throw new AppError(400, 'MISSING_BEFORE_PHOTO', 'Inspector must upload a BEFORE photo before a contractor is hired');

  const contractor = await prisma.user.findUnique({ 
    where: { id: contractorId },
    include: { adminUnit: true }
  });
  if (!contractor || contractor.role !== Role.CONTRACTOR)
    throw new AppError(400, 'INVALID_USER', 'User must have CONTRACTOR role');

  const issueWard = await prisma.adminUnit.findUnique({ where: { id: issue.wardId } });
  const isSameWard = contractor.adminUnitId === issue.wardId;
  const isCityLevel = contractor.adminUnitId === issueWard?.parentId;
  const isSameCityWard = contractor.adminUnit?.parentId === issueWard?.parentId;

  if (!isSameWard && !isCityLevel && !isSameCityWard) {
    throw new AppError(403, 'WRONG_WARD', tError('WRONG_WARD'));
  }

  // Parse optional deadline
  const now = new Date();
  const parsedDeadline = slaDeadline ? new Date(slaDeadline) : null;
  if (parsedDeadline && isNaN(parsedDeadline.getTime())) {
    throw new AppError(400, 'INVALID_DEADLINE', 'slaDeadline must be a valid ISO date string');
  }
  if (parsedDeadline && parsedDeadline <= now) {
    throw new AppError(400, 'INVALID_DEADLINE', 'slaDeadline must be in the future');
  }

  const [updated] = await prisma.$transaction([
    prisma.issue.update({
      where: { id: issueId },
      data: {
        contractorId,
        status: IssueStatus.IN_PROGRESS,
        ...(parsedDeadline ? { slaDeadline: parsedDeadline } : {}),
      },
      include: {
        contractor: { select: { id: true, name: true } },
        inspector:  { select: { id: true, name: true } },
        ward:       { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.create({
      data: {
        issueId, actorId,
        action: 'CONTRACTOR_HIRED',
        metadata: {
          contractorId,
          contractorName: contractor.name,
          ...(parsedDeadline ? { slaDeadline: parsedDeadline.toISOString() } : {}),
        },
      },
    }),
  ]);

  // Notify the contractor
  const deadlineMsg = parsedDeadline
    ? ` Deadline: ${parsedDeadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`
    : '';
  await notify(
    contractorId,
    'Work Assignment',
    `You have been hired to fix issue "${issue.title}". Please complete the work and mark it as done.${deadlineMsg}`,
    { issueId },
  );

  // Notify the citizen
  await notify(
    issue.createdById,
    'Work In Progress 🚧',
    `A contractor has been assigned and work has begun on your issue "${issue.title}".`,
    { issueId },
  );

  return updated;
}

/**
 * Contractor marks their work as done.
 * Only the assigned contractor can call this.
 * Status transitions: IN_PROGRESS → INSPECTING_WORK
 */
export async function markWorkDone(issueId: string, actorId: string) {
  const issue = await prisma.issue.findUnique({ 
    where: { id: issueId },
    include: { evidence: { where: { type: EvidenceType.CONTRACTOR } } },
  });
  if (!issue) throw new AppError(404, 'NOT_FOUND', tError('NOT_FOUND'));
  if (issue.contractorId !== actorId)
    throw new AppError(403, 'FORBIDDEN', tError('FORBIDDEN'));
  if (issue.status !== IssueStatus.IN_PROGRESS)
    throw new AppError(400, 'INVALID_STATUS', tError('INVALID_STATUS'));
  if (issue.evidence.length === 0)
    throw new AppError(400, 'MISSING_CONTRACTOR_PHOTO', 'Contractor must upload a CONTRACTOR evidence photo before marking work as done');

  const [updated] = await prisma.$transaction([
    prisma.issue.update({
      where: { id: issueId },
      data: { status: IssueStatus.INSPECTING_WORK },
      include: { ward: { select: { id: true, name: true } } },
    }),
    prisma.auditLog.create({
      data: {
        issueId, actorId,
        action: 'WORK_MARKED_DONE',
        metadata: {},
      },
    }),
  ]);

  // Notify ward officers that the contractor has finished
  await notifyWardOfficers(
    issue.wardId,
    'Work Completed 🔨',
    `Contractor has marked work done for issue "${issue.title}". Inspector must now submit an AFTER photo.`,
    { issueId },
  );

  // Notify the inspector — they must now upload the AFTER photo to complete the review
  if (issue.inspectorId) {
    await notify(
      issue.inspectorId,
      'AFTER Photo Required 📸',
      `Contractor has completed work on "${issue.title}". Please go on-site and submit your AFTER photo.`,
      { issueId },
    );
  }

  // Notify the citizen
  await notify(
    issue.createdById,
    'Work Completed 🔨',
    `The contractor has finished work on your issue "${issue.title}". A final inspection is now in progress.`,
    { issueId },
  );

  return updated;
}

/**
 * Set or update priority on an issue (OFFICER/ADMIN action).
 * Can be called in any status — priority is an orthogonal concern.
 */
export async function setPriority(
  issueId: string,
  actorId: string,
  priority: IssuePriority,
) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw new AppError(404, 'NOT_FOUND', tError('NOT_FOUND'));

  // Authorisation: must be the assigned officer OR a ward ADMIN
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw new AppError(403, 'FORBIDDEN', tError('FORBIDDEN'));

  const isAssignedOfficer = issue.assignedToId === actorId && actor.role === Role.OFFICER;
  const isWardAdmin = actor.role === Role.ADMIN && actor.adminUnitId === issue.wardId;

  if (!isAssignedOfficer && !isWardAdmin) {
    throw new AppError(403, 'FORBIDDEN', tError('FORBIDDEN'));
  }

  const previousPriority = issue.priority;

  const [updated] = await prisma.$transaction([
    prisma.issue.update({
      where: { id: issueId },
      data: { priority },
      include: {
        ward: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.create({
      data: {
        issueId,
        actorId,
        action: 'PRIORITY_SET',
        metadata: { previousPriority, newPriority: priority },
      },
    }),
  ]);

  return updated;
}
