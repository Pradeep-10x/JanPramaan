/**
 * WitnessLedger — Proof service
 * Builds a tamper-evident proof bundle for an issue:
 * before/after hashes, merkle root, and verification info.
 */
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { merkleRoot } from '../utils/merkle.util';

/**
 * Build the public proof for an issue.
 * Returns before/after hashes, merkle root, verification info, and timestamps.
 */
export async function getIssueProof(issueId: string) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      evidence: { orderBy: { uploadedAt: 'asc' } },
      verification: {
        include: { verifiedBy: { select: { id: true, name: true } } },
      },
    },
  });

  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', 'Issue not found');
  }

  const beforeHashes = issue.evidence
    .filter((e) => e.type === 'BEFORE')
    .map((e) => e.fileHash);

  const afterHashes = issue.evidence
    .filter((e) => e.type === 'AFTER')
    .map((e) => e.fileHash);

  const allHashes = issue.evidence.map((e) => e.fileHash);

  const root = allHashes.length > 0 ? merkleRoot(allHashes) : null;

  return {
    issueId: issue.id,
    title: issue.title,
    status: issue.status,
    beforeHashes,
    afterHashes,
    merkleRoot: root,
    evidenceCount: allHashes.length,
    verification: issue.verification
      ? {
          verdict: issue.verification.verdict,
          remarks: issue.verification.remarks,
          verifiedBy: issue.verification.verifiedBy,
          verifiedAt: issue.verification.verifiedAt,
        }
      : null,
    timestamps: {
      created: issue.createdAt,
      updated: issue.updatedAt,
      slaDeadline: issue.slaDeadline,
    },
  };
}
