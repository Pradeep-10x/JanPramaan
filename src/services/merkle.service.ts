/**
 * JanPramaan — Merkle service
 * Higher-level service wrapping the merkle utility for batch proof generation.
 */
import { prisma } from '../prisma/client';
import { merkleRoot } from '../utils/merkle.util';

/**
 * Compute Merkle root for all evidence hashes of a given issue.
 */
export async function computeIssueMerkleRoot(issueId: string): Promise<string | null> {
  const evidence = await prisma.evidence.findMany({
    where: { issueId },
    orderBy: { uploadedAt: 'asc' },
    select: { fileHash: true },
  });

  if (evidence.length === 0) return null;

  return merkleRoot(evidence.map((e) => e.fileHash));
}

/**
 * Compute Merkle roots for all issues that have evidence.
 * Useful for batch integrity audits.
 */
export async function computeAllMerkleRoots(): Promise<Record<string, string>> {
  const issues = await prisma.issue.findMany({
    where: { evidence: { some: {} } },
    select: {
      id: true,
      evidence: { orderBy: { uploadedAt: 'asc' }, select: { fileHash: true } },
    },
  });

  const roots: Record<string, string> = {};
  for (const issue of issues) {
    roots[issue.id] = merkleRoot(issue.evidence.map((e) => e.fileHash));
  }

  return roots;
}
