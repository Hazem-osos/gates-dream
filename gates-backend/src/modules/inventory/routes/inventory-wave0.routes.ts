import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { costPreviewSchema, postMovementSchema } from '../../accounting/schemas/party-masters.schema';
import { z } from 'zod';
import { itemCostService } from '../services/item-cost.service';
import { stockMovementService } from '../services/stock-movement.service';
import { stockQueryService } from '../services/stock-query.service';
import { itemQuickPeekService } from '../services/item-quick-peek.service';
import { AuthRequest } from '../../../shared/auth/types';
import prisma from '../../../shared/database/prisma';
import {
  keysetDirectionFromRequest,
  setKeysetPaginationHeaders,
  wantsKeysetPagination,
} from '../../../utils/pagination/keyset-headers';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.post(
  '/cost/preview',
  authorize({ resource: 'item', action: 'view' }),
  validate({ body: costPreviewSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    const result = await itemCostService.calculateMovingAverage({
      companyId,
      branchId: req.body.branchId,
      itemId: req.body.itemId,
      invoiceDate: req.body.invoiceDate,
      itemCount: req.body.itemCount,
      itemPrice: req.body.itemPrice,
      sourceNum: req.body.sourceNum,
      sourceYearId: req.body.sourceYearId,
      sourceType: req.body.sourceType,
      change: req.body.change,
      purchaseInvoicePayCount: req.body.purchaseInvoicePayCount,
    });
    return void res.json({ status: 'success', data: result });
  }
);

router.get(
  '/items/:id/cost-history',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    const rows = await prisma.itemCostHistory.findMany({
      where: { companyId, itemId: req.params.id },
      orderBy: [{ serial: 'asc' }],
    });
    return void res.json({ status: 'success', data: rows });
  }
);

router.get(
  '/items/:id/cost-as-of',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    const dateStr = req.query.date as string;
    if (!companyId || !dateStr) {
      return void res.status(400).json({ status: 'error', message: 'Company ID and date required' });
    }
    const cost = await itemCostService.getCostAsOf(
      companyId,
      req.params.id,
      new Date(dateStr)
    );
    return void res.json({ status: 'success', data: { cost } });
  }
);

router.get(
  '/items/:id/quantity-as-of',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    const dateStr = req.query.date as string;
    if (!companyId || !dateStr) {
      return void res.status(400).json({ status: 'error', message: 'Company ID and date required' });
    }
    const quantity = await stockQueryService.getCompanyItemQuantityAsOf(
      companyId,
      req.params.id,
      new Date(dateStr)
    );
    return void res.json({ status: 'success', data: { quantity } });
  }
);

/**
 * GET /api/v1/inventory/items/:id/batches?warehouseId=
 * Remaining batch/expiry lots for an item in a warehouse (FEFO).
 */
router.get(
  '/items/:id/batches',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    const warehouseId = req.query.warehouseId as string | undefined;
    const itemId = req.params.id;

    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    if (!warehouseId) {
      return void res.status(400).json({ status: 'error', message: 'warehouseId is required' });
    }

    const item = await prisma.item.findFirst({
      where: { id: itemId, companyId },
      select: {
        id: true,
        useExpirationDate: true,
        useSerialNumber: true,
        clothingItem: true,
      },
    });
    if (!item) {
      return void res.status(404).json({ status: 'error', message: 'Item not found' });
    }

    const inboundKinds = ['PURCHASE', 'SALE_RETURN'];
    const lines = await prisma.invoiceLine.findMany({
      where: {
        itemId,
        batchNumber: { not: null },
        invoice: { companyId, isCancelled: false },
        OR: [{ warehouseId }, { warehouseId: null, invoice: { warehouseId } }],
      },
      select: {
        id: true,
        batchNumber: true,
        expiryDate: true,
        quantity: true,
        invoice: { select: { invoiceKind: true, invoiceType: true } },
      },
    });

    const buckets = new Map<
      string,
      { batchNumber: string; expiryDate: string | null; qty: number }
    >();
    for (const line of lines) {
      const number = (line.batchNumber || '').trim();
      if (!number) continue;
      const kind = String(line.invoice.invoiceKind || line.invoice.invoiceType || '').toUpperCase();
      const inbound = inboundKinds.includes(kind) || kind === 'PURCHASE' || kind.includes('PURCHASE');
      const signed = Number(line.quantity) * (inbound ? 1 : -1);
      const expiry = line.expiryDate ? line.expiryDate.toISOString().slice(0, 10) : null;
      const key = `${number}::${expiry ?? ''}`;
      const prev = buckets.get(key) ?? { batchNumber: number, expiryDate: expiry, qty: 0 };
      prev.qty += signed;
      buckets.set(key, prev);
    }

    const batches = [...buckets.values()]
      .filter((row) => row.qty > 0.0001)
      .sort((a, b) => {
        if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
        if (a.expiryDate) return -1;
        if (b.expiryDate) return 1;
        return a.batchNumber.localeCompare(b.batchNumber);
      })
      .map((row, index) => ({
        batchId: `${itemId}:${row.batchNumber}:${row.expiryDate ?? index}`,
        batchNumber: row.batchNumber,
        expiryDate: row.expiryDate,
        qty: row.qty,
      }));

    return void res.json({
      status: 'success',
      data: {
        itemId,
        warehouseId,
        hasExpiry: Boolean(item.useExpirationDate),
        trackingType: item.useExpirationDate || item.useSerialNumber ? 'BATCH' : 'NONE',
        batches,
      },
    });
  }
);

