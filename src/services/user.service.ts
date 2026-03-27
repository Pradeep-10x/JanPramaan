/**
 * JanPramaan — User service
 * Admin-only user creation (officers, inspectors, admins, contractors).
 * All user-facing messages are bilingual (en/hi) via i18n.
 */
import bcrypt from 'bcrypt';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { Role } from '../generated/prisma/client.js';
import { tError, tMessage } from '../i18n/index.js';

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
export async function createUser(input: CreateUserInput, actorId: string, lang?: string) {
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', tError('EMAIL_EXISTS', lang));
    }
  }

  if (input.adminUnitId) {
    const unit = await prisma.adminUnit.findUnique({ where: { id: input.adminUnitId } });
    if (!unit) {
      throw new AppError(400, 'INVALID_UNIT', tError('INVALID_UNIT', lang));
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

export async function createContractor(input: CreateUserInput, actorId: string, lang?: string) {

  if(input.role !== "CONTRACTOR"){
    throw new AppError(400, 'INVALID_ROLE', tError('INVALID_ROLE', lang));
  }

  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', tError('EMAIL_EXISTS', lang));
    }
  }

  if (input.adminUnitId) {
    const unit = await prisma.adminUnit.findUnique({ where: { id: input.adminUnitId } });
    if (!unit) {
      throw new AppError(400, 'INVALID_UNIT', tError('INVALID_UNIT', lang));
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
export async function getUserProfile(userId: string, lang?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, adminUnitId: true,
      profilePicUrl: true, preferredLang: true,
      adminUnit: { select: { id: true, name: true, type: true } },
      createdAt: true, updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', tError('USER_NOT_FOUND', lang));
  }

  return user;
}

/**
 * Validates that the calling admin has jurisdiction over the target user.
 */
async function validateAdminJurisdiction(
  targetId: string,
  actorId: string,
  actorAdminUnitId: string | null,
  lang?: string,
) {
  if (targetId === actorId) {
    throw new AppError(400, 'SELF_ACTION', tError('SELF_ACTION', lang));
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    include: { adminUnit: true },
  });
  if (!target) {
    throw new AppError(404, 'NOT_FOUND', tError('USER_NOT_FOUND', lang));
  }
  if (target.role === Role.CITIZEN) {
    throw new AppError(400, 'INVALID_TARGET', tError('INVALID_TARGET', lang));
  }

  if (!actorAdminUnitId) {
    throw new AppError(403, 'FORBIDDEN', tError('FORBIDDEN', lang));
  }

  const actorUnit = await prisma.adminUnit.findUnique({ where: { id: actorAdminUnitId } });
  if (!actorUnit) {
    throw new AppError(403, 'FORBIDDEN', tError('FORBIDDEN', lang));
  }

  // Same ward — always allowed
  if (target.adminUnitId === actorAdminUnitId) {
    return target;
  }

  // City admin: target's ward must be a child of the actor's city
  if (actorUnit.type === 'CITY') {
    if (target.adminUnit?.parentId === actorAdminUnitId) {
      return target;
    }
  }

  throw new AppError(403, 'FORBIDDEN', tError('FORBIDDEN', lang));
}

/**
 * Delete an official (ADMIN-only).
 */
export async function deleteUser(targetId: string, actorId: string, actorAdminUnitId: string | null, lang?: string) {
  const target = await validateAdminJurisdiction(targetId, actorId, actorAdminUnitId, lang);

  await prisma.$transaction([
    prisma.user.delete({ where: { id: targetId } }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: 'USER_DELETED',
        metadata: {
          deletedUserId: targetId,
          deletedUserName: target.name,
          deletedUserRole: target.role,
          deletedUserEmail: target.email,
        },
      },
    }),
  ]);

  return { message: `User "${target.name}" (${target.role}) has been deleted` };
}

/**
 * Change an official's password (ADMIN-only).
 */
export async function changePassword(
  targetId: string,
  actorId: string,
  actorAdminUnitId: string | null,
  newPassword: string,
  lang?: string,
) {
  const target = await validateAdminJurisdiction(targetId, actorId, actorAdminUnitId, lang);

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetId },
      data: { passwordHash },
    }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: 'PASSWORD_CHANGED_BY_ADMIN',
        metadata: {
          targetUserId: targetId,
          targetUserName: target.name,
          targetUserRole: target.role,
        },
      },
    }),
  ]);

  return { message: tMessage('PASSWORD_CHANGED', lang) };
}

/**
 * Self-service password change (any authenticated user, including citizens).
 */
export async function changeMyPassword(userId: string, currentPassword: string, newPassword: string, lang?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', tError('USER_NOT_FOUND', lang));
  }

  const userLang = user.preferredLang || lang || 'en';

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError(401, 'WRONG_PASSWORD', tError('WRONG_PASSWORD', userLang));
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: 'PASSWORD_SELF_CHANGED',
      metadata: { email: user.email },
    },
  });

  return { message: tMessage('PASSWORD_CHANGED', userLang) };
}

/**
 * Update user's preferred language.
 */
export async function updateLanguagePreference(userId: string, lang: string) {
  const validLangs = ['en', 'hi'];
  if (!validLangs.includes(lang)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Language must be one of: en, hi');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { preferredLang: lang },
  });

  return { message: tMessage('LANG_UPDATED', lang), preferredLang: lang };
}
