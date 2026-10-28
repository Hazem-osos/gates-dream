import { describe, expect, it } from '@jest/globals';
import { planInvoiceNumbers } from '../../modules/migration-engine/commercial/invoice-number-plan';
import { pickPricedUnitPair } from '../../modules/migration-engine/commercial/invoice-line-units';
import { planChequeNumbers } from '../../modules/migration-engine/treasury/cheque-number-plan';
import { mapLegacyInvoiceKind } from '../../modules/migration-engine/transforms/commercial-document-transform';
import {
  invoiceStockSign,
  isLegacyStockItem,
} from '../../modules/migration-engine/inventory/inventory-decision';
import { assertTransition } from '../../modules/migration-engine/state-machine';

describe('invoice numbers never merge two legacy documents', () => {
  const keys = [
    { BranchCode: '01', YearID: '2026', Type: 'SI01', InvoiceNum: '1' },
    { BranchCode: '01', YearID: '2026', Type: 'SR01', InvoiceNum: '1' }, // same target group (sales)
    { BranchCode: '02', YearID: '2026', Type: 'SI01', InvoiceNum: '1' }, // other branch
    { BranchCode: '01', YearID: '2026', Type: 'SI01', InvoiceNum: '2' },
    { BranchCode: '01', YearID: '2026', Type: 'PI01', InvoiceNum: '1' }, // purchase group
  ];
  const numberOf = planInvoiceNumbers(keys);

  it('keeps the legacy number when it is unique in its target group', () => {
    expect(numberOf(keys[2])).toBe('1');
    expect(numberOf(keys[3])).toBe('2');
    expect(numberOf(keys[4])).toBe('1');
  });

  it('prefixes the type only when two legacy types share branch/year/group/number', () => {
    expect(numberOf(keys[0])).toBe('SI01-1');
    expect(numberOf(keys[1])).toBe('SR01-1');
  });

  it('gives every source key a distinct target key', () => {
    const target = keys.map((k) => {
      const kind = mapLegacyInvoiceKind(k.Type)!;
      return `${k.BranchCode}|${k.YearID}|${kind.invoiceType}|${numberOf(k)}`;
    });
    expect(new Set(target).size).toBe(keys.length);
  });
});

describe('legacy invoice kind', () => {
  it('maps unlisted return types to returns, not to purchases/sales', () => {
    expect(mapLegacyInvoiceKind('PR03')?.invoiceKind).toBe('PURCHASE_RETURN');
    expect(mapLegacyInvoiceKind('SR05')?.invoiceKind).toBe('SALE_RETURN');
    expect(mapLegacyInvoiceKind('PI07')?.invoiceKind).toBe('PURCHASE');
    expect(mapLegacyInvoiceKind('SV99')?.invoiceKind).toBe('SALE');
  });
});

describe('invoice line unit pairing', () => {
  it('uses the entered unit (UnitCode1/Qty1) when the price is quoted per entered unit', () => {
    const p = pickPricedUnitPair({ UnitCode1: 'BOX', Qty1: 2, UnitCode2: 'PCS', Qty2: 24, Price: 120, TotalValue: 240 });
    expect(p.unitCode).toBe('BOX');
    expect(p.quantity.toNumber()).toBe(2);
    expect(p.baseQuantity.toNumber()).toBe(24);
  });

  it('uses the base unit when the price is quoted per base unit', () => {
    const p = pickPricedUnitPair({ UnitCode1: 'BOX', Qty1: 2, UnitCode2: 'PCS', Qty2: 24, Price: 10, TotalValue: 240 });
    expect(p.unitCode).toBe('PCS');
    expect(p.quantity.toNumber()).toBe(24);
  });

  it('falls back to the base pair when the entered unit is blank', () => {
    const p = pickPricedUnitPair({ UnitCode1: '', Qty1: 0, UnitCode2: 'PCS', Qty2: 5, Price: 3, TotalValue: 15 });
    expect(p.unitCode).toBe('PCS');
    expect(p.quantity.toNumber()).toBe(5);
  });
});

describe('cheque numbers never merge two legacy cheques', () => {
  it('qualifies a paper number used twice in the same direction', () => {
    const rows = [
      { row: { BranchCode: '01', YearID: '2026', Type: 'CK01', CKNum: '1', Id: 1, IdNum: '100001' }, direction: 'INWARD' as const },
      { row: { BranchCode: '02', YearID: '2026', Type: 'CK01', CKNum: '1', Id: 1, IdNum: '100001' }, direction: 'INWARD' as const },
      { row: { BranchCode: '01', YearID: '2026', Type: 'CK01', CKNum: '1', Id: 2, IdNum: '100002' }, direction: 'INWARD' as const },
      { row: { BranchCode: '01', YearID: '2026', Type: 'PK01', PKNum: '1', IdNum: '100001' }, direction: 'OUTWARD' as const },
    ];
    const numberOf = planChequeNumbers(rows);
    const out = rows.map((r) => numberOf(r.row, r.direction));
    expect(out[2]).toBe('100002');
    expect(out[3]).toBe('100001'); // other direction: no clash
    expect(out[0]).not.toBe(out[1]);
    expect(out[0].startsWith('100001 (')).toBe(true);
  });

  it('qualifies the voucher fallback per branch', () => {
    const rows = [
      { row: { BranchCode: '01', YearID: '2026', Type: 'CK01', CKNum: '1', Id: 1 }, direction: 'INWARD' as const },
      { row: { BranchCode: '02', YearID: '2026', Type: 'CK01', CKNum: '1', Id: 1 }, direction: 'INWARD' as const },
    ];
    const numberOf = planChequeNumbers(rows);
    expect(numberOf(rows[0].row, 'INWARD')).not.toBe(numberOf(rows[1].row, 'INWARD'));
  });
});

describe('items and stock', () => {
  it('migrates every non-group item, including deleted and non-D types', () => {
    expect(isLegacyStockItem({ ItemType: 'D', HasChild: 'F', Deleted: 'T' })).toBe(true);
    expect(isLegacyStockItem({ ItemType: 'S', HasChild: 'F', Deleted: 'F' })).toBe(true);
    expect(isLegacyStockItem({ ItemType: 'C', HasChild: 'T', Deleted: 'F' })).toBe(false);
  });

  it('moves stock for SI/PI invoice families the commercial stage imports', () => {
    expect(invoiceStockSign('SI01')).toBe(-1);
    expect(invoiceStockSign('SI02')).toBe(-1);
    expect(invoiceStockSign('PI02')).toBe(1);
  });
});

describe('job state machine', () => {
  it('lets a running import stop as BLOCKED instead of failing the job', () => {
    expect(() => assertTransition('RUNNING', 'BLOCKED')).not.toThrow();
  });

  it('lets a stopped job finish its data rollback', () => {
    expect(() => assertTransition('FAILED', 'ROLLED_BACK')).not.toThrow();
  });
});
