import { prisma } from './prisma/client.js';

async function run() {
  try {
    await prisma.$executeRawUnsafe(`UPDATE "Issue" SET "status" = 'INSPECTING_WORK' WHERE "status" = 'WORK_DONE'`);
    console.log("Migration executed successfully!");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
