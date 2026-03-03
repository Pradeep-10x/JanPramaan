/**
 * WitnessLedger — Unit test: SHA-256 hash utility
 */
import { sha256Buffer } from '../../utils/hash.util';

describe('hash.util', () => {
  describe('sha256Buffer', () => {
    it('should compute correct SHA-256 for a known string', () => {
      const input = Buffer.from('hello world');
      // SHA-256 of "hello world"
      const expected = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
      expect(sha256Buffer(input)).toBe(expected);
    });

    it('should return different hashes for different inputs', () => {
      const hash1 = sha256Buffer(Buffer.from('test1'));
      const hash2 = sha256Buffer(Buffer.from('test2'));
      expect(hash1).not.toBe(hash2);
    });

    it('should return consistent results for the same input', () => {
      const input = Buffer.from('deterministic');
      expect(sha256Buffer(input)).toBe(sha256Buffer(input));
    });

    it('should produce a 64-character hex string', () => {
      const hash = sha256Buffer(Buffer.from('anything'));
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle empty buffer', () => {
      const hash = sha256Buffer(Buffer.alloc(0));
      // SHA-256 of empty input
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });
});
