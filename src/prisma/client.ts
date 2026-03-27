/**
 * JanPramaan — Prisma client singleton
 * Re-uses a single PrismaClient instance across the application.
 * Prisma 7 uses driver adapters for direct database connections.
 *
 * Includes Prisma extension for automatic audit log hash chaining.
 */
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { computeEntryHash, GENESIS_HASH } from '../utils/auditChain.util.js';

const connectionString = process.env.DATABASE_URL!;

// Supabase always requires SSL
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// PrismaPg takes pool directly as first arg, NOT { pool }
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

// ── Audit log hash-chain extension ────────────────────────────────────────
// Intercepts every AuditLog.create and automatically computes the hash chain.
// This covers ALL callers (including $transaction) without modifying them.
export const prisma = basePrisma.$extends({
  query: {
    auditLog: {
      async create({ args, query }) {
        // Fetch the most recent entry's hash for chaining
        const latest = await basePrisma.auditLog.findFirst({
          orderBy: { createdAt: 'desc' },
          select:  { entryHash: true },
        });

        const prevHash  = latest?.entryHash ?? GENESIS_HASH;
        const now       = args.data.createdAt instanceof Date ? args.data.createdAt : new Date();
        const action    = args.data.action;
        const actorId   = (args.data.actorId ?? args.data.actor?.connect?.id ?? null) as string | null;
        const issueId   = (args.data.issueId ?? args.data.issue?.connect?.id ?? null) as string | null;
        const projectId = (args.data.projectId ?? args.data.project?.connect?.id ?? null) as string | null;
        const metadata  = args.data.metadata ?? null;

        const entryHash = computeEntryHash(
          action,
          actorId,
          issueId,
          projectId,
          metadata,
          now,
          prevHash,
        );

        // Inject hash fields into the create data
        args.data.entryHash = entryHash;
        args.data.prevHash  = prevHash;
        args.data.createdAt = now;

        return query(args);
      },
    },
  },
});

