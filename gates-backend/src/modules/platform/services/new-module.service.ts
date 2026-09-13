import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

/**
 * Legacy `NewModule` / `NewModuleStore` / `OtherModulesRights` registry.
 *
 * Legacy semantics (from `MainProgram/untNewModule.pas`):
 * - `NewModuleCode` is a 2-digit sequence *per base type* (`Type`), starting
 *   at "01" and computed as `MAX(NewModuleCode) + 1` for that type.
 * - The 4-char concatenation `Type + NewModuleCode` (e.g. "SI01", "BP02")
 *   is the module-suffix key that legacy per-module settings append to a
 *   setting's base name (`SalesDaribaSI01`, `AutoPostBP01`,
 *   `PostTostoreSI02`, `NotCreateGLSR01`) — see `company-setting.service.ts`
 *   consumers for the read side.
 * - `NewModuleStore` restricts which warehouses a store-affecting module
 *   may operate against.
 * - `OtherModulesRights` grants a voucher module (`SanadModule`) permission
 *   to read/pull records from another module (`ReadModule`); it is a plain
 *   string-keyed grant, not an FK relationship, matching legacy.
 */

export interface CreateNewModuleInput {
  companyId: string;
  baseType: string;
  nameAr: string;
  nameEn?: string | null;
  menuNameAr: string;
  menuNameEn?: string | null;
  priceListId?: string | null;
  warehouseIds?: string[];
}

export interface UpdateNewModuleInput {
  nameAr?: string;
  nameEn?: string | null;
  menuNameAr?: string;
  menuNameEn?: string | null;
  priceListId?: string | null;
  isActive?: boolean;
  warehouseIds?: string[];
}

export class NewModuleService {
  async list(companyId: string, baseType?: string) {
    return prisma.newModule.findMany({
      where: { companyId, ...(baseType ? { baseType } : {}) },
      include: { priceList: true, stores: { include: { warehouse: true } } },
      orderBy: [{ baseType: 'asc' }, { moduleCode: 'asc' }],
    });
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.newModule.findFirst({
      where: { id, companyId },
      include: { priceList: true, stores: { include: { warehouse: true } } },
    });
    if (!row) throw new AppError(404, 'NewModule not found');
    return row;
  }

  /** Legacy-exact NewModuleCode allocation: MAX(moduleCode)+1 per (companyId, baseType), zero-padded to 2 digits, starting at "01". */
  private async nextModuleCode(companyId: string, baseType: string): Promise<string> {
    const existing = await prisma.newModule.findMany({
      where: { companyId, baseType },
      select: { moduleCode: true },
    });
    const max = existing.reduce((acc, row) => Math.max(acc, parseInt(row.moduleCode, 10) || 0), 0);
    const next = max + 1;
    if (next > 99) {
      throw new AppError(409, `No more module codes available for base type ${baseType}`);
    }
    return String(next).padStart(2, '0');
  }

