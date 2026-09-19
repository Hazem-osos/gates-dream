import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export async function resolveSecuritiesEntity(
  companyId: string,
  input: { entityId?: string | null; entityName?: string | null }
) {
  if (input.entityId) {
    const existing = await prisma.securitiesEntity.findFirst({
      where: { id: input.entityId, companyId },
    });
    if (existing) return existing;
  }

  const arabicName = input.entityName?.trim();
  if (!arabicName) return null;

  const match = await prisma.securitiesEntity.findFirst({
    where: { companyId, arabicName },
  });
  if (match) {
    if (!match.isActive) {
      return prisma.securitiesEntity.update({
        where: { id: match.id },
        data: { isActive: true },
      });
    }
    return match;
  }

  return prisma.securitiesEntity.create({
    data: { companyId, arabicName, isActive: true },
  });
}

export class SecuritiesEntityService {
  async list(companyId: string, search?: string) {
    const q = search?.trim();
    return prisma.securitiesEntity.findMany({
      where: {
        companyId,
        isActive: true,
        ...(q ? { arabicName: { contains: q } } : {}),
      },
      orderBy: { arabicName: 'asc' },
      take: 200,
    });
  }

  async create(companyId: string, arabicName: string) {
    const name = arabicName.trim();
    if (!name) throw new AppError(422, 'أدخل اسم الجهة');
    const existing = await prisma.securitiesEntity.findFirst({
      where: { companyId, arabicName: name },
    });
    if (existing) {
      if (!existing.isActive) {
        return prisma.securitiesEntity.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
      return existing;
    }
    return prisma.securitiesEntity.create({
      data: { companyId, arabicName: name, isActive: true },
    });
  }
}

export const securitiesEntityService = new SecuritiesEntityService();
