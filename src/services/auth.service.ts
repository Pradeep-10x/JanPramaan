/**
 * JanPramaan — Auth service
 * Handles user registration (CITIZEN) and login with JWT generation.
 * All user-facing messages are bilingual (en/hi) via i18n.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import disposableDomains from 'disposable-email-domains';
import { prisma } from '../prisma/client';
import { config } from '../config';
import { AppError } from '../middleware/error.middleware';
import { Role } from '../generated/prisma/client.js';
import { isEmailVerified, cleanupUsedOtp, sendOtp, verifyOtp } from "./otp.js";
import { getNearestWard } from "./adminUnit.service.js";
import { tError, tMessage } from '../i18n/index.js';
const SALT_ROUNDS = 12;

// Create a Set for O(1) lookup
const DISPOSABLE_SET = new Set(disposableDomains);

export interface RegisterInput {
  name: string;
  email?: string;
  password: string;
  wardId?: string;      // manual override from "Change ward" dropdown
  deviceLat?: number;
  deviceLng?: number;
  lang?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  lang?: string;
}

/**
 * Register a new CITIZEN user.
 */
export async function registerUser(input: RegisterInput) {
  const lang = input.lang || 'en';

  if (!input.email) {
    throw Object.assign(new Error(tError('VALIDATION_ERROR', lang, 'Email is required for registration')), { statusCode: 400 });
  }

  // Check for disposable/temp email domains
  const domain = input.email.split('@')[1]?.toLowerCase();
  if (domain && DISPOSABLE_SET.has(domain)) {
    throw new AppError(400, 'DISPOSABLE_EMAIL', tError('DISPOSABLE_EMAIL', lang));
  }

  // Resolve adminUnitId: manual wardId > device GPS auto-detect > null
  let resolvedWardId: string | undefined = undefined;

  if (input.wardId) {
    // Manual selection from frontend dropdown — validate it exists
    const ward = await prisma.adminUnit.findUnique({ where: { id: input.wardId } });
    if (!ward || ward.type !== 'WARD') {
      throw new AppError(400, 'INVALID_WARD', tError('INVALID_WARD', lang));
    }
    resolvedWardId = input.wardId;
  } else if (input.deviceLat !== undefined && input.deviceLng !== undefined) {
    // Auto-detect from device GPS
    const nearest = await getNearestWard(input.deviceLat, input.deviceLng);
    resolvedWardId = nearest.wardId;
  }

  // Check email uniqueness
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      if (existing.isEmailVerified) {
         throw new AppError(409, 'EMAIL_EXISTS', tError('EMAIL_EXISTS', lang));
      } else {
         // Overwrite unverified user
         await prisma.user.delete({ where: { email: input.email } });
      }
    }
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
   

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: Role.CITIZEN,
      adminUnitId: resolvedWardId ?? null,
      isEmailVerified: false,
      preferredLang: lang,
    },
    select: { id: true, name: true, email: true, role: true, adminUnitId: true, createdAt: true },
  });

  if (input.email) {
    await sendOtp(input.email);
  }

  // Audit log — user is the actor for their own registration
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'USER_REGISTERED_UNVERIFIED',
      metadata: { email: user.email, wardId: resolvedWardId ?? null },
    },
  });

  return { message: tMessage('OTP_VERIFY_PROMPT', lang), tempUserId: user.id };
}

/**
 * Authenticate a user by email + password and return a JWT.
 */
export async function loginUser(input: LoginInput) {
  const lang = input.lang || 'en';

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', tError('INVALID_CREDENTIALS', lang));
  }

  // Use user's preferred lang if available
  const userLang = user.preferredLang || lang;

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', tError('INVALID_CREDENTIALS', userLang));
  }

  if (!user.isEmailVerified) {
    throw new AppError(403, 'UNVERIFIED_EMAIL', tError('UNVERIFIED_EMAIL', userLang));
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, config.jwtSecret, { expiresIn: '24h' });

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'USER_LOGIN',
      metadata: { email: user.email },
    },
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      adminUnitId: user.adminUnitId,
      preferredLang: user.preferredLang,
    },
  };
}

/**
 * Verifies OTP, marks user as verified, and logs them in.
 */
export async function verifyAndLoginUser(email: string, otp: string, lang?: string) {
  const isValid = await verifyOtp(email, otp);
  if (!isValid) throw new AppError(400, 'INVALID_OTP', tError('INVALID_OTP', lang));

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(404, 'NOT_FOUND', tError('USER_NOT_FOUND', lang));

  const userLang = user.preferredLang || lang || 'en';
  
  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true }
  });

  await cleanupUsedOtp(email);

  const token = jwt.sign({ userId: user.id, role: user.role }, config.jwtSecret, { expiresIn: '24h' });

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'USER_VERIFIED',
      metadata: { email: user.email },
    },
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      adminUnitId: user.adminUnitId,
      preferredLang: user.preferredLang,
    },
  };
}

export async function sendForgotPasswordOtp(email: string, lang?: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const l = user?.preferredLang || lang || 'en';
  if (!user) {
    // Return standard success to prevent email enumeration
    return { message: tMessage('OTP_IF_REGISTERED', l) };
  }
  await sendOtp(email);
  return { message: tMessage('OTP_IF_REGISTERED', l) };
}

export async function resetPassword(email: string, otp: string, newPassword: string, lang?: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', tError('NOT_FOUND', lang));
  }

  const userLang = user.preferredLang || lang || 'en';

  const isValid = await verifyOtp(email, otp);
  if (!isValid) {
    throw new AppError(400, 'INVALID_OTP', tError('INVALID_OTP', userLang));
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  await cleanupUsedOtp(email);

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'PASSWORD_RESET',
      metadata: { email }
    }
  });

  return { message: tMessage('PASSWORD_RESET', userLang) };
}
