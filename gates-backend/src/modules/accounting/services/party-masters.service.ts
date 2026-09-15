import prisma from '../../../shared/database/prisma';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { nextNumericCode } from '../../../shared/utils/next-numeric-code';

async function assertAccount(companyId: string, accountId: string | null | undefined) {
  if (!accountId) return;
  const account = await prisma.account.findFirst({
    where: { id: accountId, companyId, deletedAt: null },
  });
  if (!account) {
    throw new Error('Invalid mainAccountId for company');
  }
}

export class PersonService {
  async create(
    companyId: string,
    data: {
      legacyCode: string;
      arabicName: string;
      englishName?: string;
      personGroupId?: string | null;
      mainAccountId?: string | null;
      priceListId?: string | null;
    }
  ) {
    await assertAccount(companyId, data.mainAccountId);
    try {
      return await prisma.person.create({
        data: {
          companyId,
          legacyCode: data.legacyCode,
          arabicName: data.arabicName,
          englishName: data.englishName,
          personGroupId: data.personGroupId,
          mainAccountId: data.mainAccountId,
          priceListId: data.priceListId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new Error('Person legacyCode already exists');
      }
      throw e;
    }
  }

  async list(
    companyId: string,
    opts: { page?: number; limit?: number; search?: string; personGroupId?: string; isActive?: boolean }
  ) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;
    const where: Prisma.PersonWhereInput = { companyId, deletedAt: null };
    if (opts.personGroupId) where.personGroupId = opts.personGroupId;
    if (opts.isActive !== undefined) where.isActive = opts.isActive;
    if (opts.search) {
      where.OR = [
        { arabicName: { contains: opts.search } },
        { englishName: { contains: opts.search } },
        { legacyCode: { contains: opts.search } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.person.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { arabicName: 'asc' },
      }),
      prisma.person.count({ where }),
    ]);
    return {
      persons: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.person.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) throw new Error('Person not found');
    return row;
  }

  async update(companyId: string, id: string, data: Record<string, unknown>) {
    await this.getById(companyId, id);
    if (data.mainAccountId !== undefined) {
      await assertAccount(companyId, data.mainAccountId as string | null);
    }
    return prisma.person.update({ where: { id }, data: data as Prisma.PersonUpdateInput });
  }

  async delete(companyId: string, id: string) {
    await this.getById(companyId, id);
    await prisma.person.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}

export class PersonGroupService {
  async create(companyId: string, data: { legacyCode: string; arabicName: string; englishName?: string }) {
    try {
      return await prisma.personGroup.create({ data: { companyId, ...data } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new Error('Person group legacyCode already exists');
      }
      throw e;
    }
  }

  async list(companyId: string) {
    return prisma.personGroup.findMany({
      where: { companyId, isActive: true },
      orderBy: { arabicName: 'asc' },
    });
  }

  async update(companyId: string, id: string, data: Prisma.PersonGroupUpdateInput) {
    const row = await prisma.personGroup.findFirst({ where: { id, companyId } });
    if (!row) throw new Error('Person group not found');
    return prisma.personGroup.update({ where: { id }, data });
  }
}

export class PersonItemPriceService {
  async create(
    companyId: string,
    data: {
      personId: string;
      itemId: string;
      unitId?: string | null;
      price: number;
      discountPct?: number | null;
      validFrom?: Date | null;
      validTo?: Date | null;
    }
  ) {
    await prisma.person.findFirstOrThrow({
      where: { id: data.personId, companyId },
    });
    return prisma.personItemPrice.create({
      data: {
        companyId,
        personId: data.personId,
        itemId: data.itemId,
        unitId: data.unitId,
        price: new Decimal(data.price),
        discountPct:
          data.discountPct != null ? new Decimal(data.discountPct) : null,
        validFrom: data.validFrom,
        validTo: data.validTo,
      },
    });
  }

  async listForPerson(companyId: string, personId: string) {
    return prisma.personItemPrice.findMany({
      where: { companyId, personId },
      include: { item: { select: { id: true, serial: true, arabicName: true } } },
    });
  }

