/**
 * WitnessLedger — Evidence service
 * Handles evidence upload, SHA-256 hashing, EXIF extraction,
 * and geo-proximity validation against the parent issue.
 */
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { EvidenceType, Role } from '../generated/prisma/client.js';
import { sha256Buffer } from '../utils/hash.util';
import { extractExif } from '../utils/exif.util';
import { haversineDistance } from '../utils/geo.util';
import { config } from '../config';


/**
 * Upload and store evidence for an issue.
 * Returns the created Evidence record and any geo-warning.
 */
export async function uploadEvidence(
  issueId: string,
  uploaderId: string,
  uploaderRole: string,
  type: EvidenceType,
  file: Express.Multer.File,
) {
  // Validate issue exists
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', 'Issue not found');
  }

  // AFTER evidence requires OFFICER or CONTRACTOR
  if (type === EvidenceType.AFTER && !['OFFICER', 'CONTRACTOR'].includes(uploaderRole)) {
    throw new AppError(403, 'FORBIDDEN', 'Only OFFICER or CONTRACTOR can upload AFTER evidence');
  }

  // Compute file hash
  const fileHash = sha256Buffer(file.buffer);

  // Extract EXIF data
  const exif = await extractExif(file.buffer);

  // Determine coordinates: use EXIF if available, else flag as geoFallback
  let evidenceLat = exif.latitude;
  let evidenceLon = exif.longitude;
  let geoFallback = false;

  if (evidenceLat === null || evidenceLon === null) {
    geoFallback = true;
    evidenceLat = null;
    evidenceLon = null;
  }

  // Geo-proximity check against issue location
  let geoWarning: string | null = null;
  if (evidenceLat !== null && evidenceLon !== null) {
    const distance = haversineDistance(issue.latitude, issue.longitude, evidenceLat, evidenceLon);
    if (distance > config.geoThresholdMetres) {
      geoWarning = `Evidence location is ${Math.round(distance)}m from issue (threshold: ${config.geoThresholdMetres}m)`;
      geoFallback = true;
    }
  }

  // Save file to disk
  const ext = path.extname(file.originalname) || '.bin';
  const filename = `${Date.now()}-${fileHash.slice(0, 8)}${ext}`;
  const uploadDir = config.uploadDir;

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, file.buffer);

  const fileUrl = `/uploads/${filename}`;

  // Create evidence record
  const evidence = await prisma.evidence.create({
    data: {
      issueId,
      type,
      fileUrl,
      fileHash,
      latitude: evidenceLat,
      longitude: evidenceLon,
      exifTime: exif.datetime,
      geoFallback,
      uploadedById: uploaderId,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      issueId,
      actorId: uploaderId,
      action: `EVIDENCE_UPLOADED_${type}`,
      metadata: {
        evidenceId: evidence.id,
        fileHash,
        geoFallback,
        geoWarning,
      },
    },
  });

  return { evidence, geoWarning };
}

/**
 * List all evidence for a given issue.
 */
export async function listEvidence(issueId: string) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', 'Issue not found');
  }

  return prisma.evidence.findMany({
    where: { issueId },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { uploadedAt: 'asc' },
  });
}
