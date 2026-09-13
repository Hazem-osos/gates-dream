import { money } from '../../src/modules/subcontracts/utils/money-decimal';
import { quarterBounds, taxForm41ExportService } from '../../src/modules/subcontracts/services/tax-form-41-export.service';
import { TEST_COMPANY_ID } from '../helpers/module-test-factory';

const findMany = jest.fn();

jest.mock('../../src/shared/database/prisma', () => ({
  __esModule: true,
  default: {
    subcontractInvoice: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

describe('Tax Form 41 export', () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it('uses calendar-quarter UTC bounds (Q1 = Jan 1 → Mar 31)', () => {
    const q1 = quarterBounds(2026, 1);
    expect(q1.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(q1.end.toISOString()).toBe('2026-03-31T23:59:59.999Z');

    const q2 = quarterBounds(2026, 2);
    expect(q2.start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(q2.end.toISOString()).toBe('2026-06-30T23:59:59.999Z');

    const q4 = quarterBounds(2026, 4);
    expect(q4.start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(q4.end.toISOString()).toBe('2026-12-31T23:59:59.999Z');
  });

  it('queries only FINANCE_POSTED invoices inside the quarter window', async () => {
    findMany.mockResolvedValue([]);

    await taxForm41ExportService.previewQuarterlyForm41(TEST_COMPANY_ID, { year: 2026, quarter: 1 });

    expect(findMany).toHaveBeenCalledTimes(1);
    const where = findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe(TEST_COMPANY_ID);
    expect(where.status).toBe('FINANCE_POSTED');
    expect(where.periodEndDate.gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(where.periodEndDate.lte.toISOString()).toBe('2026-03-31T23:59:59.999Z');
  });

  it('emits CSV with UTF-8 BOM and 9-digit tax IDs', async () => {
    findMany.mockResolvedValue([
      {
        invoiceNumber: 'SC-1-007',
        periodEndDate: new Date('2026-02-15T00:00:00Z'),
        grossCurrentAmount: money(80_000),
        taxWithholdingDeduction: money(800),
        subcontract: {
          taxWithholdingRate: money('0.01'),
          subcontractor: {
            taxRegistrationNumber: '204-587-663',
            commercialRegister: '58211',
            nameAr: 'شركة الفا',
            address: 'التجمع الخامس',
            bankAccountDetails: { taxOffice: 'مأمورية الاستثمار' },
          },
        },
      },
      {
        invoiceNumber: 'SC-2-001',
        periodEndDate: new Date('2026-03-01T00:00:00Z'),
        grossCurrentAmount: money(10_000),
        taxWithholdingDeduction: money(100),
        subcontract: {
          taxWithholdingRate: money('0.01'),
          subcontractor: {
            taxRegistrationNumber: '123',
            commercialRegister: '9',
            nameAr: 'مقاول قصير الرقم',
            address: '',
            bankAccountDetails: null,
          },
        },
      },
    ]);

    const exported = await taxForm41ExportService.exportQuarterlyForm41(TEST_COMPANY_ID, {
      year: 2026,
      quarter: 1,
      format: 'CSV',
    });

    expect(exported.contentType).toBe('text/csv; charset=utf-8');
    expect(exported.filename).toBe('eta-form-41-Q1-2026.csv');
    expect(exported.rowCount).toBe(2);
    expect(exported.buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);

    const csv = exported.buffer.toString('utf8');
    expect(csv).toContain('204587663');
    expect(csv).toContain('000000123');
    expect(csv).toContain('شركة الفا');
    expect(csv).toContain('SC-1-007 / 2026-02-15');
  });

  it('excludes non-posted invoices from the preview rows', async () => {
    findMany.mockResolvedValue([]);
    const preview = await taxForm41ExportService.previewQuarterlyForm41(TEST_COMPANY_ID, {
      year: 2026,
      quarter: 2,
    });
    expect(preview.rows).toEqual([]);
    expect(findMany.mock.calls[0][0].where.status).toBe('FINANCE_POSTED');
  });
});