  async resolvePrice(
    companyId: string,
    personId: string,
    itemId: string,
    asOf = new Date()
  ): Promise<{ price: number; discountPct: number | null; source: 'person' | 'none' } | null> {
    const row = await prisma.personItemPrice.findFirst({
      where: {
        companyId,
        personId,
        itemId,
        OR: [
          { validFrom: null, validTo: null },
          {
            validFrom: { lte: asOf },
            OR: [{ validTo: null }, { validTo: { gte: asOf } }],
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!row) return null;
    return {
      price: row.price.toNumber(),
      discountPct: row.discountPct?.toNumber() ?? null,
      source: 'person',
    };
  }
}

function mapCategory<T extends { legacyCode: string }>(row: T) {
  return { ...row, code: row.legacyCode };
}

export class CustomerCategoryService {
  async create(
    companyId: string,
    data: { legacyCode: string; arabicName: string; englishName?: string }
  ) {
    try {
      const existing = await prisma.customerCategory.findMany({
        where: { companyId, isActive: true },
        select: { legacyCode: true },
      });
      const legacyCode = nextNumericCode(existing.map((row) => row.legacyCode));
      const row = await prisma.customerCategory.create({
        data: { companyId, legacyCode, arabicName: data.arabicName, englishName: data.englishName },
      });
      return mapCategory(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new Error('كود مجموعة العميل مستخدم من قبل');
      }
      throw e;
    }
  }

  async list(companyId: string) {
    const rows = await prisma.customerCategory.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ legacyCode: 'asc' }, { arabicName: 'asc' }],
      include: { _count: { select: { customers: true } } },
    });
    return rows.map(mapCategory);
  }

  async update(companyId: string, id: string, data: Prisma.CustomerCategoryUpdateInput) {
    const row = await prisma.customerCategory.findFirst({ where: { id, companyId } });
    if (!row) throw new Error('مجموعة العميل غير موجودة');
    const updated = await prisma.customerCategory.update({ where: { id }, data });
    return mapCategory(updated);
  }

  async delete(companyId: string, id: string) {
    const row = await prisma.customerCategory.findFirst({ where: { id, companyId } });
    if (!row) throw new Error('مجموعة العميل غير موجودة');
    await prisma.customerCategory.update({
      where: { id },
      data: { isActive: false, legacyCode: `${row.legacyCode}__del__${id.slice(0, 8)}` },
    });
  }
}

export class SupplierCategoryService {
  async create(
    companyId: string,
    data: { legacyCode: string; arabicName: string; englishName?: string }
  ) {
    try {
      const existing = await prisma.supplierCategory.findMany({
        where: { companyId, isActive: true },
        select: { legacyCode: true },
      });
      const legacyCode = nextNumericCode(existing.map((row) => row.legacyCode));
      const row = await prisma.supplierCategory.create({
        data: { companyId, legacyCode, arabicName: data.arabicName, englishName: data.englishName },
      });
      return mapCategory(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new Error('كود مجموعة المورد مستخدم من قبل');
      }
      throw e;
    }
  }

  async list(companyId: string) {
    const rows = await prisma.supplierCategory.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ legacyCode: 'asc' }, { arabicName: 'asc' }],
      include: { _count: { select: { suppliers: true } } },
    });
    return rows.map(mapCategory);
  }

  async update(companyId: string, id: string, data: Prisma.SupplierCategoryUpdateInput) {
    const row = await prisma.supplierCategory.findFirst({ where: { id, companyId } });
    if (!row) throw new Error('مجموعة المورد غير موجودة');
    const updated = await prisma.supplierCategory.update({ where: { id }, data });
    return mapCategory(updated);
  }

  async delete(companyId: string, id: string) {
    const row = await prisma.supplierCategory.findFirst({ where: { id, companyId } });
    if (!row) throw new Error('مجموعة المورد غير موجودة');
    await prisma.supplierCategory.update({
      where: { id },
      data: { isActive: false, legacyCode: `${row.legacyCode}__del__${id.slice(0, 8)}` },
    });
  }
}

export const personService = new PersonService();
export const personGroupService = new PersonGroupService();
export const personItemPriceService = new PersonItemPriceService();
export const customerCategoryService = new CustomerCategoryService();
export const supplierCategoryService = new SupplierCategoryService();
