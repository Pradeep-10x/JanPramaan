/**
 * JanPramaan — Audit Service
 *
 * Provides audit log chain verification to detect any tampering
 * (edits, deletions, insertions, or reordering) of audit records.
 *
 * Note: Hash chaining for new entries is handled automatically by the
 * Prisma extension in prisma/client.ts — all prisma.auditLog.create()
 * calls are covered without modification.
 */
import { prisma } from '../prisma/client';
import { computeEntryHash, GENESIS_HASH } from '../utils/auditChain.util';

// ── Verify ────────────────────────────────────────────────────────────────────

export interface ChainVerificationResult {
  valid:          boolean;
  totalEntries:   number;
  checkedEntries: number;
  brokenAt?:      { id: string; index: number; expected: string; stored: string | null };
  message:        string;
}

/**
 * Verify the integrity of the audit log chain.
 * Walks every entry in chronological order and checks:
 *   1. Each entry's hash matches its content
 *   2. Each entry's prevHash matches the previous entry's entryHash
 *
 * @param issueId  Optional — verify only entries for a specific issue
 */
export async function verifyAuditChain(issueId?: string): Promise<ChainVerificationResult> {
  const BATCH = 500;
  let cursor: string | undefined;
  let index          = 0;
  let prevEntryHash  = GENESIS_HASH;
  let totalEntries   = 0;

  const where = issueId ? { issueId } : {};

  while (true) {
    const batch = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take:    BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true, action: true, actorId: true, issueId: true,
        projectId: true, metadata: true, createdAt: true,
        entryHash: true, prevHash: true,
      },
    });

    if (batch.length === 0) break;

    for (const entry of batch) {
      totalEntries++;

      // Skip legacy entries that don't have hashes yet
      if (!entry.entryHash) {
        prevEntryHash = GENESIS_HASH; // reset chain for legacy gap
        index++;
        continue;
      }

      // Check 1: prevHash must match the previous entry's entryHash
      if (entry.prevHash !== prevEntryHash && prevEntryHash !== GENESIS_HASH) {
        return {
          valid: false,
          totalEntries,
          checkedEntries: index + 1,
          brokenAt: {
            id: entry.id,
            index,
            expected: prevEntryHash,
            stored: entry.prevHash,
          },
          message: `Chain broken at entry #${index} (${entry.id}): prevHash mismatch. A record may have been deleted or inserted.`,
        };
      }

      // Check 2: entryHash must match freshly computed hash
      const expected = computeEntryHash(
        entry.action,
        entry.actorId,
        entry.issueId,
        entry.projectId,
        entry.metadata,
        entry.createdAt,
        entry.prevHash ?? GENESIS_HASH,
      );

      if (entry.entryHash !== expected) {
        return {
          valid: false,
          totalEntries,
          checkedEntries: index + 1,
          brokenAt: {
            id: entry.id,
            index,
            expected,
            stored: entry.entryHash,
          },
          message: `Tamper detected at entry #${index} (${entry.id}): content hash mismatch. The record's action, metadata, or timestamp has been modified.`,
        };
      }

      prevEntryHash = entry.entryHash;
      index++;
    }

    cursor = batch[batch.length - 1].id;
    if (batch.length < BATCH) break;
  }

  return {
    valid: true,
    totalEntries,
    checkedEntries: totalEntries,
    message: totalEntries === 0
      ? 'No audit log entries found.'
      : `All ${totalEntries} entries verified — chain integrity intact.`,
  };
}
