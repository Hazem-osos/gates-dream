// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { itemCostService } from './item-cost.service';
import { inventoryCostingService } from './inventory-costing.service';
import { COSTING_MOVEMENT } from './inventory-costing-math';
import { resolveStockGlAccounts, type StockGlPostingContext } from './stock-movement-gl.service';
import { assertStoreDocumentRight } from './store-document-rights';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import {
  assertWarehouseActive,
  getInventorySystem,
  pickInventoryAccount,
  resolveEffectiveWarehouseGlAccounts,
} from '../utils/inventory-system';
import {
  ensurePerpetualInventoryGlReady,
  PERPETUAL_GL_CONTEXT_AR,
} from '../utils/stock-gl-posting-guard';
import { AppError } from '../../../shared/middleware/error-handler';
import { openingBalanceService } from '../../accounting/services/opening-balance.service';
import {
  removeOpeningStockFromOpeningJournalInTx,
  syncOpeningStockIntoOpeningJournalInTx,
} from './opening-stock-opening-journal.sync';
import type {
  OpeningInventoryGlSlice,
  OpeningInventoryValuationGroup,
} from './opening-stock-gl-slices';

export type { OpeningInventoryGlSlice };
import { duplicateOpeningStockLine, openingLinesWithoutWarehouseOverlap } from './opening-stock-valuation';

const OPENING_STOCK_NEGATIVE_STOCK_AR =
  'لا يمكن إتمام العملية لأن جزءاً من كمية بضاعة أول المدة خُرج بالبيع أو بحركة لاحقة. راجع فواتير البيع والمخزون، أو فك ترحيل قيد الرصيد الافتتاحي إن كان مرتبطاً.';

function rethrowOpeningStockStockConflict(error: unknown): never {
  if (error instanceof AppError && error.statusCode === 422) {
    const msg = error.message || '';
    if (msg.includes('بالسالب') || msg.includes('لا تكفي')) {
      throw new AppError(422, OPENING_STOCK_NEGATIVE_STOCK_AR);
    }
  }
  throw error;
}

async function collectOpeningInventoryGlSlices(
  companyId: string,
  lines: Array<{
    itemId: string;
    warehouseId: string;
    quantity: unknown;
    unitPrice: unknown;
    item?: { arabicName?: string | null; serial?: string | null } | null;
    warehouse?: { arabicName?: string | null; code?: string | null } | null;
  }>,
  db: { item: { findMany: typeof prisma.item.findMany } } = prisma
): Promise<OpeningInventoryGlSlice[]> {
  const companyAccounts = await resolveStockGlAccounts(companyId).catch(() => null);
  const companyInventoryId = companyAccounts?.inventoryAccountId;
  const system = companyAccounts?.system ?? (await getInventorySystem(companyId));
  const warehouseIds = [...new Set(lines.map((line) => line.warehouseId).filter(Boolean))];
  const warehouseInventoryById = new Map<string, string | null>();
  for (const warehouseId of warehouseIds) {
    const gl = await resolveEffectiveWarehouseGlAccounts(companyId, warehouseId, db);
    warehouseInventoryById.set(warehouseId, gl.inventoryAccountId);
  }
  const items = await db.item.findMany({
    where: { id: { in: [...new Set(lines.map((line) => line.itemId))] } },
    select: { id: true, mainAccountId: true, arabicName: true, serial: true },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));
  const slices: OpeningInventoryGlSlice[] = [];
  for (const line of lines) {
    const value = roundTo4(Number(line.quantity) * Number(line.unitPrice));
    if (value === 0) continue;
    const itemRow = line.item ?? itemById.get(line.itemId);
    const accountId = pickInventoryAccount(
      system,
      companyInventoryId,
      warehouseInventoryById.get(line.warehouseId),
      itemRow?.mainAccountId
    );
    if (!accountId) continue;
    const itemLabel = itemRow?.arabicName || itemRow?.serial || line.itemId;
    const whLabel =
      line.warehouse?.arabicName || line.warehouse?.code || line.warehouseId.slice(0, 8);
    slices.push({
      accountId,
      value,
      description: `بضاعة أول المدة — ${itemLabel} (${whLabel})`,
      warehouseId: line.warehouseId,
    });
  }
  return slices;
}

