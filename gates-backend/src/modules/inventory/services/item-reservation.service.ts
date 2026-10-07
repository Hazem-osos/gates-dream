import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import type {
  CreateItemReservationInput,
  UpdateItemReservationInput,
} from '../schemas/item-reservation.schema';
import {
  adjustStockInTx,
  getWarehouseBalance,
  lockWarehouseBalanceInTx,
} from './adjust-stock-in-tx';
import { assertWarehouseActive } from '../utils/inventory-system';

export const ITEM_RESERVATION_ACTIVE = 'ACTIVE';
export const ITEM_RESERVATION_PARTIALLY_FULFILLED = 'PARTIALLY_FULFILLED';
export const ITEM_RESERVATION_FULFILLED = 'FULFILLED';
export const ITEM_RESERVATION_RELEASED = 'RELEASED';

/** Open holds still drawable on documents (not fully issued / not cancelled). */
export const ITEM_RESERVATION_OPEN_STATUSES = [
  ITEM_RESERVATION_ACTIVE,
  ITEM_RESERVATION_PARTIALLY_FULFILLED,
] as const;

const detailSelect = {
  id: true,
  warehouseId: true,
  itemId: true,
  customerId: true,
  quantity: true,
  fulfilledQuantity: true,
  reason: true,
  status: true,
  releasedAt: true,
  createdAt: true,
  updatedAt: true,
  warehouse: { select: { id: true, code: true, arabicName: true } },
  item: { select: { id: true, serial: true, arabicName: true } },
  customer: { select: { id: true, code: true, arabicName: true } },
} satisfies Prisma.ItemReservationSelect;

type ReservationDetail = Prisma.ItemReservationGetPayload<{ select: typeof detailSelect }>;

type LockedReservation = {
  id: string;
  warehouseId: string;
  itemId: string;
  customerId: string | null;
  quantity: unknown;
  fulfilledQuantity: unknown;
  status: string;
};

function qtyOf(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === 'object' && value !== null && 'toNumber' in value
    ? Number((value as { toNumber: () => number }).toNumber())
    : Number(value);
  return Number.isFinite(n) ? roundTo4(n) : 0;
}

