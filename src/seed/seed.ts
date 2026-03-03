/*
 * Creates admin units, users, sample issues, projects, and residents.
 * Run via: npx prisma db seed  OR  npm run seed
 */
import { PrismaClient, Role, AdminUnitType, IssueStatus, ProjectStatus ,Department } from '../generated/prisma/client.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const SALT_ROUNDS = 12;
const PHONE_SALT = process.env.RESIDENT_PHONE_SALT || 'some_salt';

// ──────────────────────────────────────────────────────────
// Seed credentials (printed at end)
// ──────────────────────────────────────────────────────────
const SEED_USERS = [
  { name: 'Admin User', email: 'admin@demo.local', password: 'AdminPass123!', role: Role.ADMIN, ward: null },
  { name: 'City Officer', email: 'cityofficer@demo.local', password: 'OfficerPass123!', role: Role.OFFICER, ward: null, city: true },
  { name: 'Inspector', email: 'inspector@demo.local', password: 'InspectorPass123!', role: Role.INSPECTOR, ward: null },
  { name: 'Ward 12 Officer', email: 'officer12@demo.local', password: 'OfficerPass123!', role: Role.OFFICER, ward: 'Ward 12' },
  { name: 'Ward 13 Officer', email: 'officer13@demo.local', password: 'OfficerPass123!', role: Role.OFFICER, ward: 'Ward 13' },
  { name: 'Ward 14 Officer', email: 'officer14@demo.local', password: 'OfficerPass123!', role: Role.OFFICER, ward: 'Ward 14' },
];

async function main() {
  console.log(' \n WitnessLedger seed starting... \n');

  //  Admin Units
  const india = await prisma.adminUnit.create({
    data: { name: 'India', type: AdminUnitType.GLOBAL },
  });
  console.log(` AdminUnit: India (GLOBAL) → ${india.id}`);

  const lucknow = await prisma.adminUnit.create({
    data: { name: 'Lucknow', type: AdminUnitType.CITY, parentId: india.id },
  });
  console.log(` AdminUnit: Lucknow (CITY) → ${lucknow.id}`);

  const wards: Record<string, string> = {};
  for (const wardName of ['Ward 12', 'Ward 13', 'Ward 14']) {
    const ward = await prisma.adminUnit.create({
      data: { name: wardName, type: AdminUnitType.WARD, parentId: lucknow.id },
    });
    wards[wardName] = ward.id;
    console.log(` AdminUnit: ${wardName} (WARD) → ${ward.id}`);
  }

  //  Users 
  const createdUsers: Record<string, string> = {};
  console.log('\n  Seeded credentials:');
  console.log('  ─────────────────────────────────────────────');

  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
    let adminUnitId: string | undefined;

    if (u.ward) {
      adminUnitId = wards[u.ward];
    } else if ((u as any).city) {
      adminUnitId = lucknow.id;
    }

    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        adminUnitId,
      },
    });

    createdUsers[u.email] = user.id;
    console.log(`  │ ${u.role.padEnd(10)} │ ${u.email.padEnd(28)} │ ${u.password}`);
  }
  console.log('  ─────────────────────────────────────────────\n');

  //  Sample Issues 
  const issue1 = await prisma.issue.create({
    data: {
      title: 'Pothole on MG Road near Ward 12 crossing',
      description: 'Large pothole causing accidents near the main crossing. Approximately 2 feet deep.',
      department : Department.MUNICIPAL,
      latitude: 26.8467,
      longitude: 80.9462,
      wardId: wards['Ward 12'],
      createdById: createdUsers['admin@demo.local'],
      assignedToId: createdUsers['officer12@demo.local'],
      status: IssueStatus.ASSIGNED,
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });
  console.log(`  ✅ Issue: "${issue1.title}" → ${issue1.id}`);

  // Audit log for issue 1
  await prisma.auditLog.create({
    data: {
      issueId: issue1.id,
      actorId: createdUsers['admin@demo.local'],
      action: 'ISSUE_CREATED',
      metadata: { autoAssigned: true, status: 'ASSIGNED' },
    },
  });

  const issue2 = await prisma.issue.create({
    data: {
      title: 'Broken streetlight on Hazratganj in Ward 13',
      description: 'Streetlight #45 has been non-functional for 2 weeks. Area is unsafe at night.',
      department : Department.ELECTRICITY,
      latitude: 26.8490,
      longitude: 80.9475,
      wardId: wards['Ward 13'],
      createdById: createdUsers['admin@demo.local'],
      assignedToId: createdUsers['officer13@demo.local'],
      status: IssueStatus.ASSIGNED,
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });
  console.log(`  ✅ Issue: "${issue2.title}" → ${issue2.id}`);

  await prisma.auditLog.create({
    data: {
      issueId: issue2.id,
      actorId: createdUsers['admin@demo.local'],
      action: 'ISSUE_CREATED',
      metadata: { autoAssigned: true, status: 'ASSIGNED' },
    },
  });

  //  Sample Project 
  const project = await prisma.project.create({
    data: {
      title: 'Ward 12 Drainage Infrastructure',
      description: 'Major drainage upgrade and maintenance project covering the entirety of Ward 12.',
      budget: 1500000,
      status: ProjectStatus.ACTIVE,
      adminUnitId: lucknow.id,
      createdById: createdUsers['admin@demo.local'],
    },
  });
  console.log(`  ✅ Project: "${project.title}" → ${project.id}`);

  await prisma.auditLog.create({
    data: {
      projectId: project.id,
      actorId: createdUsers['admin@demo.local'],
      action: 'PROJECT_CREATED',
      metadata: { title: project.title, status: 'ACTIVE' },
    },
  });

  // Link issue1 to project (optional)
  await prisma.issue.update({
    where: { id: issue1.id },
    data: { projectId: project.id },
  });

  //  Residents from CSV 
 const csvPath = path.join(process.cwd(), 'src/seed/sample-data/residents.csv')
  const csvBuffer = fs.readFileSync(csvPath);
  const rows = parse(csvBuffer, { columns: true, trim: true, skip_empty_lines: true }) as Array<{
    name: string;
    phone: string;
    latitude: string;
    longitude: string;
  }>;

  let residentCount = 0;
  for (const row of rows) {
    const phoneHash = crypto
      .createHash('sha256')
      .update(row.phone + PHONE_SALT)
      .digest('hex');

    await prisma.resident.create({
      data: {
        name: row.name || null,
        phoneHash,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
      },
    });
    residentCount++;
  }
  console.log(`  ✅ Residents imported: ${residentCount}`);

  console.log('\n🎉  Seed complete!\n');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
