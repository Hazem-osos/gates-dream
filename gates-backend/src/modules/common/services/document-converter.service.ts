import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { priceQuoteService } from '../../inventory/services/price-quote.service';
import { purchaseOrderService } from '../../inventory/services/purchase-order.service';
import { invoiceM5Service } from '../../invoices/services/invoice-m5.service';
import type { CreateM5InvoiceInput } from '../../invoices/schemas/invoice-m5.schema';
import { documentAuditService } from '../../accounting/services/document-audit.service';

export type DocumentConvertType =
  | 'PRICE_QUOTE_TO_SALE_INVOICE'
  | 'PRICE_QUOTE_TO_SALES_ORDER'
  | 'SALES_ORDER_TO_SALE_INVOICE'
  | 'PURCHASE_ORDER_TO_PURCHASE_INVOICE'
  | 'SALE_INVOICE_TO_ISSUE'
  | 'CLONE_INVOICE';

export class DocumentConverterService {
  async convert(params: {
    companyId: string;
    branchId?: string;
    fiscalYearId?: string;
    userId?: string;
    type: DocumentConvertType;
    sourceId: string;
  }) {
    switch (params.type) {
      case 'PRICE_QUOTE_TO_SALE_INVOICE':
        return {
          targetType: 'INVOICE',
          target: await priceQuoteService.convertToInvoice(params.companyId, params.sourceId),
        };
      case 'PURCHASE_ORDER_TO_PURCHASE_INVOICE':
        return {
          targetType: 'INVOICE',
          target: await purchaseOrderService.convertToInvoice(params.companyId, params.sourceId),
        };
      case 'PRICE_QUOTE_TO_SALES_ORDER':
        return {
          targetType: 'SALES_ORDER',
          target: await this.priceQuoteToSalesOrderDraft(params.companyId, params.sourceId, params.userId),
        };
      case 'SALES_ORDER_TO_SALE_INVOICE':
        return {
          targetType: 'INVOICE',
          target: await this.salesOrderToSaleInvoice(params.companyId, params.sourceId, params.branchId, params.fiscalYearId, params.userId),
        };
      case 'SALE_INVOICE_TO_ISSUE':
        return {
          targetType: 'ISSUE',
          target: await this.saleInvoiceToIssue(params.companyId, params.sourceId, params.userId),
        };
      case 'CLONE_INVOICE':
        return {
          targetType: 'INVOICE',
          target: await this.cloneInvoice(
            params.companyId,
            params.sourceId,
            params.branchId,
            params.fiscalYearId,
            params.userId
          ),
        };
      default:
        throw new AppError(400, 'Unsupported conversion type');
    }
  }

  private async priceQuoteToSalesOrderDraft(companyId: string, priceQuoteId: string, userId?: string) {
    const quote = await prisma.priceQuote.findFirst({
      where: { id: priceQuoteId, companyId, isCancelled: false },
      include: { lines: true, currency: true },
    });
    if (!quote) throw new AppError(404, 'Price quote not found');
    if (quote.isConverted) throw new AppError(422, 'Quote already converted');

    const currencyCode = quote.currency?.code ?? 'EGP';
    const lines = quote.lines.map((l, i) => ({
      itemId: l.itemId,
      unitId: l.unitId,
      quantity: Number(l.quantity),
      baseQuantity: Number(l.baseQuantity),
      price: Number(l.unitPrice),
      discountPercent: l.discountPercentage ? Number(l.discountPercentage) : undefined,
      discountAmount: l.discountValue ? Number(l.discountValue) : undefined,
      taxPercent: l.taxPercentage ? Number(l.taxPercentage) : undefined,
      taxAmount: l.taxValue ? Number(l.taxValue) : undefined,
      lineOrder: i + 1,
    }));

    const inv = await invoiceM5Service.create(
      companyId,
      quote.branchId ?? undefined,
      undefined,
      {
        invoiceKind: 'SALE',
        date: new Date(),
        currencyCode,
        customerId: quote.customerId,
        warehouseId: quote.warehouseId ?? undefined,
        costCenterId: quote.costCenterId ?? undefined,
        representativeId: quote.delegateId ?? undefined,
        paymentMethod: quote.paymentMethod ?? undefined,
        description: `[أمر بيع] من عرض سعر ${quote.quoteNumber ?? quote.id}`,
        lines,
      } as CreateM5InvoiceInput,
      userId
    );

    // Wave 3 fix: this never marked the quote as consumed, so the same
    // quote could be converted into an unlimited number of sales-order
    // drafts. Mirrors `priceQuoteService.convertToInvoice`'s bookkeeping.
    await prisma.priceQuote.update({
      where: { id: quote.id },
      data: { isConverted: true, convertedAt: new Date(), invoiceId: inv!.id },
    });

    await documentAuditService.record({
      companyId,
      entityType: 'INVOICE',
      entityId: inv!.id,
      action: 'CREATED',
      userId: userId ?? 'system',
      metadata: { fromType: 'PRICE_QUOTE', fromId: priceQuoteId, workflow: 'SALES_ORDER' },
      message: 'تحويل عرض سعر إلى أمر بيع (مسودة)',
    });

    return inv;
  }

