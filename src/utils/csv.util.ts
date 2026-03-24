/**
 * JanPramaan — CSV parsing utility
 * Safely parses a CSV buffer into an array of records.
 * Uses the `csv-parse` library in synchronous mode for simplicity.
 */
import { parse } from 'csv-parse/sync';

export interface ResidentRow {
  name?: string;
  phone: string;
  latitude: string;
  longitude: string;
}

/**
 * Parse a UTF-8 CSV buffer into typed ResidentRow records.
 * Expects columns: name (optional), phone, latitude, longitude.
 */
export function parseResidentsCsv(buffer: Buffer): ResidentRow[] {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ResidentRow[];

  return records.filter((r) => r.phone && r.latitude && r.longitude);
}