function formatQty(value: number): string {
  return qtyOf(value).toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function reservationRemaining(quantity: number, fulfilled: number): number {
  return roundTo4(Math.max(0, roundTo4(quantity) - roundTo4(fulfilled)));
}

export function reservationIssueStatusLabel(
  quantity: number,
  fulfilled: number,
  status: string
): string {
  if (status === ITEM_RESERVATION_RELEASED) return 'ملغى';
  if (fulfilled <= 0) return 'لم يتم الصرف بعد';
  if (fulfilled + 1e-9 >= quantity) return 'تم الصرف';
  return 'اتصرف جزئياً';
}

function statusAfterFulfillment(quantity: number, fulfilled: number): string {
  if (fulfilled + 1e-9 >= quantity) return ITEM_RESERVATION_FULFILLED;
  if (fulfilled > 0) return ITEM_RESERVATION_PARTIALLY_FULFILLED;
  return ITEM_RESERVATION_ACTIVE;
}

/** Extra quantity that must still be free before the hold can grow. */
export function reservationStockDelta(currentQuantity: number, nextQuantity: number): number {
  return roundTo4(roundTo4(nextQuantity) - roundTo4(currentQuantity));
}

export function assertCanReserve(available: number, additional: number): void {
  const free = roundTo4(available);
  const need = roundTo4(additional);
  if (need > free) {
    throw new AppError(422, `الكمية المتاحة لا تكفي للحجز. المتاح: ${formatQty(free)}`);
  }
}

export function assertCanReleaseReserved(reserved: number, quantity: number): void {
  if (roundTo4(reserved) + 1e-9 < roundTo4(quantity)) {
    throw new AppError(422, 'الكمية المحجوزة في المخزن أقل من هذا الحجز');
  }
}

function mapReservation(row: ReservationDetail) {
  const quantity = qtyOf(row.quantity);
  const fulfilledQuantity = qtyOf(row.fulfilledQuantity);
  const remainingQuantity = reservationRemaining(quantity, fulfilledQuantity);
  return {
    id: row.id,
    warehouseId: row.warehouseId,
    itemId: row.itemId,
    customerId: row.customerId,
    quantity,
    fulfilledQuantity,
    remainingQuantity,
    reason: row.reason,
    status: row.status,
    issueStatusLabel: reservationIssueStatusLabel(quantity, fulfilledQuantity, row.status),
    releasedAt: row.releasedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    warehouseName: row.warehouse.arabicName,
    warehouseCode: row.warehouse.code,
    itemName: row.item.arabicName,
    itemSerial: row.item.serial ?? '',
    customerName: row.customer?.arabicName ?? '',
    customerCode: row.customer?.code ?? null,
  };
}

async function lockReservationInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  id: string
): Promise<LockedReservation | null> {
  const rows = await tx.$queryRaw<LockedReservation[]>`
    SELECT id, warehouseId, itemId, customerId, quantity, fulfilledQuantity, status
    FROM item_reservations
    WHERE id = ${id} AND companyId = ${companyId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

async function loadDetail(tx: Prisma.TransactionClient, companyId: string, id: string) {
  const row = await tx.itemReservation.findFirst({
    where: { id, companyId },
    select: detailSelect,
  });
  if (!row) throw new AppError(404, 'الحجز غير موجود');
  return mapReservation(row);
}

export type FulfillReservationInput = {
  reservationId: string;
  warehouseId: string;
  itemId: string;
  quantity: number;
  /** When set (e.g. sales invoice), reject fulfill if the reservation belongs to another customer. */
  expectedCustomerId?: string | null;
};

/** Release reserved qty before outbound movement (same TX). */
export async function fulfillReservationInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  input: FulfillReservationInput
): Promise<number> {
  const want = roundTo4(input.quantity);
  if (!(want > 0)) return 0;

  const locked = await lockReservationInTx(tx, companyId, input.reservationId);
  if (!locked) throw new AppError(404, 'الحجز غير موجود');
  if (!ITEM_RESERVATION_OPEN_STATUSES.includes(locked.status as (typeof ITEM_RESERVATION_OPEN_STATUSES)[number])) {
    throw new AppError(409, 'لا يمكن الصرف من حجز مغلق أو ملغى');
  }
  if (locked.warehouseId !== input.warehouseId || locked.itemId !== input.itemId) {
    throw new AppError(422, 'الحجز لا يطابق المخزن أو الصنف في السطر');
  }
  if (
    input.expectedCustomerId &&
    locked.customerId &&
    locked.customerId !== input.expectedCustomerId
  ) {
    throw new AppError(422, 'الحجز لا يخص العميل المحدد في الفاتورة');
  }

  const total = qtyOf(locked.quantity);
  const fulfilled = qtyOf(locked.fulfilledQuantity);
  const remaining = reservationRemaining(total, fulfilled);
  const fulfill = roundTo4(Math.min(want, remaining));
  if (!(fulfill > 0)) {
    throw new AppError(422, 'لا توجد كمية متبقية في هذا الحجز للصرف');
  }

  await lockWarehouseBalanceInTx(tx, companyId, locked.itemId, locked.warehouseId);
  const balance = await getWarehouseBalance(tx, companyId, locked.itemId, locked.warehouseId);
  assertCanReleaseReserved(balance.reservedQuantity, fulfill);
  await adjustStockInTx(tx, {
    companyId,
    itemId: locked.itemId,
    warehouseId: locked.warehouseId,
    deltaReserved: -fulfill,
  });

  const nextFulfilled = roundTo4(fulfilled + fulfill);
  const nextStatus = statusAfterFulfillment(total, nextFulfilled);
  const saved = await tx.itemReservation.updateMany({
    where: {
      id: input.reservationId,
      companyId,
      status: { in: [...ITEM_RESERVATION_OPEN_STATUSES] },
    },
    data: {
      fulfilledQuantity: nextFulfilled.toFixed(4),
      status: nextStatus,
    },
  });
  if (saved.count !== 1) throw new AppError(409, 'تعذر تحديث الحجز');
  return fulfill;
}

export async function reverseReservationFulfillmentInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  input: FulfillReservationInput
): Promise<void> {
  const back = roundTo4(input.quantity);
  if (!(back > 0)) return;

  const locked = await lockReservationInTx(tx, companyId, input.reservationId);
  if (!locked) throw new AppError(404, 'الحجز غير موجود');

  const fulfilled = qtyOf(locked.fulfilledQuantity);
  if (roundTo4(fulfilled) + 1e-9 < back) {
    throw new AppError(422, 'لا يمكن عكس صرف أكبر من الكمية المصروفة من الحجز');
  }

  await lockWarehouseBalanceInTx(tx, companyId, locked.itemId, locked.warehouseId);
  await adjustStockInTx(tx, {
    companyId,
    itemId: locked.itemId,
    warehouseId: locked.warehouseId,
    deltaReserved: back,
  });

  const nextFulfilled = roundTo4(Math.max(0, fulfilled - back));
  const total = qtyOf(locked.quantity);
  const nextStatus =
    locked.status === ITEM_RESERVATION_RELEASED
      ? ITEM_RESERVATION_RELEASED
      : statusAfterFulfillment(total, nextFulfilled);

  await tx.itemReservation.updateMany({
    where: { id: input.reservationId, companyId },
    data: {
      fulfilledQuantity: nextFulfilled.toFixed(4),
      status: nextStatus,
    },
  });
}

export class ItemReservationService {
  async list(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      warehouseId?: string;
      itemId?: string;
      customerId?: string;
      status?: 'ACTIVE' | 'RELEASED' | 'ALL' | 'OPEN';
    }
  ) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 100);
    const status = options.status ?? 'OPEN';
    const where: Prisma.ItemReservationWhereInput = {
      companyId,
      ...(options.warehouseId ? { warehouseId: options.warehouseId } : {}),
      ...(options.itemId ? { itemId: options.itemId } : {}),
      ...(options.customerId ? { customerId: options.customerId } : {}),
      ...(status === 'ALL'
        ? {}
        : status === 'RELEASED'
          ? { status: ITEM_RESERVATION_RELEASED }
          : status === 'ACTIVE'
            ? { status: ITEM_RESERVATION_ACTIVE }
            : { status: { in: [...ITEM_RESERVATION_OPEN_STATUSES] } }),
    };
    const [rows, total] = await Promise.all([
      prisma.itemReservation.findMany({
        where,
        select: detailSelect,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.itemReservation.count({ where }),
    ]);
    return {
      rows: rows.map(mapReservation),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.itemReservation.findFirst({
      where: { id, companyId },
      select: detailSelect,
    });
    if (!row) throw new AppError(404, 'الحجز غير موجود');
    return mapReservation(row);
  }

  async create(companyId: string, input: CreateItemReservationInput) {
    const quantity = roundTo4(input.quantity);
    if (!(quantity > 0)) throw new AppError(400, 'الكمية يجب أن تكون أكبر من صفر');
    const reason = input.reason.trim();
    await assertWarehouseActive(companyId, input.warehouseId);
    const item = await prisma.item.findFirst({
      where: { id: input.itemId, companyId, isActive: true },
      select: { id: true, inactiveItem: true },
    });
    if (!item || item.inactiveItem) {
      throw new AppError(404, 'الصنف غير موجود أو غير نشط');
    }
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!customer) {
      throw new AppError(404, 'العميل غير موجود أو غير نشط');
    }

    return prisma.$transaction(async (tx) => {
      await lockWarehouseBalanceInTx(tx, companyId, input.itemId, input.warehouseId);
      const balance = await getWarehouseBalance(tx, companyId, input.itemId, input.warehouseId);
      assertCanReserve(balance.availableQuantity, quantity);
      await adjustStockInTx(tx, {
        companyId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        deltaReserved: quantity,
      });
      const created = await tx.itemReservation.create({
        data: {
          companyId,
          warehouseId: input.warehouseId,
          itemId: input.itemId,
          customerId: input.customerId,
          quantity: quantity.toFixed(4),
          fulfilledQuantity: '0',
          reason,
          status: ITEM_RESERVATION_ACTIVE,
        },
        select: { id: true },
      });
      return loadDetail(tx, companyId, created.id);
    });
  }

  async update(companyId: string, id: string, input: UpdateItemReservationInput) {
    const nextQuantity = roundTo4(input.quantity);
    if (!(nextQuantity > 0)) throw new AppError(400, 'الكمية يجب أن تكون أكبر من صفر');
    const reason = input.reason.trim();

    return prisma.$transaction(async (tx) => {
      const locked = await lockReservationInTx(tx, companyId, id);
      if (!locked) throw new AppError(404, 'الحجز غير موجود');
      if (!ITEM_RESERVATION_OPEN_STATUSES.includes(locked.status as (typeof ITEM_RESERVATION_OPEN_STATUSES)[number])) {
        throw new AppError(409, 'لا يمكن تعديل حجز مغلق أو ملغى');
      }
      const fulfilled = qtyOf(locked.fulfilledQuantity);
      if (nextQuantity + 1e-9 < fulfilled) {
        throw new AppError(422, 'لا يمكن أن تكون كمية الحجز أقل من الكمية المصروفة');
      }
      const delta = reservationStockDelta(qtyOf(locked.quantity), nextQuantity);
      if (delta !== 0) {
        await lockWarehouseBalanceInTx(tx, companyId, locked.itemId, locked.warehouseId);
        const balance = await getWarehouseBalance(tx, companyId, locked.itemId, locked.warehouseId);
        if (delta > 0) assertCanReserve(balance.availableQuantity, delta);
        else assertCanReleaseReserved(balance.reservedQuantity, Math.abs(delta));
        await adjustStockInTx(tx, {
          companyId,
          itemId: locked.itemId,
          warehouseId: locked.warehouseId,
          deltaReserved: delta,
        });
      }
      const saved = await tx.itemReservation.updateMany({
        where: {
          id,
          companyId,
          status: { in: [...ITEM_RESERVATION_OPEN_STATUSES] },
        },
        data: {
          quantity: nextQuantity.toFixed(4),
          reason,
          status: statusAfterFulfillment(nextQuantity, fulfilled),
        },
      });
      if (saved.count !== 1) throw new AppError(409, 'لا يمكن تعديل حجز مغلق أو ملغى');
      return loadDetail(tx, companyId, id);
    });
  }

  async release(companyId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const locked = await lockReservationInTx(tx, companyId, id);
      if (!locked) throw new AppError(404, 'الحجز غير موجود');
      if (locked.status === ITEM_RESERVATION_RELEASED) {
        throw new AppError(409, 'الحجز ملغى بالفعل');
      }
      if (locked.status === ITEM_RESERVATION_FULFILLED) {
        throw new AppError(409, 'تم صرف الحجز بالكامل ولا يمكن إلغاؤه');
      }

      const total = qtyOf(locked.quantity);
      const fulfilled = qtyOf(locked.fulfilledQuantity);
      const remaining = reservationRemaining(total, fulfilled);
      if (!(remaining > 0)) {
        throw new AppError(409, 'لا توجد كمية محجوزة متبقية لإلغائها');
      }

      await lockWarehouseBalanceInTx(tx, companyId, locked.itemId, locked.warehouseId);
      const balance = await getWarehouseBalance(tx, companyId, locked.itemId, locked.warehouseId);
      assertCanReleaseReserved(balance.reservedQuantity, remaining);
      await adjustStockInTx(tx, {
        companyId,
        itemId: locked.itemId,
        warehouseId: locked.warehouseId,
        deltaReserved: -remaining,
      });

      const nextStatus =
        fulfilled > 0 ? statusAfterFulfillment(total, fulfilled) : ITEM_RESERVATION_RELEASED;

      const saved = await tx.itemReservation.updateMany({
        where: {
          id,
          companyId,
          status: { not: ITEM_RESERVATION_RELEASED },
        },
        data: {
          status: nextStatus,
          ...(fulfilled <= 0 ? { releasedAt: new Date() } : {}),
        },
      });
      if (saved.count !== 1) throw new AppError(409, 'تعذر إلغاء الحجز');

      return loadDetail(tx, companyId, id);
    });
  }
}

export const itemReservationService = new ItemReservationService();
