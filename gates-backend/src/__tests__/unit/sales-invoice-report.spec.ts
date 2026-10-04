import { Prisma } from '@prisma/client';
import {
  buildSalesInvoiceReportWhere,
  mapSalesInvoiceReportRow,
  querySalesInvoiceReport,
  quotationNumber,
  reportPaymentType,
  type SalesInvoiceReportFilters,
} from '../../modules/inventory/services/sales-invoice-report';

const filters = (patch: Partial<SalesInvoiceReportFilters> = {}): SalesInvoiceReportFilters => ({
  companyId: 'company-1',
  fromDate: new Date('2026-09-01T00:00:00.000Z'),
  toDate: new Date('2026-09-30T23:59:59.999Z'),
  ...patch,
});

function whereText(where: Prisma.InvoiceWhereInput): string {
  return JSON.stringify(where);
}

describe('sales invoice report', () => {
  it('excludes drafts at the query and keeps posted and unposted non-drafts', () => {
    const posted = whereText(buildSalesInvoiceReportWhere(filters()));
    expect(posted).toContain('"workflowStatus":{"not":"DRAFT"}');
    expect(posted).toContain('"isPosted":true');
    expect(posted).toContain('"companyId":"company-1"');
    expect(posted).not.toContain('مسودة');

    const withUnposted = whereText(buildSalesInvoiceReportWhere(filters({ showUnposted: true })));
    expect(withUnposted).toContain('"workflowStatus":{"not":"DRAFT"}');
    expect(withUnposted).not.toContain('"isPosted":true');
  });

  it('filters item group, driver, distributor, and financial presence on the invoice where', () => {
    const where = buildSalesInvoiceReportWhere(
      filters({
        itemId: 'item-1',
        driverId: 'driver-1',
        distributorId: 'dist-1',
        additions: 'yes',
        otherDiscounts: 'no',
        withholdingTax: 'yes',
        salesTax: 'no',
      }),
      { categoryIds: ['group-1', 'group-child'] }
    );
    const text = whereText(where);
    expect(text).toContain('"driverId":"driver-1"');
    expect(text).toContain('"distributorId":"dist-1"');
    expect(text).toContain('"categoryId":{"in":["group-1","group-child"]}');
    expect(text).toContain('"itemId":"item-1"');
    expect(text).toContain('"type":"ADDITION"');
    expect(text).toContain('"none"');
    expect(text).toContain('"withholdingTaxAmount":{"gt":0}');
    expect(text).toContain('"taxAmount":{"lte":0}');
  });

  it('maps posting, settlement, payment method, stored amounts, and the quotation relation', () => {
    const row = mapSalesInvoiceReportRow({
      id: 'inv-1',
      invoiceNumber: 'INV-100',
      isPosted: true,
      paymentStatus: 'PAID',
      paymentMethod: 'credit',
      totalAmount: 100,
      discountAmount: 4,
      taxAmount: 14,
      withholdingTaxAmount: 1,
      netAmount: 10,
      paidAmount: 15,
      remainingAmount: 0,
      sourceType: 'SALES_ORDER',
      sourceNumber: 'SO-9',
      adjustments: [
        { type: 'ADDITION', amount: 3.5 },
        { type: 'DEDUCTION', amount: 2.25 },
      ],
      priceQuote: { quoteNumber: 'Q-44', serial: '1' },
      documentProfile: { nameAr: 'مبيعات جملة' },
    });

    expect(row.documentStatus).toBe('POSTED');
    expect(row.paymentStatus).toBe('PAID');
    expect(row.paymentMethod).toBe('credit');
    expect(reportPaymentType('cash')).toBe('cash');
    expect(row.paidAmount).toBe(15);
    expect(row.remainingAmount).toBe(0);
    expect(row.additionsAmount).toBe(3.5);
    expect(row.otherDiscountsAmount).toBe(2.25);
    expect(row.withholdingTaxAmount).toBe(1);
    expect(row.taxAmount).toBe(14);
    expect(row.discountAmount).toBe(4);
    expect(row.invoicePattern).toBe('مبيعات جملة');
    expect(row.quotationNumber).toBe('Q-44');
    expect(quotationNumber({ sourceType: 'SALES_ORDER', sourceNumber: 'SO-9' })).toBe('');
    expect(quotationNumber({ sourceType: 'QUOTATION', sourceNumber: 'Q-7' })).toBe('Q-7');
  });

  it('derives settlement only when the stored status is missing, and does not infer cash from payment', () => {
    const partial = mapSalesInvoiceReportRow({
      id: 'inv-2',
      isPosted: false,
      paymentMethod: 'cash',
      netAmount: 100,
      paidAmount: 40,
      remainingAmount: 60,
    });
    expect(partial.documentStatus).toBe('UNPOSTED');
    expect(partial.paymentStatus).toBe('PARTIALLY_PAID');
    expect(partial.paymentMethod).toBe('cash');

    const unpaid = mapSalesInvoiceReportRow({
      id: 'inv-3',
      isPosted: true,
      paymentMethod: 'credit',
      netAmount: 80,
      paidAmount: 0,
      remainingAmount: 80,
    });
    expect(unpaid.paymentStatus).toBe('UNPAID');
    expect(unpaid.paymentMethod).toBe('credit');
  });

  it('keeps purchase and return families separate and signs combined net from stored positive amounts', () => {
    const purchase = whereText(buildSalesInvoiceReportWhere(filters({ kind: 'PURCHASE', supplierId: 'sup-1' })));
    expect(purchase).toContain('"invoiceKind":"PURCHASE"');
    expect(purchase).toContain('"supplierId":"sup-1"');
    expect(purchase).toContain('"workflowStatus":{"not":"DRAFT"}');

    const saleReturn = whereText(buildSalesInvoiceReportWhere(filters({ kind: 'SALE_RETURN', showUnposted: true })));
    expect(saleReturn).toContain('SALE_RETURN');
    expect(saleReturn).not.toContain('"isPosted":true');

    const sale = mapSalesInvoiceReportRow({
      id: 's',
      invoiceKind: 'SALE',
      totalAmount: 10000,
      netAmount: 10000,
    });
    const ret = mapSalesInvoiceReportRow({
      id: 'r',
      invoiceKind: 'SALE_RETURN',
      totalAmount: 2000,
      netAmount: 2000,
      originalInvoiceNumber: 'INV-100',
    });
    expect(sale.movementType).toBe('SALE');
    expect(sale.grossAmount).toBe(10000);
    expect(sale.returnAmount).toBe(0);
    expect(sale.signedNet).toBe(10000);
    expect(ret.movementType).toBe('RETURN');
    expect(ret.grossAmount).toBe(0);
    expect(ret.returnAmount).toBe(2000);
    expect(ret.signedNet).toBe(-2000);
    expect(ret.netAmount).toBe(2000);
    expect(ret.originalInvoiceNumber).toBe('INV-100');
  });

  it('aggregates totals with the same where as the page query', async () => {
    const seen: Array<{ op: string; where: unknown }> = [];
    const db = {
      invoice: {
        findMany: jest.fn(async (args: { where: unknown }) => {
          seen.push({ op: 'rows', where: args.where });
          return [
            {
              id: 'inv-1',
              invoiceNumber: 'INV-1',
              isPosted: true,
              paymentStatus: 'UNPAID',
              paymentMethod: 'credit',
              totalAmount: 10,
              netAmount: 10,
              paidAmount: 0,
              remainingAmount: 10,
              taxAmount: 1,
              withholdingTaxAmount: 0,
              discountAmount: 0,
              adjustments: [],
            },
          ];
        }),
        count: jest.fn(async (args: { where: unknown }) => {
          seen.push({ op: 'count', where: args.where });
          return 3;
        }),
        aggregate: jest.fn(async (args: { where: unknown }) => {
          seen.push({ op: 'sums', where: args.where });
          return {
            _sum: {
              totalAmount: 30,
              netAmount: 27,
              paidAmount: 5,
              remainingAmount: 22,
              taxAmount: 3,
              withholdingTaxAmount: 1,
              discountAmount: 2,
            },
          };
        }),
      },
      invoiceAdjustment: {
        aggregate: jest.fn(async (args: { where: { invoice: unknown; type: string } }) => {
          seen.push({ op: args.where.type, where: args.where.invoice });
          return { _sum: { amount: args.where.type === 'ADDITION' ? 4 : 1.5 } };
        }),
      },
      currency: { findFirst: jest.fn(async () => null) },
      itemCategory: { findMany: jest.fn(async () => []) },
    };

    const result = await querySalesInvoiceReport(db as never, filters({ showUnposted: true }), {
      page: 2,
      limit: 500,
    });

    const rowWhere = seen.find((call) => call.op === 'rows')?.where;
    expect(rowWhere).toBeTruthy();
    expect(seen.find((call) => call.op === 'count')?.where).toBe(rowWhere);
    expect(seen.find((call) => call.op === 'sums')?.where).toBe(rowWhere);
    expect(seen.find((call) => call.op === 'ADDITION')?.where).toBe(rowWhere);
    expect(seen.find((call) => call.op === 'DEDUCTION')?.where).toBe(rowWhere);
    expect(result.pagination).toEqual({ page: 2, limit: 100, total: 3, totalPages: 1 });
    expect(result.summary.columnTotals).toEqual({
      totalAmount: 30,
      additionsAmount: 4,
      otherDiscountsAmount: 1.5,
      discountAmount: 2,
      withholdingTaxAmount: 1,
      taxAmount: 3,
      netAmount: 27,
      paidAmount: 5,
      remainingAmount: 22,
    });
    expect(result.data).toHaveLength(1);
    expect(result.summary.totalInvoices).toBe(3);
    expect(result.summary).not.toHaveProperty('totalSales');
    expect(result.summary).not.toHaveProperty('totalReturns');
    expect(result.summary).not.toHaveProperty('netSales');
    expect(result.summary.additionsAmount).toBe(4);
    expect(result.summary.otherDiscountsAmount).toBe(1.5);
  });
});
