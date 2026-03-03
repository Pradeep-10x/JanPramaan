/**
 * WitnessLedger — Unit test: Merkle tree utility
 */
import { merkleRoot } from '../../utils/merkle.util';
import { sha256Buffer } from '../../utils/hash.util';
import crypto from 'crypto';

function hashPair(a: string, b: string): string {
  return crypto.createHash('sha256').update(a + b).digest('hex');
}

describe('merkle.util', () => {
  describe('merkleRoot', () => {
    it('should throw for empty array', () => {
      expect(() => merkleRoot([])).toThrow('Cannot compute merkle root of empty array');
    });

    it('should return the single hash for a one-element array', () => {
      const hash = sha256Buffer(Buffer.from('file1'));
      expect(merkleRoot([hash])).toBe(hash);
    });

    it('should compute correct root for two hashes', () => {
      const h1 = sha256Buffer(Buffer.from('file1'));
      const h2 = sha256Buffer(Buffer.from('file2'));
      const expected = hashPair(h1, h2);
      expect(merkleRoot([h1, h2])).toBe(expected);
    });

    it('should handle odd number of leaves by duplicating the last', () => {
      const h1 = sha256Buffer(Buffer.from('a'));
      const h2 = sha256Buffer(Buffer.from('b'));
      const h3 = sha256Buffer(Buffer.from('c'));

      // Level 1: [hash(h1+h2), hash(h3+h3)]
      const left = hashPair(h1, h2);
      const right = hashPair(h3, h3);
      const expected = hashPair(left, right);

      expect(merkleRoot([h1, h2, h3])).toBe(expected);
    });

    it('should compute correct root for four hashes', () => {
      const hashes = ['a', 'b', 'c', 'd'].map((s) => sha256Buffer(Buffer.from(s)));

      const l1 = hashPair(hashes[0], hashes[1]);
      const l2 = hashPair(hashes[2], hashes[3]);
      const expected = hashPair(l1, l2);

      expect(merkleRoot(hashes)).toBe(expected);
    });

    it('should be deterministic — same input same output', () => {
      const hashes = ['x', 'y', 'z'].map((s) => sha256Buffer(Buffer.from(s)));
      const root1 = merkleRoot(hashes);
      const root2 = merkleRoot([...hashes]);
      expect(root1).toBe(root2);
    });

    it('should produce different roots for different orderings', () => {
      const h1 = sha256Buffer(Buffer.from('first'));
      const h2 = sha256Buffer(Buffer.from('second'));
      const root1 = merkleRoot([h1, h2]);
      const root2 = merkleRoot([h2, h1]);
      expect(root1).not.toBe(root2);
    });
  });
});
