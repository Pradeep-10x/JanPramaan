cat << 'INNER_EOF' >> src/services/issue.service.ts

export async function rejectWorkDone(issueId: string, actorId: string, remarks: string) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { evidence: { where: { type: 'CONTRACTOR' } } },
  });
  if (!issue) throw new AppError(404, 'NOT_FOUND', 'Issue not found');
  if (issue.inspectorId !== actorId)
    throw new AppError(403, 'FORBIDDEN', 'Only the assigned inspector can reject work');
  if (issue.status !== 'INSPECTING')
    throw new AppError(400, 'INVALID_STATUS', 'Issue must be in INSPECTING status to reject work');
  if (issue.evidence.length === 0)
    throw new AppError(400, 'NO_CONTRACTOR_PHOTO', 'No contractor photo to reject');

  const [updated] = await prisma.$transaction([
    prisma.issue.update({
      where: { id: issueId },
      data: { status: 'IN_PROGRESS' },
    }),
    prisma.auditLog.create({
      data: {
        issueId,
        actorId,
        action: 'WORK_REJECTED',
        metadata: { remarks },
      },
    }),
  ]);

  if (issue.contractorId) {
    await notify(
      issue.contractorId,
      '❌ Work Rejected',
      `Your work for "${issue.title}" has been rejected. Remarks: ${remarks}`,
      { issueId }
    );
  }

  // Also notify the officer
  const officer = await prisma.user.findFirst({
    where: { role: 'OFFICER', adminUnitId: issue.wardId },
  });
  if (officer) {
    await notify(
      officer.id,
      '⚠️ Work Rejected',
      `Inspector has rejected work for "${issue.title}". Remarks: ${remarks}`,
      { issueId }
    );
  }

  return updated;
}
INNER_EOF
