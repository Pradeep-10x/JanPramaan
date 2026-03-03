/**
 * WitnessLedger — EXIF metadata extraction
 * Uses the `exifr` library to extract GPS coordinates and datetime from images.
 * Gracefully returns null fields when EXIF data is absent or unparseable.
 */
import exifr from 'exifr';

export interface ExifData {
  latitude: number | null;
  longitude: number | null;
  datetime: Date | null;
}

/**
 * Extract GPS and datetime EXIF data from an image buffer.
 * Returns null fields when data is not available.
 */
export async function extractExif(buffer: Buffer): Promise<ExifData> {
  try {
    const output = await exifr.parse(buffer, {
      gps: true,
      pick: ['GPSLatitude', 'GPSLongitude', 'DateTimeOriginal', 'CreateDate'],
    });

    if (!output) {
      return { latitude: null, longitude: null, datetime: null };
    }

    return {
      latitude: output.latitude ?? null,
      longitude: output.longitude ?? null,
      datetime: output.DateTimeOriginal ?? output.CreateDate ?? null,
    };
  } catch {
    // Image may not contain EXIF or may be a non-image file
    return { latitude: null, longitude: null, datetime: null };
  }
}
