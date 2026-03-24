/**
 * JanPramaan — SHA-256 hashing utility
 * Computes hex-encoded SHA-256 digest from a file buffer.
 */
import crypto from 'crypto';
import fs from 'fs';

/**
 * Compute SHA-256 hash of a Buffer, returning hex string.
 */
export function sha256Buffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compute SHA-256 hash of a file via streaming (memory-safe for large files).
 */
export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