function aggregateOpeningValuationGroups(
  slices: OpeningInventoryGlSlice[],
  warehouseNames: Map<string, string>
): OpeningInventoryValuationGroup[] {
  const buckets = new Map<string, OpeningInventoryValuationGroup>();
  for (const slice of slices) {
    const warehouseId = String(slice.warehouseId || '').trim();
    if (!warehouseId || slice.value === 0) continue;
    const key = `${warehouseId}|${slice.accountId}`;
    const prev = buckets.get(key);
    if (prev) {
      prev.valuation = roundTo4(prev.valuation + slice.value);
      continue;
    }
    buckets.set(key, {
      warehouseId,
      warehouseName: warehouseNames.get(warehouseId) || warehouseId.slice(0, 8),
      accountId: slice.accountId,
      valuation: roundTo4(slice.value),
    });
  }
  return [...buckets.values()].sort((a, b) =>
    a.warehouseName.localeCompare(b.warehouseName, 'ar')
  );
}

const SOURCE_TYPE = 'OB';

async function resolveCompanyBranchId(companyId: string, requested?: string | null): Promise<string> {
  const requestedId = requested?.trim();
  if (requestedId) {
    const branch = await prisma.branch.findFirst({
      where: { id: requestedId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (branch) return branch.id;
  }
  const fallback = await prisma.branch.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!fallback) {
    throw new Error('لا يوجد فرع للشركة. أضف فرعاً من إعدادات الشركة ثم أعد حفظ بضاعة أول المدة.');
  }
  return fallback.id;
}

async function resolveLockedOpeningDate(companyId: string, fallbackDate?: string) {
  try {
    const meta = await openingBalanceService.resolveOpeningDate(companyId);
    return meta.openingDate;
  } catch {
    const parsed = fallbackDate ? new Date(fallbackDate) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}

function assertUsableOpeningWarehouse(warehouse: {
  arabicName: string;
  isActive: boolean;
  warehouseKind: string | null;
  _count: { childWarehouses: number };
}) {
  if (!warehouse.isActive) {
    throw new Error(`المخزن «${warehouse.arabicName}» غير نشط. اختر مخزناً شغّالاً.`);
  }
  if (warehouse.warehouseKind === 'HEADER' && warehouse._count.childWarehouses > 0) {
    throw new Error(
      `المخزن «${warehouse.arabicName}» مجموعة وليس مخزناً تشغيلياً. اختر مخزناً فرعياً قابلاً للترحيل.`
    );
  }
}

async function assertWarehousesFreeForOpening(
  tx: { $queryRaw: typeof prisma.$queryRaw; openingStockLine: typeof prisma.openingStockLine },
  companyId: string,
  warehouseIds: string[],
  exceptOpeningStockId?: string
) {
  const ids = [...new Set(warehouseIds.map((id) => id.trim()).filter(Boolean))].sort();
  for (const warehouseId of ids) {
    await tx.$queryRaw`
      SELECT id FROM warehouses WHERE id = ${warehouseId} AND companyId = ${companyId} FOR UPDATE
    `;
  }
  if (ids.length === 0) return;
  const conflict = await tx.openingStockLine.findFirst({
    where: {
      warehouseId: { in: ids },
      openingStock: {
        companyId,
        isCancelled: false,
        ...(exceptOpeningStockId ? { id: { not: exceptOpeningStockId } } : {}),
      },
    },
    select: {
      warehouse: { select: { arabicName: true } },
      openingStock: { select: { serial: true } },
    },
  });
  if (!conflict) return;
  const serial = conflict.openingStock.serial ? ` رقم ${conflict.openingStock.serial}` : '';
  throw new Error(
    `المخزن «${conflict.warehouse.arabicName}» له كشف بضاعة أول المدة${serial} بالفعل. افتح نفس الكشف وعدّله، وكل مخزن له كشف لوحده.`
  );
}

function nextOpeningSerial(existing: Array<string | null | undefined>, year: number): string {
  const prefix = `OS-${year}-`;
  let max = 0;
  for (const value of existing) {
    const raw = String(value ?? '').trim();
    if (!raw) continue;
    if (raw === `OS-${year}`) {
      max = Math.max(max, 1);
      continue;
    }
    if (raw.startsWith(prefix)) {
      const n = Number.parseInt(raw.slice(prefix.length), 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export interface OpeningStockLine {
  itemId: string;
  warehouseId: string;
  locationId?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  batchNumber?: string | null;
  expiryDate?: Date | string | null;
}

function openingStockLineCreateData(openingStockId: string, lineData: OpeningStockLine) {
  const batchNumber = lineData.batchNumber?.trim() || null;
  let expiryDate: Date | null = null;
  if (lineData.expiryDate) {
    const parsed =
      lineData.expiryDate instanceof Date ? lineData.expiryDate : new Date(lineData.expiryDate);
    expiryDate = Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return {
    openingStockId,
    itemId: lineData.itemId,
    warehouseId: lineData.warehouseId,
    locationId: lineData.locationId || null,
    quantity: lineData.quantity,
    unitPrice: lineData.unitPrice,
    total: lineData.total,
    batchNumber,
    expiryDate,
  };
}

export interface CreateOpeningStockData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  date: string;
  lines: OpeningStockLine[];
}

export class OpeningStockService {
  /**
   * Create opening stock entry (draft — stock + opening-journal legs on post).
   */
  async createOpeningStock(
    companyId: string,
    data: CreateOpeningStockData,
    glCtx?: StockGlPostingContext
  ) {
    try {
      // Validate all items and warehouses belong to company
      data.lines = data.lines.map((line) => ({
        ...line,
        warehouseId: String(line.warehouseId ?? '').trim(),
      }));
      if (data.lines.some((line) => !line.warehouseId)) {
        throw new Error('اختر المخزن التشغيلي على كل سطر قبل الحفظ.');
      }
      const itemIds = [...new Set(data.lines.map((line) => line.itemId).filter(Boolean))];
      const warehouseIds = [...new Set(data.lines.map((line) => line.warehouseId).filter(Boolean))];
      const lockedDate = await resolveLockedOpeningDate(companyId, data.date);

      const items = await prisma.item.findMany({
        where: {
          id: { in: itemIds },
          companyId,
        },
        select: { id: true, arabicName: true, serial: true, isService: true, inactiveItem: true },
      });

      if (items.length !== itemIds.length) {
        throw new Error('صنف أو أكثر غير موجود أو لا يتبع الشركة. اختر الصنف من الدليل.');
      }
      const serviceItem = items.find((item) => item.isService);
      if (serviceItem) {
        throw new Error(
          `الصنف «${serviceItem.arabicName || serviceItem.serial}» خدمي ولا يُدخل في بضاعة أول المدة.`
        );
      }
      const inactiveItem = items.find((item) => item.inactiveItem);
      if (inactiveItem) {
        throw new Error(
          `الصنف «${inactiveItem.arabicName || inactiveItem.serial}» غير نشط. فعّله من بطاقة الصنف أو اختر صنفاً آخر.`
        );
      }

      if (warehouseIds.length > 0) {
        const warehouses = await prisma.warehouse.findMany({
          where: {
            id: { in: warehouseIds },
            companyId,
          },
          select: {
            id: true,
            isActive: true,
            arabicName: true,
            warehouseKind: true,
            _count: { select: { childWarehouses: { where: { isActive: true } } } },
          },
        });

        if (warehouses.length !== warehouseIds.length) {
          throw new Error('مخزن أو أكثر غير موجود أو لا يتبع الشركة. اختر مخزناً تشغيلياً.');
        }
        for (const warehouse of warehouses) {
          assertUsableOpeningWarehouse(warehouse);
        }
      }

      data.branchId = await resolveCompanyBranchId(companyId, data.branchId);
      if (warehouseIds.length !== 1) {
        throw new Error('كشف بضاعة أول المدة لمخزن واحد. احفظ كل مخزن في كشف لوحده.');
      }
      if (duplicateOpeningStockLine(data.lines)) {
        throw new Error('الصنف متكرر في نفس المخزن. اترك سطراً واحداً لكل صنف وتشغيلة.');
      }

      // Use transaction to ensure atomicity
      const openingStock = await prisma.$transaction(async (tx) => {
        await assertWarehousesFreeForOpening(tx, companyId, warehouseIds);
        // Create opening stock record
        const year = lockedDate.getUTCFullYear();
        const usedSerials = await tx.openingStock.findMany({
          where: { companyId, serial: { not: null } },
          select: { serial: true },
        });
        const serial =
          data.serial && !usedSerials.some((row) => row.serial === data.serial)
            ? data.serial
            : nextOpeningSerial(usedSerials.map((row) => row.serial), year);

        const record = await tx.openingStock.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial,
            date: lockedDate,
            isPosted: false,
            isApproved: false,
            isCancelled: false,
            totalAmount: data.lines.reduce((sum, line) => sum + line.total, 0),
          },
        });

        const lines = [];
        for (const lineData of data.lines) {
          const line = await tx.openingStockLine.create({
            data: openingStockLineCreateData(record.id, lineData),
          });
          lines.push(line);
        }

        return {
          ...record,
          lines,
        };
      });

      logger.info(
        { companyId, openingStockId: openingStock.id, linesCount: data.lines.length },
        'Opening stock created (draft — post to apply stock and opening journal lines)'
      );

      return openingStock;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating opening stock');
      throw error;
    }
  }

  /**
   * Replace lines on one warehouse's opening-stock document (draft or cancelled).
   * Stock and opening-journal legs apply only on post.
   */
  async updateOpeningStock(
    companyId: string,
    openingStockId: string,
    data: CreateOpeningStockData,
    glCtx?: StockGlPostingContext
  ) {
    const existing = await prisma.openingStock.findFirst({
      where: { id: openingStockId, companyId },
      include: { lines: true },
    });
    if (!existing) {
      throw new Error('كشف بضاعة أول المدة غير موجود');
    }
    if (existing.isPosted) {
      throw new Error('لا يمكن تعديل كشف مرحّل. فك الترحيل أولاً.');
    }

    data.lines = data.lines.map((line) => ({
      ...line,
      warehouseId: String(line.warehouseId ?? '').trim(),
    }));
    if (data.lines.some((line) => !line.warehouseId)) {
      throw new Error('اختر المخزن التشغيلي على كل سطر قبل الحفظ.');
    }
    const itemIds = [...new Set(data.lines.map((line) => line.itemId).filter(Boolean))];
    const warehouseIds = [...new Set(data.lines.map((line) => line.warehouseId).filter(Boolean))];
    const items = await prisma.item.findMany({
      where: { id: { in: itemIds }, companyId },
      select: { id: true, arabicName: true, serial: true, isService: true, inactiveItem: true },
    });
    if (items.length !== itemIds.length) {
      throw new Error('صنف أو أكثر غير موجود أو لا يتبع الشركة. اختر الصنف من الدليل.');
    }
    const serviceItem = items.find((item) => item.isService);
    if (serviceItem) {
      throw new Error(
        `الصنف «${serviceItem.arabicName || serviceItem.serial}» خدمي ولا يُدخل في بضاعة أول المدة.`
      );
    }
    const inactiveItem = items.find((item) => item.inactiveItem);
    if (inactiveItem) {
      throw new Error(
        `الصنف «${inactiveItem.arabicName || inactiveItem.serial}» غير نشط. فعّله من بطاقة الصنف أو اختر صنفاً آخر.`
      );
    }
    if (warehouseIds.length > 0) {
      const warehouses = await prisma.warehouse.findMany({
        where: { id: { in: warehouseIds }, companyId },
        select: {
          id: true,
          isActive: true,
          arabicName: true,
          warehouseKind: true,
          _count: { select: { childWarehouses: { where: { isActive: true } } } },
        },
      });
      if (warehouses.length !== warehouseIds.length) {
        throw new Error('مخزن أو أكثر غير موجود أو لا يتبع الشركة. اختر مخزناً تشغيلياً.');
      }
      for (const warehouse of warehouses) {
        assertUsableOpeningWarehouse(warehouse);
      }
    }

    const lockedDate = await resolveLockedOpeningDate(companyId, data.date);
    if (duplicateOpeningStockLine(data.lines)) {
      throw new Error('الصنف متكرر في نفس المخزن. اترك سطراً واحداً لكل صنف وتشغيلة.');
    }
    if (warehouseIds.length > 1) {
      const previous = new Set(existing.lines.map((line) => line.warehouseId));
      if (warehouseIds.some((id) => !previous.has(id))) {
        throw new Error('كشف بضاعة أول المدة لمخزن واحد. احفظ كل مخزن في كشف لوحده.');
      }
    }
    const branchId = await resolveCompanyBranchId(companyId, data.branchId || existing.branchId);

    return prisma.$transaction(async (tx) => {
      await assertWarehousesFreeForOpening(tx, companyId, warehouseIds, openingStockId);
      await tx.openingStockLine.deleteMany({ where: { openingStockId } });
      const lines = [];
      for (const lineData of data.lines) {
        const line = await tx.openingStockLine.create({
          data: openingStockLineCreateData(openingStockId, lineData),
        });
        lines.push(line);
      }
      const record = await tx.openingStock.update({
        where: { id: openingStockId },
        data: {
          branchId,
          description: data.description ?? existing.description,
          date: lockedDate,
          totalAmount: data.lines.reduce((sum, line) => sum + line.total, 0),
        },
      });
      return { ...record, lines };
    });
  }

  /**
   * Get opening stock by ID
   */
  async getOpeningStockById(companyId: string, openingStockId: string) {
    try {
      const openingStock = await prisma.openingStock.findFirst({
        where: {
          id: openingStockId,
          companyId,
        },
        include: {
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  code: true,
                  serial: true,
                  arabicName: true,
                  englishName: true,
                },
              },
              warehouse: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                  englishName: true,
                },
              },
              location: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                  englishName: true,
                },
              },
            },
          },
        },
      });

      if (!openingStock) {
        throw new Error('كشف بضاعة أول المدة غير موجود');
      }

      return openingStock;
    } catch (error) {
      logger.error({ error, companyId, openingStockId }, 'Error getting opening stock');
      throw error;
    }
  }

  /**
   * List opening stock entries
   */
  async listOpeningStock(
    companyId: string,
    options?: {
      branchId?: string;
      isPosted?: boolean;
      isApproved?: boolean;
      isCancelled?: boolean;
      fromDate?: string;
      toDate?: string;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    try {
      const where: any = {
        companyId,
      };

      if (options?.branchId) {
        where.branchId = options.branchId;
      }

      if (options?.isPosted !== undefined) {
        where.isPosted = options.isPosted;
      }

      if (options?.isApproved !== undefined) {
        where.isApproved = options.isApproved;
      }

      if (options?.isCancelled !== undefined) {
        where.isCancelled = options.isCancelled;
      }

      if (options?.search?.trim()) {
        where.OR = [
          { serial: { contains: options.search.trim() } },
          { description: { contains: options.search.trim() } },
        ];
      }

      if (options?.fromDate || options?.toDate) {
        where.date = {};
        if (options.fromDate) {
          where.date.gte = new Date(options.fromDate);
        }
        if (options.toDate) {
          where.date.lte = new Date(options.toDate);
        }
      }

      const [openingStock, total] = await Promise.all([
        prisma.openingStock.findMany({
          where,
          include: {
            lines: {
              select: {
                id: true,
                warehouseId: true,
                warehouse: { select: { arabicName: true, code: true } },
              },
              take: 1,
            },
          },
          orderBy: [{ serial: 'asc' }, { createdAt: 'desc' }],
          skip: options?.skip || 0,
          take: options?.take || 50,
        }),
        prisma.openingStock.count({ where }),
      ]);

      return {
        data: openingStock,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing opening stock');
      throw error;
    }
  }

  /**
   * Post opening stock (make it final)
   */
  private async applyOpeningStockLinesInTx(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    companyId: string,
    openingStock: {
      id: string;
      date: Date;
      branchId: string | null;
      serial: string | null;
      lines: Array<{
        itemId: string;
        warehouseId: string;
        locationId: string | null;
        quantity: unknown;
        unitPrice: unknown;
      }>;
    }
  ) {
    const sourceType = SOURCE_TYPE;
    const sourceNumber = openingStock.serial ?? openingStock.id.slice(0, 8);
    const sourceYearId = String(new Date(openingStock.date).getFullYear());
    for (const line of openingStock.lines) {
      const qty = Number(line.quantity);
      if (!(qty > 0)) continue;
      await inventoryCostingService.applyInboundMovement(tx, {
        companyId,
        branchId: openingStock.branchId ?? undefined,
        warehouseId: line.warehouseId,
        itemId: line.itemId,
        locationId: line.locationId ?? null,
        quantity: qty,
        unitCost: Number(line.unitPrice),
        movementType: COSTING_MOVEMENT.ADJUSTMENT_POSITIVE,
        sourceType,
        sourceNumber,
        sourceYearId,
        sourceDocumentId: openingStock.id,
        transactionDate: openingStock.date,
      });
    }
  }

  async postOpeningStock(
    companyId: string,
    openingStockId: string,
    glCtx?: StockGlPostingContext
  ) {
    await assertStoreDocumentRight(glCtx, 'openingStock', 'post');
    try {
      const openingStock = await prisma.openingStock.findFirst({
        where: {
          id: openingStockId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!openingStock) {
        throw new Error('كشف بضاعة أول المدة غير موجود');
      }

      if (openingStock.isCancelled) {
        throw new Error('لا يمكن ترحيل كشف بضاعة أول المدة الملغي. استرجعه أولاً.');
      }

      if (openingStock.isPosted) {
        throw new Error('كشف بضاعة أول المدة مرحّل مسبقاً');
      }

      const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, openingStock.date, {
        allowOpeningDocument: true,
      });
      const branchId = await resolveCompanyBranchId(companyId, openingStock.branchId);

      for (const warehouseId of new Set(
        openingStock.lines.map((line) => line.warehouseId).filter(Boolean)
      )) {
        await assertWarehouseActive(companyId, warehouseId);
      }

      const primaryWarehouseId = openingStock.lines[0]?.warehouseId ?? null;
      const inventorySystem = await ensurePerpetualInventoryGlReady(
        companyId,
        glCtx,
        primaryWarehouseId
      );

      const glSlices = await collectOpeningInventoryGlSlices(companyId, openingStock.lines);

      if (inventorySystem === 'PERPETUAL' && !glCtx) {
        throw new AppError(422, PERPETUAL_GL_CONTEXT_AR);
      }

      await prisma.$transaction(async (tx) => {
        await this.applyOpeningStockLinesInTx(tx, companyId, openingStock);

        let journalEntryId: string | null = openingStock.journalEntryId;
        if (glCtx && inventorySystem === 'PERPETUAL' && glSlices.length) {
          const accounts = await resolveStockGlAccounts(companyId);
          journalEntryId = await syncOpeningStockIntoOpeningJournalInTx(tx, companyId, {
            openingStockId,
            glSlices,
            creditAccountId: accounts.adjustmentAccountId,
          });
        }

        await tx.openingStock.update({
          where: { id: openingStockId },
          data: {
            isPosted: true,
            postedAt: new Date(),
            branchId,
            journalEntryId,
          },
        });
      });

      // Re-fetch to return the latest state
      const updated = await this.getOpeningStockById(companyId, openingStockId);

      logger.info({ companyId, openingStockId }, 'Opening stock posted');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, openingStockId }, 'Error posting opening stock');
      throw error;
    }
  }

  /**
   * Unpost opening stock
   */
  async unpostOpeningStock(
    companyId: string,
    openingStockId: string,
    glCtx?: StockGlPostingContext
  ) {
    await assertStoreDocumentRight(glCtx, 'openingStock', 'unpost');
    try {
      const openingStock = await prisma.openingStock.findFirst({
        where: {
          id: openingStockId,
          companyId,
        },
      });

      if (!openingStock) {
        throw new Error('كشف بضاعة أول المدة غير موجود');
      }

      if (!openingStock.isPosted) {
        throw new Error('كشف بضاعة أول المدة غير مرحّل');
      }

      await fiscalYearService.assertOpenForDate(companyId, openingStock.date, {
        allowOpeningDocument: true,
      });

      const sourceType = SOURCE_TYPE;
      const sourceNumber = openingStock.serial ?? openingStock.id.slice(0, 8);
      const sourceYearId = String(new Date(openingStock.date).getFullYear());

      // Reverse item quantities
      await prisma.$transaction(async (tx) => {
        const lines = await tx.openingStockLine.findMany({
          where: { openingStockId },
        });

        for (const line of lines) {
          await inventoryCostingService.reverseInboundInTx(tx, {
            companyId,
            branchId: openingStock.branchId ?? undefined,
            warehouseId: line.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            quantity: Number(line.quantity),
            originalUnitCost: Number(line.unitPrice),
            movementType: `${sourceType}-UNPOST`,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            transactionDate: openingStock.date,
            updateLastPurchasePrice: false,
          });

          await itemCostService.removeCostHistoryBySourceInTx(tx, {
            companyId,
            itemId: line.itemId,
            sourceType,
            sourceNumber,
            sourceYearId,
          });
        }

        await removeOpeningStockFromOpeningJournalInTx(tx, companyId, openingStockId);

        // Update to unposted
        await tx.openingStock.update({
          where: { id: openingStockId },
          data: {
            isPosted: false,
            postedAt: null,
          },
        });
      });

      logger.info({ companyId, openingStockId }, 'Opening stock unposted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, openingStockId }, 'Error unposting opening stock');
      rethrowOpeningStockStockConflict(error);
    }
  }

  /**
   * Cancel opening stock
   */
  async cancelOpeningStock(
    companyId: string,
    openingStockId: string,
    glCtx?: StockGlPostingContext
  ) {
    try {
      const openingStock = await prisma.openingStock.findFirst({
        where: {
          id: openingStockId,
          companyId,
        },
        include: { lines: true },
      });

      if (!openingStock) {
        throw new Error('كشف بضاعة أول المدة غير موجود');
      }

      if (openingStock.isCancelled) {
        throw new Error('كشف بضاعة أول المدة ملغي بالفعل');
      }

      if (openingStock.isPosted) {
        throw new Error('لا يمكن إلغاء كشف مرحّل. فك الترحيل أولاً.');
      }

      const updated = await prisma.$transaction(async (tx) => {
        await removeOpeningStockFromOpeningJournalInTx(tx, companyId, openingStockId);
        return tx.openingStock.update({
          where: { id: openingStockId },
          data: {
            isCancelled: true,
            cancelledAt: new Date(),
          },
        });
      });

      logger.info({ companyId, openingStockId }, 'Opening stock cancelled');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, openingStockId }, 'Error cancelling opening stock');
      throw error;
    }
  }

  /**
   * Restore cancelled opening stock
   */
  async restoreOpeningStock(
    companyId: string,
    openingStockId: string,
    glCtx?: StockGlPostingContext
  ) {
    try {
      const openingStock = await prisma.openingStock.findFirst({
        where: {
          id: openingStockId,
          companyId,
        },
        include: { lines: true },
      });

      if (!openingStock) {
        throw new Error('كشف بضاعة أول المدة غير موجود');
      }

      if (!openingStock.isCancelled) {
        throw new Error('كشف بضاعة أول المدة ليس ملغياً');
      }

      const warehouseIds = [
        ...new Set(openingStock.lines.map((line) => String(line.warehouseId || '').trim()).filter(Boolean)),
      ];

      const updated = await prisma.$transaction(async (tx) => {
        await assertWarehousesFreeForOpening(tx, companyId, warehouseIds, openingStockId);
        return tx.openingStock.update({
          where: { id: openingStockId },
          data: {
            isCancelled: false,
            cancelledAt: null,
          },
        });
      });

      logger.info({ companyId, openingStockId }, 'Opening stock restored');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, openingStockId }, 'Error restoring opening stock');
      throw error;
    }
  }

  /**
   * Σ (quantity × unitPrice) of every non-cancelled opening stock.
   * The document date is the day before the fiscal year, so a year-range
   * filter would drop them. Each warehouse is counted from one document only.
   */
  async getTotalValuation(companyId: string, _fiscalYearId?: string) {
    const docs = await prisma.openingStock.findMany({
      where: { companyId, isCancelled: false, isPosted: true },
      select: {
        id: true,
        isPosted: true,
        updatedAt: true,
        lines: {
          select: {
            quantity: true,
            unitPrice: true,
            itemId: true,
            warehouseId: true,
            warehouse: { select: { arabicName: true, code: true } },
            item: { select: { arabicName: true, serial: true, mainAccountId: true } },
          },
        },
      },
    });
    const keptDocs = openingLinesWithoutWarehouseOverlap(docs);
    const lines = keptDocs.flatMap((doc) => doc.lines);

    const warehouseNames = new Map<string, string>();
    for (const line of lines) {
      const id = String(line.warehouseId || '').trim();
      if (!id) continue;
      const label = line.warehouse?.arabicName || line.warehouse?.code || id.slice(0, 8);
      warehouseNames.set(id, label);
    }

    const glSlices = await collectOpeningInventoryGlSlices(companyId, lines);
    const groups = aggregateOpeningValuationGroups(glSlices, warehouseNames);

    let totalValuation = roundTo4(groups.reduce((sum, row) => sum + row.valuation, 0));
    const itemIds = new Set<string>();
    const warehouseIds = new Set<string>();
    for (const line of lines) {
      if (line.itemId) itemIds.add(line.itemId);
      if (line.warehouseId) warehouseIds.add(line.warehouseId);
    }

    let defaultStockAccountId: string | null = null;
    try {
      const accounts = await resolveStockGlAccounts(companyId);
      defaultStockAccountId = accounts.inventoryAccountId ?? null;
    } catch {
      defaultStockAccountId = null;
    }

    if (!defaultStockAccountId) {
      const fallback = await prisma.account.findFirst({
        where: {
          companyId,
          isActive: true,
          deletedAt: null,
          OR: [
            { code: { startsWith: '123' } },
            { arabicName: { contains: 'بضاعة أول المدة' } },
            { arabicName: { contains: 'مخزون' } },
          ],
        },
        orderBy: { code: 'asc' },
        select: { id: true },
      });
      defaultStockAccountId = fallback?.id ?? null;
    }

    return {
      totalValuation,
      currency: 'EGP',
      itemsCount: itemIds.size,
      warehousesCount: warehouseIds.size,
      defaultStockAccountId,
      /** One GL debit line per warehouse (and inventory account when they differ). */
      groups,
    };
  }
}

export const openingStockService = new OpeningStockService();

