/**
 * WitnessLedger — Auth service
 * Handles user registration (CITIZEN) and login with JWT generation.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/client';
import { config } from '../config';
import { AppError } from '../middleware/error.middleware';
import { Role } from '../generated/prisma/client.js';

const SALT_ROUNDS = 12;

export interface RegisterInput {
  name: string;
  email?: string;
  password: string;
  wardId?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Register a new CITIZEN user.
 */
export async function registerUser(input: RegisterInput) {
  // Validate ward if provided
  if (input.wardId) {
    const ward = await prisma.adminUnit.findUnique({ where: { id: input.wardId } });
    if (!ward || ward.type !== 'WARD') {
      throw new AppError(400, 'INVALID_WARD', 'wardId must reference an existing WARD');
    }
  }

  // Check email uniqueness (if provided)
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'A user with that email already exists');
    }
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: Role.CITIZEN,
      adminUnitId: input.wardId,
    },
    select: { id: true, name: true, email: true, role: true, adminUnitId: true, createdAt: true },
  });

  const token = jwt.sign({ userId: user.id, role: user.role }, config.jwtSecret, { expiresIn: '24h' });

  return { token, user };
}

/**
 * Authenticate a user by email + password and return a JWT.
 */
export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, config.jwtSecret, { expiresIn: '24h' });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      adminUnitId: user.adminUnitId,
    },
  };
}
