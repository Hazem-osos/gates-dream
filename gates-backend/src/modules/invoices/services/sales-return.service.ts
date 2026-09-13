import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { loadInvoiceTransactionSettings } from './invoice-document-type';
import type { CreateM5InvoiceInput } from '../schemas/invoice-m5.schema';

const PRICE_EPS = 0.02;
const QTY_EPS = 1e-6;

export type ReturnableLine = {
  originalInvoiceLineId: string;
  itemId: string;
  itemName: string;
  unitId: string;
  soldQty: number;
  returnedQty: number;
  returnableQty: number;
  unitPrice: number;
  taxPercent: number;
  discountPercent: number;
  warehouseId: string | null;
};

function netUnitPrice(line: {
  price: { toNumber?: () => number } | number;
  total: { toNumber?: () => number } | number;
  discountAmount?: { toNumber?: () => number } | number | null;
  quantity: { toNumber?: () => number } | number;
}): number {
  const qty = Number(line.quantity);
  const listed = Number(line.price);
  if (qty <= 0) return listed;
  const net = Number(line.total) - Number(line.discountAmount ?? 0);
  if (Number.isFinite(net) && net > 0) return roundTo4(net / qty);
  return listed;
}

export async function listReturnableLines(
  companyId: string,
  originalInvoiceId: string,
  excludeReturnId?: string | null,
  expectedKind?: 'SALE' | 'PURCHASE'
): Promise<{
  originalInvoiceId: string;
  originalInvoiceNumber: string | null;
  invoiceKind: string;
  customerId: string | null;
  supplierId: string | null;
  warehouseId: string | null;
  date: Date;
  netAmount: number;
  customerName: string | null;
  supplierName: string | null;
  lines: ReturnableLine[];
}> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: originalInvoiceId,
      companyId,
      isCancelled: false,
      invoiceKind: expectedKind ?? { in: ['SALE', 'PURCHASE'] },
    },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceKind: true,
      customerId: true,
      supplierId: true,
      warehouseId: true,
      date: true,
      netAmount: true,
      customer: { select: { arabicName: true } },
      supplier: { select: { arabicName: true } },
      lines: {
        orderBy: { lineOrder: 'asc' },
        select: {
          id: true,
          itemId: true,
          unitId: true,
          quantity: true,
          baseQuantity: true,
          price: true,
          total: true,
          discountAmount: true,
          discountPercent: true,
          taxPercent: true,
          warehouseId: true,
          unitCostAtIssue: true,
          item: { select: { arabicName: true } },
          landedCostAllocationLines: { select: { unitCostAdded: true } },
        },
      },
    },
  });
  if (!invoice) {
    throw new AppError(
      404,
      expectedKind === 'PURCHASE'
        ? 'فاتورة المشتريات الأصلية غير موجودة أو ملغاة'
        : 'فاتورة المبيعات الأصلية غير موجودة أو ملغاة'
    );
  }

  const originalIds = invoice.lines.map((l) => l.id);
  const already = originalIds.length
    ? await prisma.invoiceLine.groupBy({
        by: ['originalInvoiceLineId'],
        where: {
          originalInvoiceLineId: { in: originalIds },
          ...(excludeReturnId ? { invoiceId: { not: excludeReturnId } } : {}),
          invoice: {
            isCancelled: false,
            ...(expectedKind === 'PURCHASE'
              ? { invoiceKind: 'PURCHASE_RETURN' as const }
              : expectedKind === 'SALE'
                ? { invoiceKind: 'SALE_RETURN' as const }
                : {}),
          },
        },
        _sum: { baseQuantity: true },
      })
    : [];
  const returnedById = new Map(
    already.map((r) => [r.originalInvoiceLineId as string, Number(r._sum.baseQuantity ?? 0)])
  );

  return {
    originalInvoiceId: invoice.id,
    originalInvoiceNumber: invoice.invoiceNumber,
    invoiceKind: invoice.invoiceKind ?? expectedKind ?? 'SALE',
    customerId: invoice.customerId,
    supplierId: invoice.supplierId,
    warehouseId: invoice.warehouseId,
    date: invoice.date,
    netAmount: Number(invoice.netAmount),
    customerName: invoice.customer?.arabicName ?? null,
    supplierName: invoice.supplier?.arabicName ?? null,
    lines: invoice.lines.map((line) => {
      const soldQty = Number(line.baseQuantity ?? line.quantity);
      const returnedQty = returnedById.get(line.id) ?? 0;
      const listed = netUnitPrice(line);
      const landedAdd = (line.landedCostAllocationLines ?? []).reduce(
        (sum, row) => sum + Number(row.unitCostAdded ?? 0),
        0
      );
      const effectivePurchase = landedAdd > 0 ? roundTo4(listed + landedAdd) : listed;
      return {
        originalInvoiceLineId: line.id,
        itemId: line.itemId,
        itemName: line.item?.arabicName ?? line.itemId,
        unitId: line.unitId,
        soldQty,
        returnedQty,
        returnableQty: roundTo4(Math.max(0, soldQty - returnedQty)),
        unitPrice:
          (invoice.invoiceKind ?? expectedKind) === 'PURCHASE' ? effectivePurchase : listed,
        taxPercent: Number(line.taxPercent ?? 0),
        discountPercent: Number(line.discountPercent ?? 0),
        warehouseId: line.warehouseId,
      };
    }),
  };
}

