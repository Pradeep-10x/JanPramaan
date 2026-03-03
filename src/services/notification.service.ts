/**
 * WitnessLedger — Notification service
 * Finds nearby residents for an issue and creates notification log entries.
 * Optionally sends via Twilio if configured.
 */
import crypto from 'crypto';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { NotificationChannel } from '../generated/prisma/client.js';
import { haversineDistance } from '../utils/geo.util';
import { parseResidentsCsv, ResidentRow } from '../utils/csv.util';
import { config } from '../config';

/**
 * Import residents from a CSV buffer. Phone numbers are hashed for privacy.
 */
export async function importResidents(buffer: Buffer) {
  const rows = parseResidentsCsv(buffer);

  const created = [];
  for (const row of rows) {
    const phoneHash = crypto
      .createHash('sha256')
      .update(row.phone + config.residentPhoneSalt)
      .digest('hex');

    const resident = await prisma.resident.create({
      data: {
        name: row.name || null,
        phoneHash,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
      },
    });
    created.push(resident);
  }

  return { imported: created.length, residents: created };
}

/**
 * Find residents within radius of an issue and create notification logs.
 * Uses in-memory haversine filtering (for PostGIS, use SQL ST_DWithin).
 */
export async function notifyNearbyResidents(
  issueId: string,
  actorId: string,
  radiusMetres: number = 50,
) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) {
    throw new AppError(404, 'NOT_FOUND', 'Issue not found');
  }

  // Fetch all residents (in production, use PostGIS ST_DWithin for efficiency)
  const allResidents = await prisma.resident.findMany();

  const nearby = allResidents.filter((r) => {
    const distance = haversineDistance(issue.latitude, issue.longitude, r.latitude, r.longitude);
    return distance <= radiusMetres;
  });

  const message = `Issue "${issue.title}" reported near your location. Status: ${issue.status}`;

  const logs = [];
  for (const resident of nearby) {
    const log = await prisma.notificationLog.create({
      data: {
        issueId,
        recipientHash: resident.phoneHash,
        message,
        channel: NotificationChannel.SYSTEM,
        status: config.twilio.sid ? 'PENDING' : 'SIMULATED',
      },
    });
    logs.push(log);

    // TODO: If Twilio is configured, send actual SMS here
    // if (config.twilio.sid && config.twilio.token) {
    //   await twilioClient.messages.create({ ... });
    //   await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'SENT' } });
    // }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      issueId,
      actorId,
      action: 'RESIDENTS_NOTIFIED',
      metadata: { nearbyCount: nearby.length, radiusMetres },
    },
  });

  return { notified: logs.length, logs };
}
