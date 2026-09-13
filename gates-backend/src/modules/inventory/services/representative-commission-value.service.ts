import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import type {
  CreateCommissionValueInput,
  UpdateCommissionValueInput,
} from '../schemas/representative-commission-value.schema';

function dec(value: number | null | undefined) {
  return value == null ? null : new Decimal(value);
}

function tierCreates(tiers: CreateCommissionValueInput['tiers']) {
  return (tiers ?? [])
    .filter((t) => t.days != null || t.commissionPct != null)
    .map((t, i) => ({
      days: t.days ?? null,
      commissionPct: dec(t.commissionPct),
      sortOrder: i,
    }));
}

const includeTiers = { tiers: { orderBy: { sortOrder: 'asc' as const } } };

export class RepresentativeCommissionValueService {
  async create(companyId: string, data: CreateCommissionValueInput) {
    const row = await prisma.representativeCommissionValue.create({
      data: {
        companyId,
        serial: data.serial || null,
        name: data.name,
        target: dec(data.target),
        targetPercentage: dec(data.targetPercentage),
        tiers: { create: tierCreates(data.tiers) },
      },
      include: includeTiers,
    });
    logger.info({ companyId, id: row.id }, 'Commission value policy created');
    return row;
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.representativeCommissionValue.findFirst({
      where: { id, companyId },
      include: includeTiers,
    });
    if (!row) throw new Error('سياسة العمولة غير موجودة');
    return row;
  }

  async list(companyId: string, options: { page?: number; limit?: number; search?: string }) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;
    const where: {
      companyId: string;
      OR?: { name?: { contains: string }; serial?: { contains: string } }[];
    } = { companyId };
    if (options.search) {
      where.OR = [
        { name: { contains: options.search } },
        { serial: { contains: options.search } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.representativeCommissionValue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: includeTiers,
      }),
      prisma.representativeCommissionValue.count({ where }),
    ]);
    return { rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async update(companyId: string, id: string, data: UpdateCommissionValueInput) {
    await this.getById(companyId, id);
    if (data.tiers !== undefined) {
      await prisma.representativeCommissionValueTier.deleteMany({ where: { policyId: id } });
    }
    const row = await prisma.representativeCommissionValue.update({
      where: { id },
      data: {
        ...(data.serial !== undefined ? { serial: data.serial || null } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.target !== undefined ? { target: dec(data.target) } : {}),
        ...(data.targetPercentage !== undefined
          ? { targetPercentage: dec(data.targetPercentage) }
          : {}),
        ...(data.tiers !== undefined ? { tiers: { create: tierCreates(data.tiers) } } : {}),
      },
      include: includeTiers,
    });
    logger.info({ companyId, id }, 'Commission value policy updated');
    return row;
  }

  async remove(companyId: string, id: string) {
    await this.getById(companyId, id);
    await prisma.representativeCommissionValue.delete({ where: { id } });
    return { success: true };
  }
}

export const representativeCommissionValueService = new RepresentativeCommissionValueService();
