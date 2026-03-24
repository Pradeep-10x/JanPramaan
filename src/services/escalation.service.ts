/**
 * JanPramaan — Escalation service
 *
 * Runs as a background job. Scans for stalled issues and notifies
 * admins + relevant parties so nothing falls through the cracks.
 *
 * Three checks on every run:
 *  1. OPEN > 48 h with no officer action          → notify all ADMINs
 *  2. SLA deadline breached, not yet resolved      → notify all ADMINs
 *  3. WORK_DONE > 24 h (inspector hasn't sent AFTER photo) → nudge inspector
 */
import { prisma } from '../prisma/client';
import { IssueStatus } from '../generated/prisma/client.js';
import { notify, notifyWardStaff } from './notification.service.js';
import { logger } from '../app.js';

const OPEN_ESCALATION_HOURS      = 48;
const WORK_DONE_ESCALATION_HOURS = 24;

export async function runEscalationCheck(): Promise<{ escalated: number }> {
  logger.info('[Escalation] Starting check…');
  const now  = new Date();
  let   total = 0;

  // ── 1. OPEN too long ─────────────────────────────────────────────────────
  const openCutoff = new Date(now.getTime() - OPEN_ESCALATION_HOURS * 3_600_000);

  const staleOpen = await prisma.issue.findMany({
    where: {
      status:      IssueStatus.OPEN,
      createdAt:   { lt: openCutoff },
      escalatedAt: null,
    },
    include: { ward: { select: { name: true } } },
  });

  if (staleOpen.length) {
    for (const issue of staleOpen) {
      await notifyWardStaff(
        issue.wardId,
        '⚠️ Issue Not Picked Up',
        `"${issue.title}" in ${issue.ward.name} has been OPEN for over ${OPEN_ESCALATION_HOURS}h with no action.`,
        { issueId: issue.id },
      );
      await prisma.issue.update({ where: { id: issue.id }, data: { escalatedAt: now } });
      await prisma.auditLog.create({
        data: {
          issueId:  issue.id,
          actorId:  null,
          action:   'ISSUE_ESCALATED',
          metadata: { reason: 'OPEN_TOO_LONG', hoursOpen: OPEN_ESCALATION_HOURS },
        },
      });
    }
    total += staleOpen.length;
    logger.info(`[Escalation] ${staleOpen.length} OPEN-too-long issue(s) escalated.`);
  }

  // ── 2. SLA breached ──────────────────────────────────────────────────────
  const slaBreached = await prisma.issue.findMany({
    where: {
      slaDeadline: { lt: now, not: null },
      status: {
        notIn: [
          IssueStatus.VERIFIED,
          IssueStatus.COMPLETED,
          IssueStatus.REJECTED,
        ],
      },
      escalatedAt: null,
    },
    include: { ward: { select: { name: true } } },
  });

  if (slaBreached.length) {
    for (const issue of slaBreached) {
      await notifyWardStaff(
        issue.wardId,
        '🚨 SLA Breached',
        `"${issue.title}" in ${issue.ward.name} has exceeded its SLA deadline and is still ${issue.status}.`,
        { issueId: issue.id },
      );
      // Also notify the citizen
      await notify(
        issue.createdById,
        '⏰ Your Issue Is Overdue',
        `We are sorry — your issue "${issue.title}" has exceeded its target resolution time. Our team has been alerted.`,
        { issueId: issue.id },
      );
      await prisma.issue.update({ where: { id: issue.id }, data: { escalatedAt: now } });
      await prisma.auditLog.create({
        data: {
          issueId:  issue.id,
          actorId:  null,
          action:   'ISSUE_ESCALATED',
          metadata: { reason: 'SLA_BREACHED', status: issue.status },
        },
      });
    }
    total += slaBreached.length;
    logger.info(`[Escalation] ${slaBreached.length} SLA-breached issue(s) escalated.`);
  }

  // ── 3. WORK_DONE — inspector hasn't submitted AFTER photo ────────────────
  const workDoneCutoff = new Date(now.getTime() - WORK_DONE_ESCALATION_HOURS * 3_600_000);

  const staleWorkDone = await prisma.issue.findMany({
    where: {
      status:      IssueStatus.WORK_DONE,
      updatedAt:   { lt: workDoneCutoff },
      escalatedAt: null,
    },
    include: { ward: { select: { name: true } } },
  });

  if (staleWorkDone.length) {
    for (const issue of staleWorkDone) {
      // Nudge the inspector
      if (issue.inspectorId) {
        await notify(
          issue.inspectorId,
          '⚠️ AFTER Photo Required',
          `Work on "${issue.title}" was marked done ${WORK_DONE_ESCALATION_HOURS}h ago. Please submit your AFTER photo to complete the inspection.`,
          { issueId: issue.id },
        );
      }
      // Alert all staff in the same ward
      await notifyWardStaff(
        issue.wardId,
        '⚠️ Inspection Stalled',
        `"${issue.title}" in ${issue.ward.name} has been WORK_DONE for over ${WORK_DONE_ESCALATION_HOURS}h. Inspector has not yet submitted an AFTER photo.`,
        { issueId: issue.id },
      );
      await prisma.issue.update({ where: { id: issue.id }, data: { escalatedAt: now } });
      await prisma.auditLog.create({
        data: {
          issueId:  issue.id,
          actorId:  null,
          action:   'ISSUE_ESCALATED',
          metadata: { reason: 'WORK_DONE_NO_AFTER_PHOTO', hoursWaiting: WORK_DONE_ESCALATION_HOURS },
        },
      });
    }
    total += staleWorkDone.length;
    logger.info(`[Escalation] ${staleWorkDone.length} WORK_DONE-stalled issue(s) escalated.`);
  }

  logger.info(`[Escalation] Check complete. Total escalated: ${total}`);
  return { escalated: total };
}
