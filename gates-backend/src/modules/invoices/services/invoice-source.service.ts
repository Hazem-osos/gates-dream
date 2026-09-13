import type { Prisma, SourceDocumentType } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { startOfDayUtc, endOfDayUtc } from '../../../shared/utils/report-date';
import type { SelectableSourceType } from '../schemas/invoice-source.schema';

type Tx = Prisma.TransactionClient;

const SOURCE_NOTE: Record<SelectableSourceType, string> = {
  QUOTATION: 'محول من عرض سعر رقم',
  SALES_ORDER: 'محول من أمر بيع رقم',
  PURCHASE_ORDER: 'محول من أمر شراء رقم',
  PURCHASE_INVOICE: 'محول من فاتورة مشتريات رقم',
  DELIVERY_NOTE: 'محول من إذن تسليم رقم',
};

const SOURCE_LABEL: Record<SelectableSourceType, string> = {
  QUOTATION: 'عرض سعر',
  SALES_ORDER: 'أمر بيع',
  PURCHASE_ORDER: 'أمر شراء',
  PURCHASE_INVOICE: 'فاتورة مشتريات',
  DELIVERY_NOTE: 'إذن تسليم',
};

export type SourceListRow = {
  id: string;
  documentNumber: string;
  partyName: string;
  totalAmount: number;
  createdAt: Date;
};

export type SourceHydrateLine = {
  itemId: string;
  itemName: string;
  quantity: number;
  unitId?: string;
  unitPrice: number;
  taxRate: number;
  withholdingTaxRate: number;
  discount: number;
  costCenterId?: string | null;
};

export type SourceHydratePayload = {
  sourceType: SelectableSourceType;
  sourceId: string;
  sourceNumber: string;
  customerId: string | null;
  supplierId: string | null;
  warehouseId: string | null;
  costCenterId: string | null;
  currencyId: string | null;
  delegateId: string | null;
  paymentMethod: string | null;
  partyName: string;
  lines: SourceHydrateLine[];
  notes: string;
};

