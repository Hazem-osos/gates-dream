import { parseEnabledSalesProfileIds } from '../../modules/electronic-invoices/utils/enabled-sales-profiles';
import {
  BUILTIN_SALES_INVOICE_PATTERN_ID,
  buildEtaReadinessWhere,
} from '../../modules/electronic-invoices/services/eta-readiness-filters';

describe('enabled sales invoice profiles', () => {
  it('parses only non-empty ids', () => {
    expect(parseEnabledSalesProfileIds(null)).toEqual([]);
    expect(parseEnabledSalesProfileIds([' a ', '', 'b'])).toEqual(['a', 'b']);
  });

  it('limits sale readiness to the enabled sales patterns', () => {
    expect(
      buildEtaReadinessWhere('c1', { invoiceKind: 'SALE', enabledSalesProfileIds: [] }).AND
    ).toBeUndefined();
    expect(
      buildEtaReadinessWhere('c1', {
        invoiceKind: 'SALE',
        enabledSalesProfileIds: ['p1', 'p2'],
        enabledModuleCodes: { p2: 'SI02' },
      }).AND
    ).toEqual([
      {
        OR: [
          { documentProfileId: { in: ['p1', 'p2'] } },
          { newModuleId: { in: ['p1', 'p2'] } },
          { moduleCode: { in: ['SI02'] } },
        ],
      },
    ]);
    expect(
      buildEtaReadinessWhere('c1', {
        invoiceKind: 'SALE',
        enabledSalesProfileIds: [BUILTIN_SALES_INVOICE_PATTERN_ID],
      }).AND
    ).toEqual([
      {
        OR: [
          {
            documentProfileId: null,
            newModuleId: null,
            OR: [{ moduleCode: null }, { moduleCode: 'SI01' }],
          },
        ],
      },
    ]);
    expect(
      buildEtaReadinessWhere('c1', {
        invoiceKind: 'SALE_RETURN',
        enabledSalesProfileIds: ['p1'],
      }).AND
    ).toBeUndefined();
  });
});
