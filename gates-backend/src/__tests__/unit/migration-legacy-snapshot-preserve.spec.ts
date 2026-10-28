import { preserveLegacySnapshot } from '../../modules/migration-engine/services/migration-legacy-snapshot-preserve.service';
import { transformHistoricalInvoiceLine } from '../../modules/migration-engine/transforms/commercial-document-transform';

describe('migration legacy snapshot preserve', () => {
  it('writes unmapped columns to company settings', async () => {
    const entries: Array<{ name: string; value: string }> = [];
    const ctx = {
      dryRun: false,
      targetCompanyId: 'c1',
      prisma: {},
    } as never;
    const mod = await import('../../modules/platform/services/company-setting.service');
    const spy = jest.spyOn(mod.companySettingService, 'setEntry').mockImplementation(async (_c, name, value) => {
      entries.push({ name, value });
      return {} as never;
    });
    const n = await preserveLegacySnapshot(ctx, {
      namespace: 'legacyTest',
      sourceKey: 'k1',
      raw: { CompanyCode: '01', Foo: 'bar', Mapped: 'x' },
      mappedColumns: new Set(['CompanyCode', 'Mapped']),
    });
    expect(n).toBe(1);
    expect(entries[0]?.name).toBe('migration.legacyTest.k1');
    expect(JSON.parse(entries[0]?.value ?? '{}')).toEqual({ Foo: 'bar' });
    spy.mockRestore();
  });

  it('maps invoice line discounts and cost to target fields', () => {
    const line = transformHistoricalInvoiceLine(
      {
        Qty1: 2,
        Qty2: 2,
        Price: 10,
        TotalValue: 20,
        DiscPercent: 5,
        DiscValue: 1,
        DaribaPercent: 14,
        DaribaValue: 2.8,
        CostPrice: 7,
        SerialNums: 'SN-1',
        ItemDesc: 'Line note',
        GridNum: 3,
      },
      { invoiceId: 'inv', itemId: 'it', unitId: 'u1' }
    );
    expect(String(line.discountPercent)).toBe('5');
    expect(String(line.taxPercent)).toBe('14');
    expect(String(line.unitCostAtIssue)).toBe('7');
    expect(line.serialNumbers).toBe('SN-1');
    expect(line.lineOrder).toBe(3);
  });
});
