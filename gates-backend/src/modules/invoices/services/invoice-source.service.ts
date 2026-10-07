import type { Prisma, SourceDocumentType } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { startOfDayUtc, endOfDayUtc } from '../../../shared/utils/report-date';
import type { SelectableSourceType } from '../schemas/invoice-source.schema';
import {
  buildAnalyticalInvoiceMovement,
  type AnalyticalLineDraft,
  type AnalyticalSourceType,
} from './analytical-invoice-movement';

type Tx = Prisma.TransactionClient;

const SOURCE_NOTE: Record<SelectableSourceType, string> = {
  QUOTATION: 'محول من عرض سعر رقم',
  SALES_ORDER: 'محول من أمر بيع رقم',
  PURCHASE_ORDER: 'محول من أمر شراء رقم',
  PURCHASE_INVOICE: 'محول من فاتورة مشتريات رقم',
  DELIVERY_NOTE: 'محول من إذن تسليم رقم',
  GOODS_RECEIPT: 'محول من إذن إضافة رقم',
  SALES_INVOICE: 'محول من فاتورة مبيعات رقم',
};

const SOURCE_LABEL: Record<SelectableSourceType, string> = {
  QUOTATION: 'عرض سعر',
  SALES_ORDER: 'أمر بيع',
  PURCHASE_ORDER: 'أمر شراء',
  PURCHASE_INVOICE: 'فاتورة مشتريات',
  DELIVERY_NOTE: 'إذن تسليم',
  GOODS_RECEIPT: 'إذن إضافة',
  SALES_INVOICE: 'فاتورة مبيعات',
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

  if (opts.type === 'SALES_INVOICE') {
    const where: Prisma.InvoiceWhereInput = {
      companyId,
      invoiceKind: 'SALE',
      isCancelled: false,
      isPosted: true,
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

  if (opts.type === 'GOODS_RECEIPT') {
    const where: Prisma.ReceiptWhereInput = {
      companyId,
      isCancelled: false,
      ...(search
        ? {
            OR: [{ serial: search }, { description: search }],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.receipt.findMany({
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
          supplier: { select: { arabicName: true } },
        },
      }),
      prisma.receipt.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        documentNumber: docNumber(row.serial, row.id.slice(0, 8)),
        partyName: row.supplier?.arabicName ?? row.warehouse?.arabicName ?? '—',
        totalAmount: money(row.totalAmount),
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

  if (type === 'SALES_ORDER' || type === 'PURCHASE_INVOICE' || type === 'SALES_INVOICE') {
    const invoiceKind =
      type === 'PURCHASE_INVOICE' ? 'PURCHASE' : 'SALE';
    const row = await prisma.invoice.findFirst({
      where: {
        id,
        companyId,
        isCancelled: false,
        invoiceKind,
        ...(type === 'SALES_INVOICE' ? { isPosted: true } : {}),
        ...(type === 'SALES_ORDER' ? { isPosted: false, convertedInvoiceId: null } : {}),
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

  if (type === 'GOODS_RECEIPT') {
    const row = await prisma.receipt.findFirst({
      where: { id, companyId, isCancelled: false },
      include: {
        warehouse: { select: { arabicName: true } },
        supplier: { select: { id: true, arabicName: true } },
        lines: {
          include: { item: { select: { arabicName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) throw new AppError(404, 'إذن الإضافة غير موجود');
    const sourceNumber = docNumber(row.serial, row.id.slice(0, 8));
    return {
      sourceType: type,
      sourceId: row.id,
      sourceNumber,
      customerId: null,
      supplierId: row.supplierId,
      warehouseId: row.warehouseId,
      costCenterId: null,
      currencyId: null,
      delegateId: null,
      paymentMethod: null,
      partyName: row.supplier?.arabicName ?? row.warehouse.arabicName,
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

const LINE_CAP = 2000;

type HeaderInvoice = {
  id: string;
  invoiceNumber: string | null;
  isCancelled: boolean;
  invoiceKind: string | null;
};

type IssuedHit = {
  baseQty: number;
  invoices: HeaderInvoice[];
};

function invoicePreviewPath(kind: string | null | undefined, id: string): string {
  if (kind === 'PURCHASE' || kind === 'PURCHASE_RETURN') {
    return `/inventory/operations/final-purchase-invoice?invoiceId=${id}`;
  }
  return `/inventory/operations/sales-invoice?invoiceId=${id}`;
}

function joinInvoices(invoices: HeaderInvoice[]): { number: string; id: string | null; path: string | null } {
  const seen = new Set<string>();
  const numbers: string[] = [];
  let first: HeaderInvoice | null = null;
  for (const invoice of invoices) {
    if (!first) first = invoice;
    if (seen.has(invoice.id)) continue;
    seen.add(invoice.id);
    const number = docNumber(invoice.invoiceNumber);
    if (number) numbers.push(number);
  }
  return {
    number: numbers.join('، '),
    id: first?.id ?? null,
    path: first ? invoicePreviewPath(first.invoiceKind, first.id) : null,
  };
}

async function loadIssuedByLine(companyId: string, lineIds: string[]): Promise<Map<string, IssuedHit>> {
  const map = new Map<string, IssuedHit>();
  for (let offset = 0; offset < lineIds.length; offset += 500) {
    const slice = lineIds.slice(offset, offset + 500);
    const rows = await prisma.invoiceLineSource.findMany({
      where: { companyId, sourceLineId: { in: slice } },
      select: {
        sourceLineId: true,
        baseQuantity: true,
        invoiceLine: {
          select: {
            invoice: {
              select: { id: true, invoiceNumber: true, isCancelled: true, invoiceKind: true },
            },
          },
        },
      },
    });
    for (const row of rows) {
      const invoice = row.invoiceLine.invoice;
      if (invoice.isCancelled) continue;
      const current = map.get(row.sourceLineId) ?? { baseQty: 0, invoices: [] };
      current.baseQty += money(row.baseQuantity);
      current.invoices.push(invoice);
      map.set(row.sourceLineId, current);
    }
  }
  return map;
}

function lineIssued(
  lineId: string,
  issued: Map<string, IssuedHit>,
  header: HeaderInvoice | null
): { baseQty: number; headerConverted: boolean; invoiceNumber: string; invoiceId: string | null; invoicePreviewPath: string | null } {
  const hit = issued.get(lineId);
  if (hit && hit.baseQty > 0) {
    const linked = joinInvoices(hit.invoices);
    return {
      baseQty: hit.baseQty,
      headerConverted: false,
      invoiceNumber: linked.number,
      invoiceId: linked.id,
      invoicePreviewPath: linked.path,
    };
  }
  if (header && !header.isCancelled) {
    const linked = joinInvoices([header]);
    return {
      baseQty: 0,
      headerConverted: true,
      invoiceNumber: linked.number,
      invoiceId: linked.id,
      invoicePreviewPath: linked.path,
    };
  }
  return { baseQty: 0, headerConverted: false, invoiceNumber: '', invoiceId: null, invoicePreviewPath: null };
}

export async function getAnalyticalInvoiceMovement(
  companyId: string,
  opts: {
    fromDate?: string;
    toDate?: string;
    sourceType?: SelectableSourceType;
    profileId?: string;
    partyId?: string;
    status?: 'كامل' | 'مكتمل' | 'جزئي' | 'مفتوح' | 'ملغي';
    search?: string;
    page: number;
    limit: number;
  }
) {
  const dateFilter: Prisma.DateTimeFilter = {};
  if (opts.fromDate) dateFilter.gte = startOfDayUtc(opts.fromDate, 'fromDate');
  if (opts.toDate) dateFilter.lte = endOfDayUtc(opts.toDate, 'toDate');
  const dated = Object.keys(dateFilter).length ? { date: dateFilter } : {};
  const partyId = opts.partyId;
  const profileOnly = Boolean(opts.profileId);
  const wants = (type: AnalyticalSourceType) =>
    !profileOnly && (opts.sourceType ? opts.sourceType === type : type !== 'PURCHASE_INVOICE');

  const quotes = wants('QUOTATION')
    ? await prisma.priceQuote.findMany({
        where: { companyId, ...dated, ...(partyId ? { customerId: partyId } : {}) },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: LINE_CAP,
        include: {
          customer: { select: { arabicName: true } },
          invoice: { select: { id: true, invoiceNumber: true, isCancelled: true, invoiceKind: true } },
          lines: {
            include: {
              item: { select: { arabicName: true } },
              unit: { select: { arabicName: true } },
            },
          },
        },
      })
    : [];

  const purchaseOrders = wants('PURCHASE_ORDER')
    ? await prisma.purchaseOrder.findMany({
        where: { companyId, ...dated, ...(partyId ? { supplierId: partyId } : {}) },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: LINE_CAP,
        include: {
          supplier: { select: { arabicName: true } },
          invoice: { select: { id: true, invoiceNumber: true, isCancelled: true, invoiceKind: true } },
          lines: {
            include: {
              item: { select: { arabicName: true } },
              unit: { select: { arabicName: true } },
            },
          },
        },
      })
    : [];

  const salesOrders = wants('SALES_ORDER')
    ? await prisma.invoice.findMany({
        where: {
          companyId,
          ...dated,
          AND: [
            { OR: [{ invoiceKind: 'SALES_ORDER' }, { invoiceKind: 'SALE', isPosted: false }] },
            partyId ? { OR: [{ customerId: partyId }, { supplierId: partyId }] } : {},
          ],
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: LINE_CAP,
        include: {
          customer: { select: { arabicName: true } },
          supplier: { select: { arabicName: true } },
          convertedInvoice: {
            select: { id: true, invoiceNumber: true, isCancelled: true, invoiceKind: true },
          },
          lines: {
            orderBy: { lineOrder: 'asc' },
            include: {
              item: { select: { arabicName: true } },
              unit: { select: { arabicName: true } },
            },
          },
        },
      })
    : [];

  const issues = wants('DELIVERY_NOTE') && !partyId
    ? await prisma.issue.findMany({
        where: { companyId, ...dated },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: LINE_CAP,
        include: {
          warehouse: { select: { arabicName: true } },
          lines: { include: { item: { select: { arabicName: true } } } },
        },
      })
    : [];

  const purchaseInvoices = wants('PURCHASE_INVOICE')
    ? await prisma.invoice.findMany({
        where: {
          companyId,
          invoiceKind: 'PURCHASE',
          ...dated,
          ...(partyId ? { supplierId: partyId } : {}),
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: LINE_CAP,
        include: {
          supplier: { select: { arabicName: true } },
          lines: {
            orderBy: { lineOrder: 'asc' },
            include: {
              item: { select: { arabicName: true } },
              unit: { select: { arabicName: true } },
            },
          },
        },
      })
    : [];

  const sourceLineIds = [
    ...quotes.flatMap((row) => row.lines.map((line) => line.id)),
    ...purchaseOrders.flatMap((row) => row.lines.map((line) => line.id)),
    ...salesOrders.flatMap((row) => row.lines.map((line) => line.id)),
  ];
  const issued = await loadIssuedByLine(companyId, sourceLineIds);

  const purchaseChildren = purchaseInvoices.length
    ? await prisma.invoice.findMany({
        where: {
          companyId,
          sourceType: 'PURCHASE_INVOICE',
          sourceId: { in: purchaseInvoices.map((row) => row.id) },
          isCancelled: false,
        },
        select: {
          id: true,
          sourceId: true,
          invoiceNumber: true,
          invoiceKind: true,
          lines: { select: { itemId: true, quantity: true } },
        },
      })
    : [];
  const purchasePool = new Map<string, Map<string, { qty: number; invoices: HeaderInvoice[] }>>();
  for (const child of purchaseChildren) {
    if (!child.sourceId) continue;
    const pool = purchasePool.get(child.sourceId) ?? new Map();
    const header: HeaderInvoice = {
      id: child.id,
      invoiceNumber: child.invoiceNumber,
      isCancelled: false,
      invoiceKind: child.invoiceKind,
    };
    for (const line of child.lines) {
      const bucket = pool.get(line.itemId) ?? { qty: 0, invoices: [] };
      bucket.qty += money(line.quantity);
      bucket.invoices.push(header);
      pool.set(line.itemId, bucket);
    }
    purchasePool.set(child.sourceId, pool);
  }

  const drafts: AnalyticalLineDraft[] = [];

  for (const quote of quotes) {
    const number = docNumber(quote.quoteNumber, quote.serial, quote.id.slice(0, 8));
    for (const line of quote.lines) {
      const linked = lineIssued(line.id, issued, quote.invoice);
      const orderedQty = money(line.quantity);
      drafts.push({
        id: line.id,
        sourceType: 'QUOTATION',
        sourceTypeLabel: SOURCE_LABEL.QUOTATION,
        sourceNumber: number,
        sourceDate: quote.date.toISOString(),
        partyName: quote.customer.arabicName,
        itemName: line.item.arabicName,
        unitName: line.unit.arabicName,
        orderedQty,
        orderedBaseQty: money(line.baseQuantity) || orderedQty,
        unitPrice: money(line.unitPrice),
        orderedTotal: money(line.total) || orderedQty * money(line.unitPrice),
        issuedBaseQty: linked.baseQty,
        headerConverted: linked.headerConverted,
        invoiceNumber: linked.invoiceNumber,
        invoiceId: linked.invoiceId,
        cancelled: quote.isCancelled,
        sourcePreviewPath: `/inventory/operations/price-quote?quoteId=${quote.id}`,
        invoicePreviewPath: linked.invoicePreviewPath,
      });
    }
  }

  for (const order of purchaseOrders) {
    const number = docNumber(order.orderNumber, order.serial, order.id.slice(0, 8));
    for (const line of order.lines) {
      const linked = lineIssued(line.id, issued, order.invoice);
      const orderedQty = money(line.quantity);
      drafts.push({
        id: line.id,
        sourceType: 'PURCHASE_ORDER',
        sourceTypeLabel: SOURCE_LABEL.PURCHASE_ORDER,
        sourceNumber: number,
        sourceDate: order.date.toISOString(),
        partyName: order.supplier.arabicName,
        itemName: line.item.arabicName,
        unitName: line.unit?.arabicName || '—',
        orderedQty,
        orderedBaseQty: money(line.baseQuantity) || orderedQty,
        unitPrice: money(line.unitPrice),
        orderedTotal: money(line.total) || orderedQty * money(line.unitPrice),
        issuedBaseQty: linked.baseQty,
        headerConverted: linked.headerConverted,
        invoiceNumber: linked.invoiceNumber,
        invoiceId: linked.invoiceId,
        cancelled: order.isCancelled,
        sourcePreviewPath: `/inventory/operations/purchase-order?orderId=${order.id}`,
        invoicePreviewPath: linked.invoicePreviewPath,
      });
    }
  }

  for (const order of salesOrders) {
    const number = docNumber(order.invoiceNumber, order.id.slice(0, 8));
    for (const line of order.lines) {
      const linked = lineIssued(line.id, issued, order.convertedInvoice);
      const orderedQty = money(line.quantity);
      drafts.push({
        id: line.id,
        sourceType: 'SALES_ORDER',
        sourceTypeLabel: SOURCE_LABEL.SALES_ORDER,
        sourceNumber: number,
        sourceDate: order.date.toISOString(),
        partyName: order.customer?.arabicName ?? order.supplier?.arabicName ?? '—',
        itemName: line.item.arabicName,
        unitName: line.unit.arabicName,
        orderedQty,
        orderedBaseQty: money(line.baseQuantity) || orderedQty,
        unitPrice: money(line.price),
        orderedTotal: money(line.total) || orderedQty * money(line.price),
        issuedBaseQty: linked.baseQty,
        headerConverted: linked.headerConverted,
        invoiceNumber: linked.invoiceNumber,
        invoiceId: linked.invoiceId,
        cancelled: order.isCancelled,
        sourcePreviewPath: `/inventory/operations/sales-invoice?invoiceId=${order.id}`,
        invoicePreviewPath: linked.invoicePreviewPath,
      });
    }
  }

  for (const issue of issues) {
    const number = docNumber(issue.serial, issue.id.slice(0, 8));
    for (const line of issue.lines) {
      const orderedQty = money(line.quantity);
      drafts.push({
        id: line.id,
        sourceType: 'DELIVERY_NOTE',
        sourceTypeLabel: 'إذن صرف مخزني',
        sourceNumber: number,
        sourceDate: issue.date.toISOString(),
        partyName: issue.warehouse.arabicName,
        itemName: line.item.arabicName,
        unitName: '—',
        orderedQty,
        orderedBaseQty: orderedQty,
        unitPrice: money(line.unitPrice),
        orderedTotal: money(line.total) || orderedQty * money(line.unitPrice),
        issuedBaseQty: orderedQty,
        headerConverted: false,
        invoiceNumber: '',
        invoiceId: null,
        cancelled: issue.isCancelled,
        sourcePreviewPath: `/inventory/operations/issue?id=${issue.id}`,
        invoicePreviewPath: null,
      });
    }
  }

  for (const invoice of purchaseInvoices) {
    const number = docNumber(invoice.invoiceNumber, invoice.id.slice(0, 8));
    const pool = purchasePool.get(invoice.id);
    for (const line of invoice.lines) {
      const orderedQty = money(line.quantity);
      const bucket = pool?.get(line.itemId);
      const taken = Math.min(bucket?.qty ?? 0, orderedQty);
      if (bucket) bucket.qty = Math.max(bucket.qty - taken, 0);
      const linked = bucket && taken > 0 ? joinInvoices(bucket.invoices) : { number: '', id: null, path: null };
      drafts.push({
        id: line.id,
        sourceType: 'PURCHASE_INVOICE',
        sourceTypeLabel: SOURCE_LABEL.PURCHASE_INVOICE,
        sourceNumber: number,
        sourceDate: invoice.date.toISOString(),
        partyName: invoice.supplier?.arabicName ?? '—',
        itemName: line.item.arabicName,
        unitName: line.unit.arabicName,
        orderedQty,
        orderedBaseQty: orderedQty,
        unitPrice: money(line.price),
        orderedTotal: money(line.total) || orderedQty * money(line.price),
        issuedBaseQty: taken,
        headerConverted: false,
        invoiceNumber: linked.number,
        invoiceId: linked.id,
        cancelled: invoice.isCancelled,
        sourcePreviewPath: `/inventory/operations/final-purchase-invoice?invoiceId=${invoice.id}`,
        invoicePreviewPath: linked.path,
      });
    }
  }

  if (opts.profileId) {
    const profile = await prisma.documentProfile.findFirst({
      where: { id: opts.profileId, companyId },
      select: { nameAr: true, baseType: true },
    });
    const pushStockLines = (
      docs: Array<{
        id: string;
        serial: string | null;
        date: Date;
        isCancelled: boolean;
        warehouse: { arabicName: string };
        lines: Array<{
          id: string;
          quantity: unknown;
          unitPrice: unknown;
          total: unknown;
          item: { arabicName: string };
        }>;
      }>,
      inbound: boolean,
      label: string
    ) => {
      for (const doc of docs) {
        const number = docNumber(doc.serial, doc.id.slice(0, 8));
        for (const line of doc.lines) {
          const orderedQty = money(line.quantity);
          drafts.push({
            id: line.id,
            sourceType: inbound ? 'PURCHASE_INVOICE' : 'DELIVERY_NOTE',
            sourceTypeLabel: label,
            sourceNumber: number,
            sourceDate: doc.date.toISOString(),
            partyName: doc.warehouse.arabicName,
            itemName: line.item.arabicName,
            unitName: '—',
            orderedQty,
            orderedBaseQty: orderedQty,
            unitPrice: money(line.unitPrice),
            orderedTotal: money(line.total) || orderedQty * money(line.unitPrice),
            issuedBaseQty: orderedQty,
            headerConverted: false,
            invoiceNumber: '',
            invoiceId: null,
            cancelled: doc.isCancelled,
            sourcePreviewPath: inbound
              ? `/inventory/operations/receipt?id=${doc.id}`
              : `/inventory/operations/issue?id=${doc.id}`,
            invoicePreviewPath: null,
          });
        }
      }
    };
    if (profile?.baseType === 'STOCK_RECEIPT') {
      const receipts = await prisma.receipt.findMany({
        where: { companyId, ...dated },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: LINE_CAP,
        include: {
          warehouse: { select: { arabicName: true } },
          lines: { include: { item: { select: { arabicName: true } } } },
        },
      });
      pushStockLines(receipts, true, profile.nameAr);
    } else if (profile?.baseType === 'STOCK_ISSUE') {
      const issueDocs = await prisma.issue.findMany({
        where: { companyId, ...dated },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: LINE_CAP,
        include: {
          warehouse: { select: { arabicName: true } },
          lines: { include: { item: { select: { arabicName: true } } } },
        },
      });
      pushStockLines(issueDocs, false, profile.nameAr);
    }
    const purchaseSide = profile?.baseType === 'PURCHASE_INVOICE' || profile?.baseType === 'PURCHASE_RETURN';
    const sourceType: AnalyticalSourceType =
      profile?.baseType === 'SALES_RETURN'
        ? 'SALES_RETURN'
        : profile?.baseType === 'PURCHASE_RETURN'
          ? 'PURCHASE_RETURN'
          : profile?.baseType === 'PURCHASE_INVOICE'
            ? 'PURCHASE_INVOICE'
            : 'SALES_INVOICE';
    const stockProfile = profile?.baseType === 'STOCK_ISSUE' || profile?.baseType === 'STOCK_RECEIPT';
    const profileInvoices = profile && !stockProfile
      ? await prisma.invoice.findMany({
          where: {
            companyId,
            documentProfileId: opts.profileId,
            ...dated,
            ...(partyId ? (purchaseSide ? { supplierId: partyId } : { customerId: partyId }) : {}),
          },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: LINE_CAP,
          include: {
            customer: { select: { arabicName: true } },
            supplier: { select: { arabicName: true } },
            lines: {
              orderBy: { lineOrder: 'asc' },
              include: {
                item: { select: { arabicName: true } },
                unit: { select: { arabicName: true } },
              },
            },
          },
        })
      : [];
    for (const invoice of profileInvoices) {
      const number = docNumber(invoice.invoiceNumber, invoice.id.slice(0, 8));
      const path =
        sourceType === 'SALES_RETURN'
          ? `/inventory/operations/sales-returns?invoiceId=${invoice.id}`
          : sourceType === 'PURCHASE_RETURN'
            ? `/inventory/operations/purchase-returns?invoiceId=${invoice.id}`
            : sourceType === 'PURCHASE_INVOICE'
              ? `/inventory/operations/final-purchase-invoice?invoiceId=${invoice.id}`
              : `/inventory/operations/sales-invoice?invoiceId=${invoice.id}`;
      for (const line of invoice.lines) {
        const orderedQty = money(line.quantity);
        const issuedQty = invoice.isPosted && !invoice.isCancelled ? orderedQty : 0;
        drafts.push({
          id: line.id,
          sourceType,
          sourceTypeLabel: profile?.nameAr || 'فاتورة',
          sourceNumber: number,
          sourceDate: invoice.date.toISOString(),
          partyName: purchaseSide
            ? invoice.supplier?.arabicName ?? '—'
            : invoice.customer?.arabicName ?? '—',
          itemName: line.item.arabicName,
          unitName: line.unit?.arabicName || '—',
          orderedQty,
          orderedBaseQty: money(line.baseQuantity) || orderedQty,
          unitPrice: money(line.price),
          orderedTotal: money(line.total) || orderedQty * money(line.price),
          issuedBaseQty: issuedQty,
          headerConverted: false,
          invoiceNumber: number,
          invoiceId: invoice.id,
          cancelled: invoice.isCancelled,
          sourcePreviewPath: path,
          invoicePreviewPath: path,
        });
      }
    }
  }

  return buildAnalyticalInvoiceMovement(drafts, {
    status: opts.status,
    search: opts.search,
    page: opts.page,
    limit: opts.limit,
  });
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
