import { prisma } from './prisma/client';
async function run() {
  await prisma.$executeRawUnsafe(`UPDATE "Issue" SET "status" = 'INSPECTING_WORK' WHERE "status" = 'WORK_DONE'`);
  console.log("Data migrated");
  process.exit(0);
}
run();