  async create(input: CreateNewModuleInput) {
    const { companyId, baseType, warehouseIds, ...rest } = input;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.newModule.findMany({
        where: { companyId, baseType },
        select: { moduleCode: true },
      });
      const max = existing.reduce((acc, row) => Math.max(acc, parseInt(row.moduleCode, 10) || 0), 0);
      const moduleCode = String(max + 1).padStart(2, '0');
      if (max + 1 > 99) {
        throw new AppError(409, `No more module codes available for base type ${baseType}`);
      }
      const fullCode = `${baseType}${moduleCode}`;

      const created = await tx.newModule.create({
        data: {
          companyId,
          baseType,
          moduleCode,
          fullCode,
          nameAr: rest.nameAr,
          nameEn: rest.nameEn ?? null,
          menuNameAr: rest.menuNameAr,
          menuNameEn: rest.menuNameEn ?? null,
          priceListId: rest.priceListId ?? null,
        },
      });

      if (warehouseIds?.length) {
        await tx.newModuleStore.createMany({
          data: warehouseIds.map((warehouseId) => ({
            companyId,
            newModuleId: created.id,
            warehouseId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.newModule.findUniqueOrThrow({
        where: { id: created.id },
        include: { priceList: true, stores: { include: { warehouse: true } } },
      });
    });
  }

  async update(companyId: string, id: string, input: UpdateNewModuleInput) {
    const existing = await prisma.newModule.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError(404, 'NewModule not found');

    const { warehouseIds, ...rest } = input;

    return prisma.$transaction(async (tx) => {
      await tx.newModule.update({
        where: { id },
        data: {
          ...(rest.nameAr !== undefined ? { nameAr: rest.nameAr } : {}),
          ...(rest.nameEn !== undefined ? { nameEn: rest.nameEn } : {}),
          ...(rest.menuNameAr !== undefined ? { menuNameAr: rest.menuNameAr } : {}),
          ...(rest.menuNameEn !== undefined ? { menuNameEn: rest.menuNameEn } : {}),
          ...(rest.priceListId !== undefined ? { priceListId: rest.priceListId } : {}),
          ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
        },
      });

      if (warehouseIds) {
        await tx.newModuleStore.deleteMany({ where: { newModuleId: id } });
        if (warehouseIds.length) {
          await tx.newModuleStore.createMany({
            data: warehouseIds.map((warehouseId) => ({
              companyId,
              newModuleId: id,
              warehouseId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.newModule.findUniqueOrThrow({
        where: { id },
        include: { priceList: true, stores: { include: { warehouse: true } } },
      });
    });
  }

  async remove(companyId: string, id: string) {
    const existing = await prisma.newModule.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError(404, 'NewModule not found');
    await prisma.newModule.delete({ where: { id } });
  }

  /** Resolve the 4-char settings-engine module key (baseType + moduleCode) for a NewModule row. */
  async resolveFullCode(companyId: string, id: string): Promise<string> {
    const row = await prisma.newModule.findFirst({ where: { id, companyId }, select: { fullCode: true } });
    if (!row) throw new AppError(404, 'NewModule not found');
    return row.fullCode;
  }

  async findByFullCode(companyId: string, fullCode: string) {
    return prisma.newModule.findFirst({
      where: { companyId, fullCode },
      include: { stores: true },
    });
  }

  /**
   * Legacy `NewModuleStore`: an empty store list means every warehouse is
   * allowed; a non-empty list is an allow-list.
   */
  async isWarehouseAllowed(
    companyId: string,
    newModuleId: string,
    warehouseId: string
  ): Promise<boolean> {
    const stores = await prisma.newModuleStore.findMany({
      where: { companyId, newModuleId },
      select: { warehouseId: true },
    });
    if (stores.length === 0) return true;
    return stores.some((s) => s.warehouseId === warehouseId);
  }

  async listActiveByBaseType(companyId: string, baseType: string) {
    return prisma.newModule.findMany({
      where: { companyId, baseType, isActive: true },
      orderBy: { moduleCode: 'asc' },
    });
  }

  // ---- OtherModulesRights ----

  async listOtherModuleRights(companyId: string) {
    return prisma.otherModuleRight.findMany({ where: { companyId }, orderBy: [{ sanadModule: 'asc' }, { readModule: 'asc' }] });
  }

  async grantOtherModuleRight(companyId: string, sanadModule: string, readModule: string) {
    return prisma.otherModuleRight.upsert({
      where: { companyId_sanadModule_readModule: { companyId, sanadModule, readModule } },
      create: { companyId, sanadModule, readModule },
      update: {},
    });
  }

  async revokeOtherModuleRight(companyId: string, id: string) {
    const existing = await prisma.otherModuleRight.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError(404, 'OtherModuleRight not found');
    await prisma.otherModuleRight.delete({ where: { id } });
  }

  /** Legacy check: may `sanadModule` read/pull records from `readModule`? */
  async canRead(companyId: string, sanadModule: string, readModule: string): Promise<boolean> {
    const row = await prisma.otherModuleRight.findUnique({
      where: { companyId_sanadModule_readModule: { companyId, sanadModule, readModule } },
    });
    return row != null;
  }
}

export const newModuleService = new NewModuleService();
