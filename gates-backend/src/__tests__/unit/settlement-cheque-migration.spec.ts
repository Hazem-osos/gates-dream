import {
  decideHistoricalChequeImport,
  decideHistoricalSettlementImport,
  isActiveCashAllocationLine,
  mapLegacyCkStatus,
} from '../../modules/migration-engine/treasury/settlement-cheque-decision';

describe('settlement-cheque-migration (fixture / schema-faithful decisions)', () => {
  it('treats CashTrxDetail Accepted=F as inactive allocation', () => {
    expect(isActiveCashAllocationLine({ Accepted: 'F' })).toBe(false);
    expect(isActiveCashAllocationLine({ Accepted: 'T' })).toBe(true);
  });

  it('blocks settlement when invoice not migrated', () => {
    const d = decideHistoricalSettlementImport({
      row: {
        InvoiceType: 'SI01',
        InvoiceNum: '100',
        Amount: 50,
        Accepted: 'T',
      },
      cashTransactionId: 'cash-1',
      invoiceId: null,
      alreadyMapped: false,
    });
    expect(d.action).toBe('BLOCK');
    if (d.action === 'BLOCK') expect(d.category).toBe('SETTLEMENT_INVOICE_NOT_MAPPED');
  });

  it('imports settlement when cash and invoice maps exist', () => {
    const d = decideHistoricalSettlementImport({
      row: {
        InvoiceType: 'SI01',
        InvoiceNum: '100',
        Amount: 50,
        Accepted: 'T',
      },
      cashTransactionId: 'cash-1',
      invoiceId: 'inv-1',
      alreadyMapped: false,
    });
    expect(d.action).toBe('IMPORT');
  });

  it('maps CKTrx lifecycle flags to ChequeStatus', () => {
    expect(mapLegacyCkStatus({ IsTake: 'T' })).toBe('COLLECTED');
    expect(mapLegacyCkStatus({ IsTazher: 'T' })).toBe('ENDORSED');
    expect(mapLegacyCkStatus({ Deleted: 'T' })).toBe('CANCELLED');
  });

  it('imports PK01 outward cheque lines', () => {
    const d = decideHistoricalChequeImport({
      row: { Type: 'PK01', Amount: 100, IdNum: '12345', PKNum: '1' },
      sourceEntity: 'PKTrxDetail',
      alreadyMapped: false,
    });
    expect(d.action).toBe('IMPORT');
  });

  it('blocks unknown cheque Type codes', () => {
    const d = decideHistoricalChequeImport({
      row: { Type: 'XX99', Amount: 100, IdNum: '12345', CKNum: '1' },
      sourceEntity: 'CKTrxDetail',
      alreadyMapped: false,
    });
    expect(d.action).toBe('BLOCK');
  });

  it('allows CK01 inward cheque with IdNum', () => {
    const d = decideHistoricalChequeImport({
      row: { Type: 'CK01', Amount: 100, IdNum: '12345', CKNum: '1' },
      sourceEntity: 'CKTrxDetail',
      alreadyMapped: false,
    });
    expect(d.action).toBe('IMPORT');
  });
});
