import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import { companySettingService } from '../../platform/services/company-setting.service';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { stockQueryService } from './stock-query.service';
import { adjustStockInTx, getWarehouseBalance } from './adjust-stock-in-tx';
import {
  clampKeysetLimit,
  isKeysetListRequest,
  paginateWithKeyset,
} from '../../../utils/pagination/keysetPagination';

export interface PostStockMovementInput {
  companyId: string;
  branchId?: string;
  warehouseId: string;
  itemId: string;
  locationId?: string | null;
  quantityDelta: number;
  unitCost?: number;
  movementType: string;
  sourceType?: string;
  sourceNumber?: string;
  sourceYearId?: string;
  documentDate: Date;
  effectiveAt?: Date;
  resultingAverageCost?: number;
  sourceDocumentId?: string;
  /** `true` skips the company negative-stock guard for this movement. */
  allowNegativeStock?: boolean;
}

export class StockMovementService {
  /**
   * Row lock for concurrent invoice posts on the same SKU/warehouse.
   *
   * `item_quantities` has no `companyId` column of its own (ownership only exists via its
   * `item`/`warehouse` relations), and this is raw SQL, so it never goes through the
   * Prisma tenant-scoping extension either way. The join against `items`/`warehouses`
   * makes the lock predicate itself tenant-aware: if `itemId`/`warehouseId` don't actually
   * belong to `companyId` (a bug upstream, or a cross-tenant id passed in error), this
   * matches zero rows and takes no lock, instead of locking (and later, via
   * `scopedItemQuantityWhere`, still safely refusing to touch) another tenant's row.
   */
  private async lockItemQuantityInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    itemId: string,
    warehouseId: string,
    locationId: string | null | undefined
  ): Promise<void> {
    if (locationId) {
      await tx.$queryRaw`
        SELECT iq.id FROM item_quantities iq
        INNER JOIN items i ON i.id = iq.itemId
        INNER JOIN warehouses w ON w.id = iq.warehouseId
        WHERE iq.itemId = ${itemId} AND iq.warehouseId = ${warehouseId} AND iq.locationId = ${locationId}
          AND i.companyId = ${companyId} AND w.companyId = ${companyId}
        FOR UPDATE
      `;
    } else {
      await tx.$queryRaw`
        SELECT iq.id FROM item_quantities iq
        INNER JOIN items i ON i.id = iq.itemId
        INNER JOIN warehouses w ON w.id = iq.warehouseId
        WHERE iq.itemId = ${itemId} AND iq.warehouseId = ${warehouseId} AND iq.locationId IS NULL
          AND i.companyId = ${companyId} AND w.companyId = ${companyId}
        FOR UPDATE
      `;
    }
  }

  async assertNegativeStockAllowed(
    companyId: string,
    warehouseId: string,
    itemId: string,
    locationId: string | null | undefined,
    quantityDelta: number,
    tx?: Prisma.TransactionClient,
    force?: boolean
  ): Promise<void> {
    if (quantityDelta >= 0) return;

    const settings = await (tx ?? prisma).companySettings.findUnique({
      where: { companyId },
      select: { allowNegativeBalance: true, preventNegativeStock: true },
    });
    // `AllowNegativeStore` isn't a real legacy key (doesn't exist anywhere in
    // `MainProgram/**.pas`) — kept only for existing callers/tests. The real
    // legacy flag is `AllowMinusQty` (`UntStoreDist.pas`/`UntStoreTrans.pas`/
    // `UntManufProc.pas` etc.: `AllowMinusQty='F'` blocks going negative).
    // Its legacy default is `'T'` (allow), but this app has always defaulted
    // to blocking negative stock, so — unlike other legacy-default lookups —
    // this deliberately stays default-`false` (not `getFlagOrLegacyDefault`)
    // to avoid silently flipping every unconfigured company to "allow
    // negative stock", only enforcing it once a company opts in explicitly.
    const legacyAllowNegativeStore = await companySettingService.getFlag(
      companyId,
      'AllowNegativeStore',
      false
    );
    const legacyAllowMinusQty = await companySettingService.getFlag(
      companyId,
      'AllowMinusQty',
      false
    );

    const allowNegative =
      settings?.preventNegativeStock === false ||
      settings?.allowNegativeBalance === true ||
      legacyAllowNegativeStore ||
      legacyAllowMinusQty;

    if (allowNegative && !force) return;

    let onHand: number;
    if (locationId) {
      if (tx) {
        const row = await tx.itemQuantity.findFirst({
          where: scopedItemQuantityWhere(companyId, {
            itemId,
            warehouseId,
            locationId,
          }),
        });
        onHand = row?.quantity.toNumber() ?? 0;
      } else {
        onHand = await stockQueryService.getWarehouseQuantity(
          companyId,
          warehouseId,
          itemId,
          locationId
        );
      }
    } else {
      const bal = await getWarehouseBalance(tx ?? prisma, companyId, itemId, warehouseId);
      onHand = bal.availableQuantity;
    }
    if (onHand + quantityDelta < 0) {
      const needed = Math.abs(quantityDelta);
      const [item, warehouse] = await Promise.all([
        (tx ?? prisma).item.findFirst({
          where: { id: itemId, companyId },
          select: { arabicName: true, serial: true },
        }),
        (tx ?? prisma).warehouse.findFirst({
          where: { id: warehouseId, companyId },
          select: { arabicName: true, code: true },
        }),
      ]);
      const label = item?.arabicName || item?.serial || itemId;
      const warehouseLabel = warehouse?.arabicName || warehouse?.code || warehouseId;
      throw new AppError(
        422,
        `الكمية المتاحة لا تكفي، الرصيد سيصبح بالسالب. الصنف «${label}» في مخزن «${warehouseLabel}». المتاح: ${onHand} — المطلوب: ${needed}`
      );
    }
  }

  async postMovement(input: PostStockMovementInput) {
    await this.assertNegativeStockAllowed(
      input.companyId,
      input.warehouseId,
      input.itemId,
      input.locationId,
      input.quantityDelta
    );

    return prisma.$transaction(async (tx) => this.postMovementInTx(tx, input));
  }

  async postMovementInTx(
    tx: Prisma.TransactionClient,
    input: PostStockMovementInput
  ) {
    const warehouse = await tx.warehouse.findFirst({
      where: { id: input.warehouseId, companyId: input.companyId },
      select: { isActive: true, arabicName: true },
    });
    if (!warehouse) {
      throw new AppError(404, 'المخزن غير موجود');
    }
    if (!warehouse.isActive) {
      throw new AppError(
        409,
        `المخزن «${warehouse.arabicName}» غير نشط. اختر مخزناً شغّالاً.`
      );
    }

    await this.lockItemQuantityInTx(
      tx,
      input.companyId,
      input.itemId,
      input.warehouseId,
      input.locationId
    );

    if (input.allowNegativeStock !== true) {
      await this.assertNegativeStockAllowed(
        input.companyId,
        input.warehouseId,
        input.itemId,
        input.locationId,
        input.quantityDelta,
        tx
      );
    }

    const movement = await tx.inventoryMovement.create({
        data: {
          companyId: input.companyId,
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          itemId: input.itemId,
          locationId: input.locationId ?? null,
          quantityDelta: new Decimal(input.quantityDelta),
          unitCost:
            input.unitCost != null ? new Decimal(input.unitCost) : null,
          resultingAverageCost:
            input.resultingAverageCost != null
              ? new Decimal(input.resultingAverageCost)
              : null,
          sourceDocumentId: input.sourceDocumentId,
          movementType: input.movementType,
          sourceType: input.sourceType,
          sourceNumber: input.sourceNumber,
          sourceYearId: input.sourceYearId,
          documentDate: input.documentDate,
          effectiveAt: input.effectiveAt ?? input.documentDate,
        },
      });

      const existing = await tx.itemQuantity.findFirst({
        where: scopedItemQuantityWhere(input.companyId, {
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          locationId: input.locationId ?? null,
        }),
      });

      const nextQty = (existing?.quantity.toNumber() ?? 0) + input.quantityDelta;

      if (existing) {
        await tx.itemQuantity.update({
          where: { id: existing.id },
          data: { quantity: new Decimal(nextQty) },
        });
      } else {
        await tx.itemQuantity.create({
          data: {
            itemId: input.itemId,
            warehouseId: input.warehouseId,
            locationId: input.locationId ?? null,
            quantity: new Decimal(nextQty),
          },
        });
      }

      const warehouseBal = await adjustStockInTx(tx, {
        companyId: input.companyId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        deltaQty: input.quantityDelta,
      });

      return {
        movement,
        quantityOnHand: warehouseBal.quantityOnHand,
        reservedQuantity: warehouseBal.reservedQuantity,
      };
  }

  async lockStockRowsInTx(
    tx: Prisma.TransactionClient,
    rows: Array<{
      companyId: string;
      itemId: string;
      warehouseId: string;
      locationId?: string | null;
    }>
  ): Promise<void> {
    const ordered = [...rows].sort((a, b) => {
      const ka = `${a.warehouseId}\u0000${a.itemId}\u0000${a.locationId ?? ''}`;
      const kb = `${b.warehouseId}\u0000${b.itemId}\u0000${b.locationId ?? ''}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    for (const row of ordered) {
      await this.lockItemQuantityInTx(
        tx,
        row.companyId,
        row.itemId,
        row.warehouseId,
        row.locationId
      );
    }
  }

  async listMovements(
    companyId: string,
    opts: {
      page?: number;
      limit?: number;
      cursor?: string;
      direction?: 'forward' | 'backward';
      itemId?: string;
      warehouseId?: string;
      movementType?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 50, 200);
    const where: Record<string, unknown> = { companyId };
    if (opts.itemId) where.itemId = opts.itemId;
    if (opts.warehouseId) where.warehouseId = opts.warehouseId;
    if (opts.movementType) where.movementType = opts.movementType;
    if (opts.startDate || opts.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (opts.startDate) {
        const d = new Date(opts.startDate);
        if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
      }
      if (opts.endDate) {
        const d = new Date(opts.endDate);
        if (!Number.isNaN(d.getTime())) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(opts.endDate)) {
            d.setUTCHours(23, 59, 59, 999);
          }
          dateFilter.lte = d;
        }
      }
      if (Object.keys(dateFilter).length > 0) where.documentDate = dateFilter;
    }

    const orderBy = [{ documentDate: 'desc' as const }, { id: 'desc' as const }];

    if (isKeysetListRequest(opts)) {
      const keyed = await paginateWithKeyset(prisma.inventoryMovement, {
        cursor: opts.cursor,
        limit: opts.limit,
        direction: opts.direction,
        where,
        orderBy,
        sortField: 'documentDate',
      });
      return {
        movements: keyed.items,
        items: keyed.items,
        nextCursor: keyed.nextCursor,
        prevCursor: keyed.prevCursor,
        hasMore: keyed.hasMore,
        pagination: {
          limit: clampKeysetLimit(opts.limit),
          nextCursor: keyed.nextCursor,
          prevCursor: keyed.prevCursor,
          hasMore: keyed.hasMore,
        },
      };
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return {
      movements,
      items: movements,
      nextCursor: null,
      prevCursor: null,
      hasMore: page * limit < total,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

export const stockMovementService = new StockMovementService();
