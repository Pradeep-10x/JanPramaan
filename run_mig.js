import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function run() {
  try {
    const result = await prisma.$executeRawUnsafe(`UPDATE "Issue" SET "status" = 'INSPECTING_WORK' WHERE "status" = 'WORK_DONE'`);
    console.log(`Updated ${result} rows for INSPECTING_WORK`);
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
