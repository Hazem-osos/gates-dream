import { buildEtaReadinessWhere } from '../../modules/electronic-invoices/services/eta-readiness-filters';
import { salesBeforeVat } from '../../modules/electronic-invoices/utils/eta-amounts';

const companyId = 'company-1';

describe('ETA send screen filters', () => {
  it('keeps posted sales invoices and applies the screen filters', () => {
    const where = buildEtaReadinessWhere(companyId, {
      invoiceKind: 'SALE',
      customerId: 'customer-1',
      delegateId: 'delegate-1',
      branchId: 'branch-1',
      warehouseId: 'warehouse-1',
      costCenterId: 'cost-1',
      itemId: 'item-1',
      categoryIds: ['group-1', 'group-2'],
      invoiceNumber: '105',
      profileId: 'pattern-1',
      fromDate: new Date('2026-01-01T00:00:00.000Z'),
      toDate: new Date('2026-01-31T23:59:59.999Z'),
    });

    expect(where).toMatchObject({
      companyId,
      invoiceKind: 'SALE',
      isPosted: true,
      isCancelled: false,
      date: {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lte: new Date('2026-01-31T23:59:59.999Z'),
      },
    });
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { customerId: 'customer-1' },
        { representativeId: 'delegate-1' },
        { branchId: 'branch-1' },
        {
          OR: [
            { documentProfileId: { in: ['pattern-1'] } },
            { newModuleId: { in: ['pattern-1'] } },
          ],
        },
        { invoiceNumber: { contains: '105' } },
        {
          OR: [{ warehouseId: 'warehouse-1' }, { lines: { some: { warehouseId: 'warehouse-1' } } }],
        },
        {
          OR: [{ costCenterId: 'cost-1' }, { lines: { some: { costCenterId: 'cost-1' } } }],
        },
        {
          lines: {
            some: {
              itemId: 'item-1',
              item: { categoryId: { in: ['group-1', 'group-2'] } },
            },
          },
        },
      ])
    );
  });

  it('limits a chosen sales pattern to the patterns enabled for sending', () => {
    const where = buildEtaReadinessWhere(companyId, {
      invoiceKind: 'SALE',
      profileId: 'pattern-2',
      enabledSalesProfileIds: ['pattern-1'],
    });

    expect(where.AND).toEqual(
      expect.arrayContaining([{ id: { in: [] } }])
    );
  });

  it('hides invoices that were already sent from the new-invoice list', () => {
    const where = buildEtaReadinessWhere(companyId, { invoiceKind: 'SALE', mode: 'new' });
    expect(where.NOT).toEqual({
      OR: [
        { taxSubmitted: true },
        { eInvoiceDocuments: { some: { status: { in: ['VALID', 'SUBMITTED'] } } } },
      ],
    });
  });

  it('reports every posted invoice when submission is all, and can filter send date and several patterns', () => {
    const where = buildEtaReadinessWhere(companyId, {
      invoiceKind: 'SALE',
      submission: 'all',
      profileIds: ['builtin:SALES_INVOICE', 'pattern-2'],
      submittedFrom: new Date('2026-02-01T00:00:00.000Z'),
      submittedTo: new Date('2026-02-28T23:59:59.999Z'),
      invoiceIds: ['invoice-1'],
    });

    expect(where.NOT).toBeUndefined();
    expect(where.OR).toBeUndefined();
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { id: { in: ['invoice-1'] } },
        {
          eInvoiceDocuments: {
            some: {
              submittedAt: {
                gte: new Date('2026-02-01T00:00:00.000Z'),
                lte: new Date('2026-02-28T23:59:59.999Z'),
              },
            },
          },
        },
      ])
    );
  });

  it('loads amended invoices that were already submitted', () => {
    const where = buildEtaReadinessWhere(companyId, {
      invoiceKind: 'SALE_RETURN',
      mode: 'amended',
    });

    expect(where.OR).toEqual([
      { taxSubmitted: true },
      { eInvoiceDocuments: { some: { status: { in: ['VALID', 'SUBMITTED'] } } } },
    ]);
    expect(where.AND).toBeUndefined();
  });
});

describe('sales before VAT on the send screen', () => {
  it('uses sales after discount and before VAT, not the payable net', () => {
    expect(
      salesBeforeVat({
        totalAmount: 1000,
        discountAmount: 100,
      })
    ).toBe(900);
  });
});
