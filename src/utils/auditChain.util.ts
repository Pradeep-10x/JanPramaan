/**
 * JanPramaan — Audit Chain Utility
 *
 * Computes deterministic SHA-256 hashes for audit log entries.
 * Each entry's hash includes the previous entry's hash, forming
 * an append-only chain. Any modification to any record breaks
 * the chain and is instantly detectable.
 *
 * Hash payload: SHA-256( action | actorId | issueId | metadata_json | createdAt_iso | prevHash )
 * Separator: `|` prevents field concatenation ambiguity.
 */
import crypto from 'crypto';

/** Sentinel hash for the very first entry in the chain. */
export const GENESIS_HASH = 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Compute the SHA-256 entry hash for an audit log record.
 * All fields are normalised to deterministic strings before hashing.
 */
export function computeEntryHash(
  action:    string,
  actorId:   string | null,
  issueId:   string | null,
  projectId: string | null,
  metadata:  unknown,
  createdAt: Date | string,
  prevHash:  string,
): string {
  const metaStr  = metadata ? JSON.stringify(metadata, Object.keys(metadata as object).sort()) : '';
  const timeStr  = typeof createdAt === 'string' ? createdAt : createdAt.toISOString();
  const payload  = [
    action,
    actorId   ?? '',
    issueId   ?? '',
    projectId ?? '',
    metaStr,
    timeStr,
    prevHash,
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Verify that an entry's stored hash matches a freshly computed one.
 */
export function verifyEntryHash(
  entry: {
    action:    string;
    actorId:   string | null;
    issueId:   string | null;
    projectId: string | null;
    metadata:  unknown;
    createdAt: Date | string;
    entryHash: string | null;
    prevHash:  string | null;
  },
): { valid: boolean; expected: string; stored: string | null } {
  const expected = computeEntryHash(
    entry.action,
    entry.actorId,
    entry.issueId,
    entry.projectId,
    entry.metadata,
    entry.createdAt,
    entry.prevHash ?? GENESIS_HASH,
  );

  return {
    valid:    entry.entryHash === expected,
    expected,
    stored:   entry.entryHash,
  };
}
