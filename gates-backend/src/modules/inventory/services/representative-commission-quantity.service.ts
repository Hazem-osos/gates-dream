import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import type {
  CommissionQuantityLineInput,
  ReplaceCommissionQuantitiesInput,
} from '../schemas/representative-commission-quantity.schema';

function dec(value: number | null | undefined) {
  return value == null ? null : new Decimal(value);
}

function lineData(companyId: string, line: CommissionQuantityLineInput) {
  return {
    companyId,
    itemId: line.itemId || null,
    itemName: line.itemName?.trim() || null,
    policyName: line.policyName?.trim() || null,
    days: line.days ?? null,
    commissionBefore: dec(line.commissionBefore),
    commissionAfter: dec(line.commissionAfter),
    cashRate: dec(line.cashRate),
    creditRate: dec(line.creditRate),
    percent: dec(line.percent),
    target: dec(line.target),
  };
}

function isFilled(line: CommissionQuantityLineInput) {
  return Boolean(
    line.itemId ||
      line.itemName?.trim() ||
      line.policyName?.trim() ||
      line.days != null ||
      line.commissionBefore != null ||
      line.commissionAfter != null ||
      line.cashRate != null ||
      line.creditRate != null ||
      line.percent != null ||
      line.target != null
  );
}

const includeItem = {
  item: { select: { id: true, arabicName: true, serial: true } },
};

export class RepresentativeCommissionQuantityService {
  async list(companyId: string, options: { page?: number; limit?: number; search?: string }) {
    const page = options.page || 1;
    const limit = options.limit || 100;
    const skip = (page - 1) * limit;
    const where: {
      companyId: string;
      OR?: { itemName?: { contains: string }; policyName?: { contains: string } }[];
    } = { companyId };
    if (options.search) {
      where.OR = [
        { itemName: { contains: options.search } },
        { policyName: { contains: options.search } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.representativeCommissionQuantity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: includeItem,
      }),
      prisma.representativeCommissionQuantity.count({ where }),
    ]);

    return {
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async replaceAll(companyId: string, data: ReplaceCommissionQuantitiesInput) {
    const incoming = data.lines.filter(isFilled);
    const keepIds = incoming.map((l) => l.id).filter((id): id is string => Boolean(id));

    await prisma.$transaction(async (tx) => {
      await tx.representativeCommissionQuantity.deleteMany({
        where: {
          companyId,
          ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
        },
      });

      for (const line of incoming) {
        const payload = lineData(companyId, line);
        if (line.id) {
          const existing = await tx.representativeCommissionQuantity.findFirst({
            where: { id: line.id, companyId },
            select: { id: true },
          });
          if (existing) {
            await tx.representativeCommissionQuantity.update({
              where: { id: line.id },
              data: payload,
            });
            continue;
          }
        }
        await tx.representativeCommissionQuantity.create({ data: payload });
      }
    });

    logger.info({ companyId, count: incoming.length }, 'Commission quantity lines saved');
    return this.list(companyId, { limit: 200 });
  }
}

export const representativeCommissionQuantityService =
  new RepresentativeCommissionQuantityService();