function money(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function docNumber(...parts: Array<string | null | undefined>): string {
  for (const part of parts) {
    const trimmed = String(part ?? '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function containsSearch(search?: string) {
  const q = search?.trim();
  return q ? { contains: q } : undefined;
}

export async function linkSourceAfterSave(
  tx: Tx,
  companyId: string,
  invoiceId: string,
  input: {
    sourceType?: SourceDocumentType | string | null;
    sourceId?: string | null;
  }
) {
  const sourceType = String(input.sourceType ?? 'NONE');
  const sourceId = input.sourceId?.trim();
  if (!sourceId || sourceType === 'NONE') return;

  if (sourceType === 'QUOTATION') {
    await tx.priceQuote.updateMany({
      where: { id: sourceId, companyId, isCancelled: false, invoiceId: null },
      data: { invoiceId, isConverted: true, convertedAt: new Date() },
    });
    return;
  }
  if (sourceType === 'PURCHASE_ORDER') {
    await tx.purchaseOrder.updateMany({
      where: { id: sourceId, companyId, isCancelled: false, invoiceId: null },
      data: { invoiceId },
    });
    return;
  }
  if (sourceType === 'SALES_ORDER') {
    await tx.invoice.updateMany({
      where: { id: sourceId, companyId, isCancelled: false, convertedInvoiceId: null },
      data: { convertedInvoiceId: invoiceId },
    });
  }
}

export async function listSourceDocuments(
  companyId: string,
  opts: { type: SelectableSourceType; search?: string; page: number; limit: number }
): Promise<{ items: SourceListRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const skip = (opts.page - 1) * opts.limit;
  const search = containsSearch(opts.search);

  if (opts.type === 'QUOTATION') {
    const where: Prisma.PriceQuoteWhereInput = {
      companyId,
      isCancelled: false,
      isConverted: false,
      ...(search
        ? {
            OR: [
              { quoteNumber: search },
              { serial: search },
              { customer: { arabicName: search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.priceQuote.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          quoteNumber: true,
          serial: true,
          netAmount: true,
          totalAmount: true,
          createdAt: true,
          customer: { select: { arabicName: true } },
        },
      }),
      prisma.priceQuote.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        documentNumber: docNumber(row.quoteNumber, row.serial, row.id.slice(0, 8)),
        partyName: row.customer.arabicName,
        totalAmount: money(row.netAmount ?? row.totalAmount),
        createdAt: row.createdAt,
      })),
      pagination: pageMeta(opts.page, opts.limit, total),
    };
  }

  if (opts.type === 'SALES_ORDER') {
    const where: Prisma.InvoiceWhereInput = {
      companyId,
      invoiceKind: 'SALE',
      isCancelled: false,
      isPosted: false,
      convertedInvoiceId: null,
      ...(search
        ? {
            OR: [
              { invoiceNumber: search },
              { customer: { arabicName: search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          invoiceNumber: true,
          netAmount: true,
          totalAmount: true,
          createdAt: true,
          customer: { select: { arabicName: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        documentNumber: docNumber(row.invoiceNumber, row.id.slice(0, 8)),
        partyName: row.customer?.arabicName ?? '—',
        totalAmount: money(row.netAmount ?? row.totalAmount),
        createdAt: row.createdAt,
      })),
      pagination: pageMeta(opts.page, opts.limit, total),
    };
  }

  if (opts.type === 'PURCHASE_ORDER') {
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId,
      isCancelled: false,
      invoiceId: null,
      ...(search
        ? {
            OR: [
              { orderNumber: search },
              { serial: search },
              { supplier: { arabicName: search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          orderNumber: true,
          serial: true,
          netAmount: true,
          totalAmount: true,
          createdAt: true,
          supplier: { select: { arabicName: true } },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        documentNumber: docNumber(row.orderNumber, row.serial, row.id.slice(0, 8)),
        partyName: row.supplier.arabicName,
        totalAmount: money(row.netAmount ?? row.totalAmount),
        createdAt: row.createdAt,
      })),
      pagination: pageMeta(opts.page, opts.limit, total),
    };
  }

  if (opts.type === 'PURCHASE_INVOICE') {
    const where: Prisma.InvoiceWhereInput = {
      companyId,
      invoiceKind: 'PURCHASE',
      isCancelled: false,
      ...(search
        ? {
            OR: [
              { invoiceNumber: search },
              { supplier: { arabicName: search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          invoiceNumber: true,
          netAmount: true,
          totalAmount: true,
          createdAt: true,
          supplier: { select: { arabicName: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        documentNumber: docNumber(row.invoiceNumber, row.id.slice(0, 8)),
        partyName: row.supplier?.arabicName ?? '—',
        totalAmount: money(row.netAmount ?? row.totalAmount),
        createdAt: row.createdAt,
      })),
      pagination: pageMeta(opts.page, opts.limit, total),
    };
  }

  const where: Prisma.IssueWhereInput = {
    companyId,
    isCancelled: false,
    ...(search
      ? {
          OR: [{ serial: search }, { description: search }],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      skip,
      take: opts.limit,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        serial: true,
        totalAmount: true,
        createdAt: true,
        warehouse: { select: { arabicName: true } },
      },
    }),
    prisma.issue.count({ where }),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      documentNumber: docNumber(row.serial, row.id.slice(0, 8)),
      partyName: row.warehouse?.arabicName ?? '—',
      totalAmount: money(row.totalAmount),
      createdAt: row.createdAt,
    })),
    pagination: pageMeta(opts.page, opts.limit, total),
  };
}

export async function getSourceDocumentForHydration(
  companyId: string,
  type: SelectableSourceType,
  id: string
): Promise<SourceHydratePayload> {
  if (type === 'QUOTATION') {
    const row = await prisma.priceQuote.findFirst({
      where: { id, companyId, isCancelled: false },
      include: {
        customer: { select: { id: true, arabicName: true } },
        lines: {
          include: { item: { select: { arabicName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) throw new AppError(404, 'عرض السعر غير موجود');
    const sourceNumber = docNumber(row.quoteNumber, row.serial, row.id.slice(0, 8));
    return {
      sourceType: type,
      sourceId: row.id,
      sourceNumber,
      customerId: row.customerId,
      supplierId: null,
      warehouseId: row.warehouseId,
      costCenterId: row.costCenterId,
      currencyId: row.currencyId,
      delegateId: row.delegateId,
      paymentMethod: row.paymentMethod,
      partyName: row.customer.arabicName,
      notes: `${SOURCE_NOTE[type]} ${sourceNumber}`,
      lines: row.lines.map((line) => ({
        itemId: line.itemId,
        itemName: line.item.arabicName,
        quantity: money(line.quantity),
        unitId: line.unitId,
        unitPrice: money(line.unitPrice),
        taxRate: money(line.taxPercentage),
        withholdingTaxRate: 0,
        discount: money(line.discountPercentage ?? line.discountValue),
        costCenterId: row.costCenterId,
      })),
    };
  }

  if (type === 'SALES_ORDER' || type === 'PURCHASE_INVOICE') {
    const row = await prisma.invoice.findFirst({
      where: {
        id,
        companyId,
        isCancelled: false,
        invoiceKind: type === 'SALES_ORDER' ? 'SALE' : 'PURCHASE',
      },
      include: {
        customer: { select: { id: true, arabicName: true } },
        supplier: { select: { id: true, arabicName: true } },
        lines: {
          include: { item: { select: { arabicName: true } } },
          orderBy: { lineOrder: 'asc' },
        },
      },
    });
    if (!row) throw new AppError(404, 'المستند غير موجود');
    const sourceNumber = docNumber(row.invoiceNumber, row.id.slice(0, 8));
    return {
      sourceType: type,
      sourceId: row.id,
      sourceNumber,
      customerId: row.customerId,
      supplierId: row.supplierId,
      warehouseId: row.warehouseId,
      costCenterId: row.costCenterId,
      currencyId: row.currencyId,
      delegateId: row.representativeId,
      paymentMethod: row.paymentMethod,
      partyName: row.customer?.arabicName ?? row.supplier?.arabicName ?? '—',
      notes: `${SOURCE_NOTE[type]} ${sourceNumber}`,
      lines: row.lines.map((line) => ({
        itemId: line.itemId,
        itemName: line.item.arabicName,
        quantity: money(line.quantity),
        unitId: line.unitId,
        unitPrice: money(line.price),
        taxRate: money(line.taxPercent),
        withholdingTaxRate: money(line.withholdingTaxRate),
        discount: money(line.discountPercent ?? line.discountAmount),
        costCenterId: line.costCenterId ?? row.costCenterId,
      })),
    };
  }

  if (type === 'PURCHASE_ORDER') {
    const row = await prisma.purchaseOrder.findFirst({
      where: { id, companyId, isCancelled: false },
      include: {
        supplier: { select: { id: true, arabicName: true } },
        lines: {
          include: { item: { select: { arabicName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) throw new AppError(404, 'أمر الشراء غير موجود');
    const sourceNumber = docNumber(row.orderNumber, row.serial, row.id.slice(0, 8));
    return {
      sourceType: type,
      sourceId: row.id,
      sourceNumber,
      customerId: null,
      supplierId: row.supplierId,
      warehouseId: row.warehouseId,
      costCenterId: row.costCenterId,
      currencyId: row.currencyId,
      delegateId: null,
      paymentMethod: null,
      partyName: row.supplier.arabicName,
      notes: `${SOURCE_NOTE[type]} ${sourceNumber}`,
      lines: row.lines.map((line) => ({
        itemId: line.itemId,
        itemName: line.item.arabicName,
        quantity: money(line.quantity),
        unitId: line.unitId ?? undefined,
        unitPrice: money(line.unitPrice),
        taxRate: money(line.taxPercentage),
        withholdingTaxRate: 0,
        discount: money(line.discountPercentage ?? line.discountValue),
        costCenterId: row.costCenterId,
      })),
    };
  }

  const row = await prisma.issue.findFirst({
    where: { id, companyId, isCancelled: false },
    include: {
      warehouse: { select: { arabicName: true } },
      lines: {
        include: { item: { select: { arabicName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!row) throw new AppError(404, 'إذن التسليم غير موجود');
  const sourceNumber = docNumber(row.serial, row.id.slice(0, 8));
  return {
    sourceType: type,
    sourceId: row.id,
    sourceNumber,
    customerId: null,
    supplierId: null,
    warehouseId: row.warehouseId,
    costCenterId: null,
    currencyId: null,
    delegateId: null,
    paymentMethod: null,
    partyName: row.warehouse.arabicName,
    notes: `${SOURCE_NOTE[type]} ${sourceNumber}`,
    lines: row.lines.map((line) => ({
      itemId: line.itemId,
      itemName: line.item.arabicName,
      quantity: money(line.quantity),
      unitPrice: money(line.unitPrice),
      taxRate: 0,
      withholdingTaxRate: 0,
      discount: 0,
      costCenterId: null,
    })),
  };
}

export type AnalyticalMovementRow = {
  id: string;
  sourceType: SelectableSourceType;
  sourceTypeLabel: string;
  sourceId: string | null;
  sourceNumber: string;
  sourceDate: string | null;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  invoiceKind: string | null;
  partyName: string;
  sourceTotal: number;
  invoiceTotal: number;
  delta: number;
  changePercent: number;
  turnaroundDays: number | null;
  status: 'كامل' | 'جزئي' | 'ملغي';
  operatorName: string;
  invoicePreviewPath: string;
  sourcePreviewPath: string | null;
};

export async function getAnalyticalInvoiceMovement(
  companyId: string,
  opts: {
    fromDate?: string;
    toDate?: string;
    sourceType?: SelectableSourceType;
    partyId?: string;
    status?: 'كامل' | 'جزئي' | 'ملغي';
    search?: string;
    page: number;
    limit: number;
  }
) {
  const dateFilter: Prisma.DateTimeFilter = {};
  if (opts.fromDate) dateFilter.gte = startOfDayUtc(opts.fromDate, 'fromDate');
  if (opts.toDate) dateFilter.lte = endOfDayUtc(opts.toDate, 'toDate');

  const where: Prisma.InvoiceWhereInput = {
    companyId,
    ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
    ...(opts.partyId
      ? { OR: [{ customerId: opts.partyId }, { supplierId: opts.partyId }] }
      : {}),
    OR: [
      { sourceType: { not: 'NONE' } },
      { priceQuote: { isNot: null } },
      { purchaseOrder: { isNot: null } },
      { convertedFromInvoice: { isNot: null } },
    ],
  };

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 500,
    include: {
      customer: { select: { arabicName: true } },
      supplier: { select: { arabicName: true } },
      priceQuote: {
        select: {
          id: true,
          quoteNumber: true,
          serial: true,
          date: true,
          netAmount: true,
          totalAmount: true,
          isCancelled: true,
        },
      },
      purchaseOrder: {
        select: {
          id: true,
          orderNumber: true,
          serial: true,
          date: true,
          netAmount: true,
          totalAmount: true,
          isCancelled: true,
        },
      },
      convertedFromInvoice: {
        select: {
          id: true,
          invoiceNumber: true,
          date: true,
          netAmount: true,
          totalAmount: true,
          isCancelled: true,
        },
      },
    },
  });

  const userIds = [...new Set(invoices.map((inv) => inv.createdBy).filter(Boolean))] as string[];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, username: true },
      })
    : [];
  const userName = new Map(
    users.map((u) => [
      u.id,
      [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username,
    ])
  );

  const mapped = invoices
    .map((inv): AnalyticalMovementRow | null => {
      const inferred = inferSource(inv);
      if (!inferred) return null;
      if (opts.sourceType && inferred.sourceType !== opts.sourceType) return null;

      const invoiceTotal = money(inv.netAmount ?? inv.totalAmount);
      const sourceTotal = inferred.sourceTotal;
      const delta = invoiceTotal - sourceTotal;
      const changePercent = sourceTotal > 0 ? (delta / sourceTotal) * 100 : 0;
      const status = conversionStatus(inv.isCancelled, inferred.sourceCancelled, invoiceTotal, sourceTotal);
      const search = opts.search?.trim();
      if (search) {
        const hay = `${inferred.sourceNumber} ${inv.invoiceNumber ?? ''} ${inferred.partyName}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return null;
      }
      if (opts.status && status !== opts.status) return null;

      return {
        id: inv.id,
        sourceType: inferred.sourceType,
        sourceTypeLabel: SOURCE_LABEL[inferred.sourceType],
        sourceId: inferred.sourceId,
        sourceNumber: inferred.sourceNumber,
        sourceDate: inferred.sourceDate,
        invoiceId: inv.id,
        invoiceNumber: docNumber(inv.invoiceNumber, inv.id.slice(0, 8)),
        invoiceDate: inv.date.toISOString(),
        invoiceKind: inv.invoiceKind,
        partyName: inferred.partyName,
        sourceTotal,
        invoiceTotal,
        delta,
        changePercent,
        turnaroundDays: inferred.sourceDate
          ? Math.max(
              0,
              Math.round(
                (inv.date.getTime() - new Date(inferred.sourceDate).getTime()) / 86_400_000
              )
            )
          : null,
        status,
        operatorName: (inv.createdBy && userName.get(inv.createdBy)) || '—',
        invoicePreviewPath:
          inv.invoiceKind === 'PURCHASE' || inv.invoiceKind === 'PURCHASE_RETURN'
            ? `/inventory/operations/final-purchase-invoice?invoiceId=${inv.id}`
            : `/inventory/operations/sales-invoice?invoiceId=${inv.id}`,
        sourcePreviewPath: inferred.sourcePreviewPath,
      };
    })
    .filter((row): row is AnalyticalMovementRow => row != null);

  const convertedCount = mapped.filter((row) => row.status !== 'ملغي').length;
  const invoicedTotal = mapped.reduce((sum, row) => sum + row.invoiceTotal, 0);
  const openSources = await countOpenSources(companyId, dateFilter, opts.sourceType);
  const conversionRate =
    convertedCount + openSources > 0
      ? (convertedCount / (convertedCount + openSources)) * 100
      : mapped.length
        ? 100
        : 0;

  const start = (opts.page - 1) * opts.limit;
  const pageRows = mapped.slice(start, start + opts.limit);

  return {
    rows: pageRows,
    summary: {
      convertedCount,
      invoicedTotal,
      openSourceCount: openSources,
      conversionRate,
    },
    pagination: pageMeta(opts.page, opts.limit, mapped.length),
  };
}

function inferSource(inv: {
  sourceType: SourceDocumentType;
  sourceId: string | null;
  sourceNumber: string | null;
  customer: { arabicName: string } | null;
  supplier: { arabicName: string } | null;
  priceQuote: {
    id: string;
    quoteNumber: string | null;
    serial: string | null;
    date: Date;
    netAmount: unknown;
    totalAmount: unknown;
    isCancelled: boolean;
  } | null;
  purchaseOrder: {
    id: string;
    orderNumber: string | null;
    serial: string | null;
    date: Date;
    netAmount: unknown;
    totalAmount: unknown;
    isCancelled: boolean;
  } | null;
  convertedFromInvoice: {
    id: string;
    invoiceNumber: string | null;
    date: Date;
    netAmount: unknown;
    totalAmount: unknown;
    isCancelled: boolean;
  } | null;
}): {
  sourceType: SelectableSourceType;
  sourceId: string | null;
  sourceNumber: string;
  sourceDate: string | null;
  sourceTotal: number;
  sourceCancelled: boolean;
  partyName: string;
  sourcePreviewPath: string | null;
} | null {
  const partyName = inv.customer?.arabicName ?? inv.supplier?.arabicName ?? '—';

  if (inv.sourceType !== 'NONE' && inv.sourceType !== undefined) {
    const type = inv.sourceType as SelectableSourceType;
    const quote = inv.priceQuote;
    const po = inv.purchaseOrder;
    const so = inv.convertedFromInvoice;
    const fallbackDate = quote?.date ?? po?.date ?? so?.date ?? null;
    const fallbackTotal = quote
      ? money(quote.netAmount ?? quote.totalAmount)
      : po
        ? money(po.netAmount ?? po.totalAmount)
        : so
          ? money(so.netAmount ?? so.totalAmount)
          : 0;
    return {
      sourceType: type,
      sourceId: inv.sourceId,
      sourceNumber: docNumber(inv.sourceNumber, quote?.quoteNumber, po?.orderNumber, so?.invoiceNumber),
      sourceDate: fallbackDate ? fallbackDate.toISOString() : null,
      sourceTotal: fallbackTotal,
      sourceCancelled: Boolean(quote?.isCancelled || po?.isCancelled || so?.isCancelled),
      partyName,
      sourcePreviewPath: sourcePath(type, inv.sourceId),
    };
  }

  if (inv.priceQuote) {
    const q = inv.priceQuote;
    return {
      sourceType: 'QUOTATION',
      sourceId: q.id,
      sourceNumber: docNumber(q.quoteNumber, q.serial, q.id.slice(0, 8)),
      sourceDate: q.date.toISOString(),
      sourceTotal: money(q.netAmount ?? q.totalAmount),
      sourceCancelled: q.isCancelled,
      partyName,
      sourcePreviewPath: `/inventory/operations/price-quote?quoteId=${q.id}`,
    };
  }
  if (inv.purchaseOrder) {
    const po = inv.purchaseOrder;
    return {
      sourceType: 'PURCHASE_ORDER',
      sourceId: po.id,
      sourceNumber: docNumber(po.orderNumber, po.serial, po.id.slice(0, 8)),
      sourceDate: po.date.toISOString(),
      sourceTotal: money(po.netAmount ?? po.totalAmount),
      sourceCancelled: po.isCancelled,
      partyName,
      sourcePreviewPath: `/inventory/operations/purchase-order?orderId=${po.id}`,
    };
  }
  if (inv.convertedFromInvoice) {
    const so = inv.convertedFromInvoice;
    return {
      sourceType: 'SALES_ORDER',
      sourceId: so.id,
      sourceNumber: docNumber(so.invoiceNumber, so.id.slice(0, 8)),
      sourceDate: so.date.toISOString(),
      sourceTotal: money(so.netAmount ?? so.totalAmount),
      sourceCancelled: so.isCancelled,
      partyName,
      sourcePreviewPath: `/inventory/operations/sales-invoice?invoiceId=${so.id}`,
    };
  }
  return null;
}

function sourcePath(type: SelectableSourceType, id: string | null): string | null {
  if (!id) return null;
  if (type === 'QUOTATION') return `/inventory/operations/price-quote?quoteId=${id}`;
  if (type === 'PURCHASE_ORDER') return `/inventory/operations/purchase-order?orderId=${id}`;
  if (type === 'PURCHASE_INVOICE') return `/inventory/operations/final-purchase-invoice?invoiceId=${id}`;
  if (type === 'SALES_ORDER') return `/inventory/operations/sales-invoice?invoiceId=${id}`;
  return `/inventory/operations/issue?id=${id}`;
}

function conversionStatus(
  invoiceCancelled: boolean,
  sourceCancelled: boolean,
  invoiceTotal: number,
  sourceTotal: number
): 'كامل' | 'جزئي' | 'ملغي' {
  if (invoiceCancelled || sourceCancelled) return 'ملغي';
  if (sourceTotal <= 0) return 'كامل';
  if (invoiceTotal + 0.01 >= sourceTotal) return 'كامل';
  return 'جزئي';
}

async function countOpenSources(
  companyId: string,
  dateFilter: Prisma.DateTimeFilter,
  sourceType?: SelectableSourceType
) {
  const hasDate = Object.keys(dateFilter).length > 0;
  const dateWhere = hasDate ? { date: dateFilter } : {};
  const tasks: Array<Promise<number>> = [];
  if (!sourceType || sourceType === 'QUOTATION') {
    tasks.push(
      prisma.priceQuote.count({
        where: { companyId, isCancelled: false, isConverted: false, ...dateWhere },
      })
    );
  }
  if (!sourceType || sourceType === 'SALES_ORDER') {
    tasks.push(
      prisma.invoice.count({
        where: {
          companyId,
          invoiceKind: 'SALE',
          isCancelled: false,
          isPosted: false,
          convertedInvoiceId: null,
          ...dateWhere,
        },
      })
    );
  }
  if (!sourceType || sourceType === 'PURCHASE_ORDER') {
    tasks.push(
      prisma.purchaseOrder.count({
        where: { companyId, isCancelled: false, invoiceId: null, ...dateWhere },
      })
    );
  }
  const counts = await Promise.all(tasks);
  return counts.reduce((sum, n) => sum + n, 0);
}

function pageMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export const invoiceSourceService = {
  listSourceDocuments,
  getSourceDocumentForHydration,
  getAnalyticalInvoiceMovement,
  linkSourceAfterSave,
};
