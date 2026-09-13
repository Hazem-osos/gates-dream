import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import type {
  CreateCommissionPolicyInput,
  UpdateCommissionPolicyInput,
} from '../schemas/representative-commission-policy.schema';

function dec(value: number | null | undefined) {
  return value == null ? null : new Decimal(value);
}

function tierCreates(tiers: CreateCommissionPolicyInput['tiers']) {
  return (tiers ?? [])
    .filter(
      (t) =>
        t.targetSlice?.trim() ||
        t.targetPct != null ||
        t.commissionPct != null ||
        t.bonusPct != null ||
        t.increasePct != null
    )
    .map((t, i) => ({
      targetSlice: t.targetSlice?.trim() || null,
      targetPct: dec(t.targetPct),
      commissionPct: dec(t.commissionPct),
      bonusPct: dec(t.bonusPct),
      increasePct: dec(t.increasePct),
      sortOrder: i,
    }));
}

const includeTiers = { tiers: { orderBy: { sortOrder: 'asc' as const } } };

export class RepresentativeCommissionPolicyService {
  async create(companyId: string, data: CreateCommissionPolicyInput) {
    const row = await prisma.representativeCommissionPolicy.create({
      data: {
        companyId,
        code: data.code || null,
        arabicName: data.arabicName,
        englishName: data.englishName || null,
        tiers: { create: tierCreates(data.tiers) },
      },
      include: includeTiers,
    });
    logger.info({ companyId, id: row.id }, 'Commission policy created');
    return row;
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.representativeCommissionPolicy.findFirst({
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
      OR?: { arabicName?: { contains: string }; code?: { contains: string } }[];
    } = { companyId };
    if (options.search) {
      where.OR = [
        { arabicName: { contains: options.search } },
        { code: { contains: options.search } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.representativeCommissionPolicy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: includeTiers,
      }),
      prisma.representativeCommissionPolicy.count({ where }),
    ]);
    return { rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async update(companyId: string, id: string, data: UpdateCommissionPolicyInput) {
    await this.getById(companyId, id);
    if (data.tiers !== undefined) {
      await prisma.representativeCommissionPolicyTier.deleteMany({ where: { policyId: id } });
    }
    const row = await prisma.representativeCommissionPolicy.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code || null } : {}),
        ...(data.arabicName !== undefined ? { arabicName: data.arabicName } : {}),
        ...(data.englishName !== undefined ? { englishName: data.englishName || null } : {}),
        ...(data.tiers !== undefined ? { tiers: { create: tierCreates(data.tiers) } } : {}),
      },
      include: includeTiers,
    });
    logger.info({ companyId, id }, 'Commission policy updated');
    return row;
  }

  async remove(companyId: string, id: string) {
    await this.getById(companyId, id);
    await prisma.representativeCommissionPolicy.delete({ where: { id } });
    return { success: true };
  }
}

export const representativeCommissionPolicyService = new RepresentativeCommissionPolicyService();
