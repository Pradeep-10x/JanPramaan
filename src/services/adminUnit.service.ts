/**
 * WitnessLedger — AdminUnit service
 * CRUD operations for the administrative hierarchy (Global → City → Ward).
 */
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { AdminUnitType } from '../generated/prisma/client.js';

export interface CreateAdminUnitInput {
  name: string;
  type: AdminUnitType;
  parentId?: string;
}

/**
 * List all admin units, optionally filtered by type.
 */
export async function listAdminUnits(type?: AdminUnitType) {
  return prisma.adminUnit.findMany({
    where: type ? { type } : undefined,
    include: { parent: { select: { id: true, name: true, type: true } } },
    orderBy: { name: 'asc' },
  });
}

/**
 * Create a new admin unit (ADMIN only).
 */
export async function createAdminUnit(input: CreateAdminUnitInput) {
  if (input.parentId) {
    const parent = await prisma.adminUnit.findUnique({ where: { id: input.parentId } });
    if (!parent) {
      throw new AppError(400, 'INVALID_PARENT', 'Parent admin unit not found');
    }
  }

  return prisma.adminUnit.create({
    data: {
      name: input.name,
      type: input.type,
      parentId: input.parentId,
    },
  });
}

/**
 * Get children of a given admin unit (e.g. wards for a city).
 */
export async function getChildren(unitId: string) {
  const unit = await prisma.adminUnit.findUnique({ where: { id: unitId } });
  if (!unit) {
    throw new AppError(404, 'NOT_FOUND', 'Admin unit not found');
  }

  return prisma.adminUnit.findMany({
    where: { parentId: unitId },
    orderBy: { name: 'asc' },
  });
}
