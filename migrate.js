import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function run() {
  await prisma.$executeRawUnsafe(`UPDATE "Issue" SET "status" = 'INSPECTING_WORK' WHERE "status" = 'WORK_DONE'`);
  console.log("Migration done");
}
run().finally(() => prisma.$disconnect());
