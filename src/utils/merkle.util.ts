/**
 * JanPramaan — Deterministic Merkle tree utility
 *
 * Builds a binary Merkle tree from an array of hex-encoded leaf hashes.
 * If the leaf count is odd, the last leaf is duplicated (standard padding).
 * Returns the hex-encoded root hash.
 */
import crypto from 'crypto';

/** Concatenate two hex strings and return their SHA-256 hash. */
function hashPair(a: string, b: string): string {
  return crypto.createHash('sha256').update(a + b).digest('hex');
}

/**
 * Compute the Merkle root of an array of hex-encoded hashes.
 * @throws if the input array is empty
 */
export function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    throw new Error('Cannot compute merkle root of empty array');
  }
  if (hashes.length === 1) {
    return hashes[0];
  }

  let level = [...hashes];

  while (level.length > 1) {
    const next: string[] = [];
    // Duplicate last element if odd count
    if (level.length % 2 !== 0) {
      level.push(level[level.length - 1]);
    }
    for (let i = 0; i < level.length; i += 2) {
      next.push(hashPair(level[i], level[i + 1]));
    }
    level = next;
  }

  return level[0];
}
