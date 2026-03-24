/**
 * JanPramaan — User service
 * Admin-only user creation (officers, inspectors, admins, contractors).
 */
import bcrypt from 'bcrypt';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { Role } from '../generated/prisma/client.js';

const SALT_ROUNDS = 12;

export interface CreateUserInput {
  name: string;
  email?: string;
  password: string;
  role: Role;
  adminUnitId?: string;
}

/**
 * Create a user with any role (ADMIN-only action).
 */
export async function createUser(input: CreateUserInput, actorId: string) {
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'A user with that email already exists');
    }
  }

  if (input.adminUnitId) {
    const unit = await prisma.adminUnit.findUnique({ where: { id: input.adminUnitId } });
    if (!unit) {
      throw new AppError(400, 'INVALID_UNIT', 'Admin unit not found');
    }
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      adminUnitId: input.adminUnitId,
    },
    select: { id: true, name: true, email: true, role: true, adminUnitId: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'USER_CREATED',
      metadata: { createdUserId: user.id, role: input.role, adminUnitId: input.adminUnitId ?? null },
    },
  });

  return user;
}

export async function createContractor(input: CreateUserInput, actorId: string) {

  if(input.role !== "CONTRACTOR"){
    throw new AppError(400, 'INVALID_ROLE', 'Role must be CONTRACTOR');
  }

  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'A user with that email already exists');
    }
  }

  if (input.adminUnitId) {
    const unit = await prisma.adminUnit.findUnique({ where: { id: input.adminUnitId } });
    if (!unit) {
      throw new AppError(400, 'INVALID_UNIT', 'Admin unit not found');
    }
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: "CONTRACTOR",
      adminUnitId: input.adminUnitId,
    },
    select: { id: true, name: true, email: true, role: true, adminUnitId: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'CONTRACTOR_CREATED',
      metadata: { createdUserId: user.id, adminUnitId: input.adminUnitId ?? null },
    },
  });

  return user;
}

/**
 * Get user profile by ID.
 */
export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, adminUnitId: true,
      adminUnit: { select: { id: true, name: true, type: true } },
      createdAt: true, updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  return user;
}
