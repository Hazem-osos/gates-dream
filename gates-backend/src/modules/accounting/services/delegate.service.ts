import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { Decimal } from '@prisma/client/runtime/library';
import type { CreateDelegateInput, UpdateDelegateInput } from '../schemas/delegate.schema';
import { nextNumericCode } from '../../../shared/utils/next-numeric-code';

export type DelegateRole = 'DELEGATE' | 'DISTRIBUTOR' | 'DRIVER';

function optionalDecimal(value?: number | null) {
  if (value == null) return null;
  return new Decimal(value);
}

async function writeRole(id: string, role: DelegateRole) {
  await prisma.$executeRaw`
    UPDATE \`delegates\` SET \`role\` = ${role} WHERE \`id\` = ${id}
  `;
}

export class DelegateService {
  private async assertUniqueDelegateCode(
    companyId: string,
    code: string | undefined | null,
    exceptId?: string
  ) {
    const value = code?.trim();
    if (!value) return;
    const clash = await prisma.delegate.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [{ code: value }, { serial: value }],
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true, arabicName: true },
    });
    if (clash) {
      throw new AppError(
        409,
        `الرمز «${value}» مستخدم على «${clash.arabicName}». الحل: غيّر الرمز أو المسلسل ثم احفظ.`
      );
    }
  }

  private async nextDelegateCode(companyId: string): Promise<string> {
    const rows = await prisma.delegate.findMany({
      where: { companyId },
      select: { serial: true, code: true },
    });
    return nextNumericCode(rows.flatMap((row) => [row.serial, row.code]));
  }

  async createDelegate(companyId: string, data: CreateDelegateInput) {
    try {
      const serial = await this.nextDelegateCode(companyId);
      const code = serial;
      await this.assertUniqueDelegateCode(companyId, code);
      const role = data.role ?? 'DELEGATE';
      const delegate = await prisma.delegate.create({
        data: {
          companyId,
          serial,
          code,
          arabicName: data.arabicName,
          englishName: data.englishName,
          nationality: data.nationality,
          barcode: data.barcode,
          phone1: data.phone1,
          phone2: data.phone2,
          mobile: data.mobile,
          fax: data.fax,
          email: data.email || null,
          website: data.website || null,
          country: data.country,
          city: data.city,
          area: data.area,
          street: data.street,
          postalCode: data.postalCode,
          poBox: data.poBox,
          address: data.address,
          commissionPercentage: optionalDecimal(data.commissionPercentage),
          commissionPolicyId: data.commissionPolicyId,
          groupId: data.groupId,
          salesCommissionsId: data.salesCommissionsId,
          priceListId: data.priceListId,
        },
      });

      await writeRole(delegate.id, role);
      logger.info({ companyId, delegateId: delegate.id, role }, 'Delegate created');
      return { ...delegate, role };
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error({ error, companyId, data }, 'Error creating delegate');
      }
      throw error;
    }
  }

  async getDelegateById(companyId: string, delegateId: string) {
    const delegate = await prisma.delegate.findFirst({
      where: { id: delegateId, companyId },
    });
    if (!delegate) {
      throw new AppError(404, 'المندوب غير موجود. الحل: حدّث الدليل ثم أعد المحاولة.');
    }
    return delegate;
  }

  async listDelegates(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
      role?: DelegateRole;
    }
  ) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    const parts: Prisma.Sql[] = [Prisma.sql`companyId = ${companyId}`];
    if (options.isActive !== undefined) {
      parts.push(Prisma.sql`isActive = ${options.isActive}`);
    }
    if (options.role) {
      parts.push(Prisma.sql`role = ${options.role}`);
    }
    if (options.search?.trim()) {
      const q = `%${options.search.trim()}%`;
      parts.push(
        Prisma.sql`(arabicName LIKE ${q} OR IFNULL(englishName,'') LIKE ${q} OR IFNULL(code,'') LIKE ${q} OR IFNULL(serial,'') LIKE ${q})`
      );
    }
    const whereSql = Prisma.join(parts, ' AND ');

    const [delegates, countRows] = await Promise.all([
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM \`delegates\`
        WHERE ${whereSql}
        ORDER BY arabicName ASC
        LIMIT ${limit} OFFSET ${skip}
      `,
      prisma.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*) AS total FROM \`delegates\` WHERE ${whereSql}
      `,
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    return {
      delegates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async updateDelegate(companyId: string, delegateId: string, data: UpdateDelegateInput) {
    try {
    const existing = await prisma.delegate.findFirst({
      where: { id: delegateId, companyId },
    });
    if (!existing) {
      throw new AppError(404, 'المندوب غير موجود. الحل: حدّث الدليل ثم أعد المحاولة.');
    }
    await this.assertUniqueDelegateCode(companyId, data.code ?? data.serial, delegateId);

    const { role, ...rest } = data;
    const delegate = await prisma.delegate.update({
      where: { id: delegateId },
      data: {
        serial: rest.serial,
        code: rest.code,
        arabicName: rest.arabicName,
        englishName: rest.englishName,
        nationality: rest.nationality,
        barcode: rest.barcode,
        phone1: rest.phone1,
        phone2: rest.phone2,
        mobile: rest.mobile,
        fax: rest.fax,
        email: rest.email === '' ? null : rest.email,
        website: rest.website === '' ? null : rest.website,
        country: rest.country,
        city: rest.city,
        area: rest.area,
        street: rest.street,
        postalCode: rest.postalCode,
        poBox: rest.poBox,
        address: rest.address,
        commissionPercentage:
          rest.commissionPercentage !== undefined
            ? optionalDecimal(rest.commissionPercentage)
            : undefined,
        commissionPolicyId: rest.commissionPolicyId,
        groupId: rest.groupId,
        salesCommissionsId: rest.salesCommissionsId,
        priceListId: rest.priceListId,
        isActive: rest.isActive,
      },
    });

    if (role) await writeRole(delegateId, role);
    logger.info({ companyId, delegateId }, 'Delegate updated');
    return role ? { ...delegate, role } : delegate;
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error({ error, companyId, delegateId, data }, 'Error updating delegate');
      }
      throw error;
    }
  }

  async deleteDelegate(companyId: string, delegateId: string) {
    const delegate = await prisma.delegate.findFirst({
      where: { id: delegateId, companyId },
    });
    if (!delegate) {
      throw new AppError(404, 'المندوب غير موجود. الحل: حدّث الدليل ثم أعد المحاولة.');
    }

    await prisma.delegate.update({
      where: { id: delegateId },
      data: { isActive: false },
    });

    logger.info({ companyId, delegateId }, 'Delegate deleted');
    return { success: true };
  }
}

export const delegateService = new DelegateService();