/**
 * GET /api/v1/inventory/items/:id/stock-balance?warehouseId=
 * Current warehouse on-hand / reserved / available from item_warehouse_balances.
 */
router.get(
  '/items/:id/stock-balance',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    const warehouseId = req.query.warehouseId as string | undefined;
    const itemId = req.params.id;

    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    if (!warehouseId) {
      return void res.status(400).json({ status: 'error', message: 'warehouseId is required' });
    }

    const item = await prisma.item.findFirst({
      where: { id: itemId, companyId },
      select: { id: true },
    });
    if (!item) {
      return void res.status(404).json({ status: 'error', message: 'Item not found' });
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId, isActive: true },
      select: { id: true, arabicName: true, code: true },
    });
    if (!warehouse) {
      return void res.status(404).json({ status: 'error', message: 'Warehouse not found' });
    }

    const balance = await stockQueryService.getWarehouseItemBalance(
      companyId,
      itemId,
      warehouseId
    );

    return void res.json({
      status: 'success',
      data: {
        itemId,
        warehouseId,
        warehouseName: warehouse.arabicName,
        warehouseCode: warehouse.code,
        quantityOnHand: balance.quantityOnHand,
        reservedQuantity: balance.reservedQuantity,
        availableQuantity: balance.availableQuantity,
      },
    });
  }
);

const inventoryMovementQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  cursor: z.string().min(1).optional(),
  direction: z.enum(['forward', 'backward']).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? parseInt(v, 10) : 50;
      return Math.min(Math.max(n, 1), 200);
    }),
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  movementType: z.string().max(30).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

router.get(
  '/movements',
  authorize({ resource: 'item', action: 'view' }),
  validate({ query: inventoryMovementQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    const result = await stockMovementService.listMovements(companyId, {
      page: req.query.page as number | undefined,
      limit: req.query.limit as number | undefined,
      cursor: req.query.cursor as string | undefined,
      direction: keysetDirectionFromRequest(req),
      itemId: req.query.itemId as string | undefined,
      warehouseId: req.query.warehouseId as string | undefined,
      movementType: req.query.movementType as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    if (wantsKeysetPagination(req)) {
      setKeysetPaginationHeaders(res, result);
    }
    return void res.json({
      status: 'success',
      data: result.movements,
      items: result.items,
      nextCursor: result.nextCursor,
      prevCursor: result.prevCursor,
      hasMore: result.hasMore,
      pagination: result.pagination,
    });
  }
);

router.post(
  '/movements/post',
  authorize({ resource: 'item', action: 'edit' }),
  validate({ body: postMovementSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    try {
      const data = await stockMovementService.postMovement({
        companyId,
        ...req.body,
      });
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      return void res.status(400).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Movement failed',
      });
    }
  }
);

router.get(
  '/items/:id/quick-peek',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    try {
      const unitPriceHint = req.query.unitPrice
        ? Number(req.query.unitPrice)
        : undefined;
      const data = await itemQuickPeekService.getQuickPeek({
        companyId,
        itemId: req.params.id,
        customerId: (req.query.customerId as string) || undefined,
        unitPriceHint,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      return void res.status(404).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Quick peek failed',
      });
    }
  }
);

export default router;
