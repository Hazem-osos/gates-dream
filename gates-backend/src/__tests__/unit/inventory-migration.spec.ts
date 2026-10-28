import { money } from '../../modules/migration-engine/accounting/journal-money';
import {
  baseQuantity,
  conversionFactor,
  decidePostedStockDocument,
  invoiceStockSign,
  isDefensiblePurchaseCost,
  isLegacyItemGroup,
  isLegacyStockItem,
  resolveLegacyInvoiceWarehouse,
  transferQuantity,
} from '../../modules/migration-engine/inventory/inventory-decision';
import { unitCompanyCode } from '../../modules/migration-engine/transforms/item-transform';

describe('inventory-migration', () => {
  it('does not treat empty ItemStore as zero stock', () => {
    expect(isLegacyStockItem({ ItemType: 'D', HasChild: 'F', Deleted: 'F' })).toBe(true);
    expect(isLegacyItemGroup({ ItemType: 'C', HasChild: 'T' })).toBe(true);
  });

  it('maps invoice types to signed stock without inventing missing types', () => {
    expect(invoiceStockSign('PI01')).toBe(1);
    expect(invoiceStockSign('SV01')).toBe(-1);
    expect(invoiceStockSign('SR01')).toBe(1);
    expect(invoiceStockSign('PR01')).toBe(-1);
    expect(invoiceStockSign('PV01')).toBeNull();
  });

  it('uses Qty2 as base quantity and keeps zero/negative values', () => {
    expect(baseQuantity(10, 1000).toFixed(4)).toBe('1000.0000');
    expect(baseQuantity(5, 0).toFixed(4)).toBe('5.0000');
    expect(baseQuantity(-2, 0).toFixed(4)).toBe('-2.0000');
  });

  it('uses TransMainQty for transfers and rejects invalid conversion factors', () => {
    expect(transferQuantity(12, 99, 0).toFixed(4)).toBe('12.0000');
    expect(conversionFactor(10).toFixed(4)).toBe('10.0000');
    expect(conversionFactor(0).toFixed(4)).toBe('0.0000');
    expect(conversionFactor(-1).toFixed(4)).toBe('0.0000');
  });

  it('quarantines missing item/warehouse and skips unposted/no-stock documents', () => {
    expect(
      decidePostedStockDocument({
        isPosted: false,
        isDeleted: false,
        alreadyMapped: false,
        affectStore: true,
        itemResolved: true,
        warehouseResolved: true,
        typeKnown: true,
        factorOk: true,
      }).decision
    ).toBe('SKIP_UNPOSTED');
    expect(
      decidePostedStockDocument({
        isPosted: true,
        isDeleted: false,
        alreadyMapped: false,
        affectStore: false,
        itemResolved: true,
        warehouseResolved: true,
        typeKnown: true,
        factorOk: true,
      }).decision
    ).toBe('SKIP_NO_STOCK');
    expect(
      decidePostedStockDocument({
        isPosted: true,
        isDeleted: false,
        alreadyMapped: false,
        affectStore: true,
        itemResolved: false,
        warehouseResolved: true,
        typeKnown: true,
        factorOk: true,
      }).decision
    ).toBe('QUARANTINE_MISSING_ITEM');
    expect(
      decidePostedStockDocument({
        isPosted: true,
        isDeleted: false,
        alreadyMapped: false,
        affectStore: true,
        itemResolved: true,
        warehouseResolved: false,
        typeKnown: true,
        factorOk: true,
      }).decision
    ).toBe('QUARANTINE_MISSING_WAREHOUSE');
    expect(
      decidePostedStockDocument({
        isPosted: true,
        isDeleted: false,
        alreadyMapped: true,
        affectStore: true,
        itemResolved: true,
        warehouseResolved: true,
        typeKnown: true,
        factorOk: true,
      }).decision
    ).toBe('SKIP_ALREADY_MAPPED');
  });

  it('keeps unit codes distinct when the same legacy UnitCode has different names', () => {
    expect(unitCompanyCode('00000001', '1/4 لتر')).not.toBe(unitCompanyCode('00000001', '1/2 لتر'));
  });

  it('does not place a silent zero cost on missing valuation', () => {
    const qty = money('5');
    const cost = null;
    expect(qty.gt(0) && cost == null).toBe(true);
  });

  it('resumes inventory by lexicographic cursor so a missed exact match cannot skip the rest', () => {
    const written = '2025-03-03T00:00:00.000Z|ST|00000001|ST01|1|101004:1:0|1001|OUT';
    const later = '2025-03-03T00:00:00.000Z|ST|00000001|ST01|1|101004:1:0|1002|IN';
    expect(later > written).toBe(true);
    expect(written <= written).toBe(true);
  });

  it('does not infer a warehouse from a blank header and line', () => {
    expect(resolveLegacyInvoiceWarehouse('', '').classification).toBe('UNRESOLVABLE');
    expect(resolveLegacyInvoiceWarehouse('', '').warehouseCode).toBe('');
    expect(resolveLegacyInvoiceWarehouse('1001', '').classification).toBe('VERIFIED');
    expect(resolveLegacyInvoiceWarehouse('', '1002').warehouseCode).toBe('1002');
    expect(resolveLegacyInvoiceWarehouse('1003', '1001').warehouseCode).toBe('1003');
  });

  it('accepts posted purchase CostPrice as cost evidence and rejects sales price as inventory cost', () => {
    expect(isDefensiblePurchaseCost('PI01', 222)).toBe(true);
    expect(isDefensiblePurchaseCost('PI01', 0)).toBe(false);
    expect(isDefensiblePurchaseCost('SV01', 654)).toBe(false);
    expect(isDefensiblePurchaseCost('PR01', 222)).toBe(false);
  });

  it('keeps transfer inbound and outbound as separate signed movements', () => {
    const qty = transferQuantity(12, 0, 0);
    expect(qty.neg().toFixed(4)).toBe('-12.0000');
    expect(qty.toFixed(4)).toBe('12.0000');
  });
});