export async function assertSalesReturnPolicy(params: {
  companyId: string;
  invoiceKind: string;
  selfInvoiceId?: string | null;
  originalInvoiceId?: string | null;
  lines: CreateM5InvoiceInput['lines'];
}): Promise<{ originalInvoiceNumber: string | null } | null> {
  if (params.invoiceKind !== 'SALE_RETURN') return null;

  const settings = await loadInvoiceTransactionSettings(params.companyId, 'SALE_RETURN');
  const originalId = params.originalInvoiceId?.trim() || null;

  if (settings && settings.allowStandaloneReturns === false && !originalId) {
    throw new AppError(
      400,
      'غير مسموح بإنشاء مردود مبيعات حر دون الارتباط بفاتورة بيع أصلية مسبقة طبقاً لسياسة الشركة'
    );
  }

  if (!originalId) return { originalInvoiceNumber: null };

  const snapshot = await listReturnableLines(
    params.companyId,
    originalId,
    params.selfInvoiceId,
    'SALE'
  );
  const byOriginal = new Map(snapshot.lines.map((l) => [l.originalInvoiceLineId, l]));

  const requestedByOriginal = new Map<string, { qty: number; price: number; itemId: string }>();
  for (const line of params.lines) {
    if (!line.originalInvoiceLineId) {
      if (settings && settings.allowStandaloneReturns === false) {
        throw new AppError(
          400,
          'كل بنود المردود يجب أن ترتبط بسطر من فاتورة البيع الأصلية طبقاً لسياسة الشركة'
        );
      }
      continue;
    }
    const prev = requestedByOriginal.get(line.originalInvoiceLineId);
    requestedByOriginal.set(line.originalInvoiceLineId, {
      qty: (prev?.qty ?? 0) + Number(line.baseQuantity ?? line.quantity),
      price: Number(line.price),
      itemId: line.itemId,
    });
  }

  for (const [originalLineId, req] of requestedByOriginal) {
    const origin = byOriginal.get(originalLineId);
    if (!origin) {
      throw new AppError(400, 'سطر المردود لا ينتمي لفاتورة البيع الأصلية المحددة');
    }
    if (roundTo4(req.qty) > roundTo4(origin.returnableQty) + QTY_EPS) {
      throw new AppError(
        400,
        `لا يمكن إرجاع كمية [${req.qty}] من الصنف [${origin.itemName}]. أقصى كمية متبقية قابلة للإرجاع هي [${origin.returnableQty}]`
      );
    }
    if (settings?.enforceOriginalPrice === true && Math.abs(req.price - origin.unitPrice) > PRICE_EPS) {
      throw new AppError(
        400,
        `سعر إرجاع الصنف «${origin.itemName}» يجب أن يساوي سعر البيع الأصلي ([${origin.unitPrice}])`
      );
    }
  }

  return { originalInvoiceNumber: snapshot.originalInvoiceNumber };
}

export async function assertPurchaseReturnPolicy(params: {
  companyId: string;
  invoiceKind: string;
  selfInvoiceId?: string | null;
  originalInvoiceId?: string | null;
  lines: CreateM5InvoiceInput['lines'];
}): Promise<{ originalInvoiceNumber: string | null } | null> {
  if (params.invoiceKind !== 'PURCHASE_RETURN') return null;

  const settings = await loadInvoiceTransactionSettings(params.companyId, 'PURCHASE_RETURN');
  const originalId = params.originalInvoiceId?.trim() || null;

  if (settings && settings.allowStandaloneReturns === false && !originalId) {
    throw new AppError(
      400,
      'غير مسموح بإنشاء مردود مشتريات حر دون الارتباط بفاتورة مشتريات أصلية مسبقة طبقاً لسياسة الشركة'
    );
  }

  if (!originalId) return { originalInvoiceNumber: null };

  const snapshot = await listReturnableLines(
    params.companyId,
    originalId,
    params.selfInvoiceId,
    'PURCHASE'
  );
  const byOriginal = new Map(snapshot.lines.map((l) => [l.originalInvoiceLineId, l]));

  const requestedByOriginal = new Map<string, { qty: number; price: number }>();
  for (const line of params.lines) {
    if (!line.originalInvoiceLineId) {
      if (settings && settings.allowStandaloneReturns === false) {
        throw new AppError(
          400,
          'كل بنود المردود يجب أن ترتبط بسطر من فاتورة المشتريات الأصلية طبقاً لسياسة الشركة'
        );
      }
      continue;
    }
    const prev = requestedByOriginal.get(line.originalInvoiceLineId);
    requestedByOriginal.set(line.originalInvoiceLineId, {
      qty: (prev?.qty ?? 0) + Number(line.baseQuantity ?? line.quantity),
      price: Number(line.price),
    });
  }

  for (const [originalLineId, req] of requestedByOriginal) {
    const origin = byOriginal.get(originalLineId);
    if (!origin) {
      throw new AppError(400, 'سطر المردود لا ينتمي لفاتورة المشتريات الأصلية المحددة');
    }
    if (roundTo4(req.qty) > roundTo4(origin.returnableQty) + QTY_EPS) {
      throw new AppError(
        400,
        `لا يمكن إرجاع كمية [${req.qty}] من الصنف [${origin.itemName}]. أقصى كمية متبقية قابلة للإرجاع هي [${origin.returnableQty}]`
      );
    }
    if (settings?.enforceOriginalPrice === true && Math.abs(req.price - origin.unitPrice) > PRICE_EPS) {
      throw new AppError(
        400,
        `سعر إرجاع الصنف «${origin.itemName}» يجب أن يساوي سعر الشراء الأصلي ([${origin.unitPrice}])`
      );
    }
  }

  return { originalInvoiceNumber: snapshot.originalInvoiceNumber };
}
