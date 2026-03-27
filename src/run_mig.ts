import 'dotenv/config';
import { prisma } from './prisma/client.js';

async function run() {
  try {
    // Add PushToken table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PushToken" (
        "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
        "userId"    TEXT NOT NULL,
        "token"     TEXT NOT NULL,
        "platform"  TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId")
          REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    // Unique constraint on (userId, token)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "PushToken_userId_token_key"
        ON "PushToken"("userId", "token");
    `);

    // Index on userId for fast lookups
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "PushToken_userId_idx"
        ON "PushToken"("userId");
    `);

    console.log("Migration executed successfully!");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