  private async salesOrderToSaleInvoice(
    companyId: string,
    sourceInvoiceId: string,
    branchId?: string,
    fiscalYearId?: string,
    userId?: string
  ) {
    const source = await prisma.invoice.findFirst({
      where: { id: sourceInvoiceId, companyId, invoiceKind: 'SALE', isCancelled: false },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!source) throw new AppError(404, 'Sales order (draft invoice) not found');
    if (source.isPosted) throw new AppError(422, 'Posted invoice cannot be converted; use clone instead');
    // Wave 3 fix: unlike PO→invoice (guarded by `PurchaseOrder.invoiceId`),
    // this had no already-converted guard at all — the same draft could be
    // cloned into an unbounded number of full invoices.
    if (source.convertedInvoiceId) {
      throw new AppError(422, 'Sales order was already converted to an invoice');
    }

    const created = await this.cloneInvoice(companyId, source.id, branchId, fiscalYearId, userId, {
      clearDescriptionPrefix: true,
      description: source.description?.replace(/^\[أمر بيع\]\s*/, '') ?? undefined,
    });

    await prisma.invoice.update({
      where: { id: source.id },
      data: { convertedInvoiceId: created!.id },
    });

    return created;
  }

  private async cloneInvoice(
    companyId: string,
    sourceId: string,
    branchId?: string,
    fiscalYearId?: string,
    userId?: string,
    opts?: { description?: string; clearDescriptionPrefix?: boolean }
  ) {
    const source = await prisma.invoice.findFirst({
      where: { id: sourceId, companyId, isCancelled: false },
      include: {
        lines: { orderBy: { lineOrder: 'asc' } },
        conditions: true,
      },
    });
    if (!source) throw new AppError(404, 'Source document not found');
    if (!source.lines.length) throw new AppError(422, 'Source document has no lines');

    const kind = (source.invoiceKind ?? 'SALE') as CreateM5InvoiceInput['invoiceKind'];
    const lines = source.lines.map((l, i) => ({
      itemId: l.itemId,
      unitId: l.unitId,
      quantity: Number(l.quantity),
      baseQuantity: Number(l.baseQuantity),
      price: Number(l.price),
      discountPercent: l.discountPercent ? Number(l.discountPercent) : undefined,
      discountAmount: l.discountAmount ? Number(l.discountAmount) : undefined,
      taxPercent: l.taxPercent ? Number(l.taxPercent) : undefined,
      taxAmount: l.taxAmount ? Number(l.taxAmount) : undefined,
      lineOrder: i + 1,
    }));

    let description = opts?.description ?? source.description ?? undefined;
    if (opts?.clearDescriptionPrefix && description) {
      description = description.replace(/^\[أمر بيع\]\s*/, '');
    }
    if (!opts?.description) {
      description = `[نسخة] ${description ?? ''}`.trim();
    }

    const created = await invoiceM5Service.create(
      companyId,
      branchId ?? source.branchId ?? undefined,
      fiscalYearId ?? source.fiscalYearId ?? undefined,
      {
        invoiceKind: kind,
        date: new Date(),
        hijriDate: source.hijriDate ?? undefined,
        currencyCode: source.currencyCode,
        exchangeRate: Number(source.exchangeRate),
        customerId: source.customerId ?? undefined,
        supplierId: source.supplierId ?? undefined,
        warehouseId: source.warehouseId ?? undefined,
        costCenterId: source.costCenterId ?? undefined,
        representativeId: source.representativeId ?? undefined,
        paymentMethod: source.paymentMethod ?? undefined,
        isSalesTaxInvoice: source.isSalesTaxInvoice,
        allowReturn: source.allowReturn,
        returnDays: source.returnDays ?? undefined,
        invoiceConditions: source.conditions?.map((c) => c.condition).filter(Boolean),
        description,
        lines,
      } as CreateM5InvoiceInput,
      userId
    );

    await documentAuditService.record({
      companyId,
      entityType: 'INVOICE',
      entityId: created!.id,
      action: 'CREATED',
      userId: userId ?? 'system',
      metadata: { fromId: sourceId, cloned: true },
      message: 'تكرار مستند',
    });

    return created;
  }

  /**
   * Wave 3 fix: a posted SALE invoice with a warehouse ALWAYS already moves
   * stock at posting time (`invoice-posting-orchestrator.ts` posts a stock
   * movement for every line with a non-zero quantity delta). Creating a
   * separate Issue document from the same lines afterward deducted the same
   * quantities a second time. There is no valid case for this conversion —
   * the invoice's own posting already is the stock issue — so it's blocked
   * outright rather than attempting to special-case "already issued".
   */
  private async saleInvoiceToIssue(_companyId: string, _invoiceId: string, _userId?: string): Promise<never> {
    throw new AppError(
      403,
      'Converting a posted sales invoice to a separate issue document is disabled: posting the invoice already deducts stock for its lines, so this would double-deduct inventory.'
    );
  }
}

export const documentConverterService = new DocumentConverterService();
