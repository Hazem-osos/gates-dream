import { describe, expect, it } from 'vitest';
import {
  documentSerialPlaceholder,
  isTransactionSerialAutomatic,
  isTransactionSerialManual,
} from './serial-mode';
import {
  canLoadSourceOrder,
  shouldLockItemPriceOverride,
  shouldLockLoadedSource,
  shouldShowAllAccountsInPartyField,
  documentForcesAutomaticNumbering,
  hidesPurchaseCostAndNegativeStockGuards,
  isNonJournalTreasuryDocumentType,
  isNonPostingOrderDocumentType,
  isTreasuryOrderDocumentType,
  usesDefaultBankAccount,
  usesDefaultTreasurySafe,
  warnsWhenDisablingJournalGeneration,
} from './types';

describe('isTransactionSerialAutomatic', () => {
  it('locks the serial only after settings say AUTOMATIC', () => {
    expect(isTransactionSerialAutomatic('AUTOMATIC')).toBe(true);
  });

  it('unlocks the serial for MANUAL and while settings are still loading', () => {
    expect(isTransactionSerialAutomatic('MANUAL')).toBe(false);
    expect(isTransactionSerialAutomatic(undefined)).toBe(false);
    expect(isTransactionSerialAutomatic(null)).toBe(false);
  });
});

describe('isTransactionSerialManual', () => {
  it('is true only after settings explicitly say MANUAL', () => {
    expect(isTransactionSerialManual('MANUAL')).toBe(true);
    expect(isTransactionSerialManual('AUTOMATIC')).toBe(false);
    expect(isTransactionSerialManual(undefined)).toBe(false);
    expect(isTransactionSerialManual(null)).toBe(false);
  });
});

describe('documentForcesAutomaticNumbering', () => {
  it('locks قيد اليومية to automatic numbering', () => {
    expect(documentForcesAutomaticNumbering('JOURNAL_ENTRY')).toBe(true);
    expect(documentForcesAutomaticNumbering('PAYMENT_ORDER')).toBe(false);
    expect(documentForcesAutomaticNumbering('OPENING_BALANCE')).toBe(false);
  });
});

describe('isTreasuryOrderDocumentType', () => {
  it('treats payment and receipt orders as treasury orders without a GL', () => {
    expect(isTreasuryOrderDocumentType('PAYMENT_ORDER')).toBe(true);
    expect(isTreasuryOrderDocumentType('RECEIPT_ORDER')).toBe(true);
    expect(isTreasuryOrderDocumentType('PAYMENT_VOUCHER')).toBe(false);
  });
});

describe('canLoadSourceOrder', () => {
  it('keeps تعديل الأمر after load on orders/invoices, not on سند صرف/قبض نقدية', () => {
    expect(canLoadSourceOrder('PAYMENT_ORDER')).toBe(true);
    expect(canLoadSourceOrder('SALES_INVOICE')).toBe(true);
    expect(canLoadSourceOrder('PAYMENT_VOUCHER')).toBe(false);
    expect(canLoadSourceOrder('RECEIPT_VOUCHER')).toBe(false);
    expect(canLoadSourceOrder('TEMPORARY_RECEIPT')).toBe(false);
    expect(canLoadSourceOrder('BANK_DEBIT_ADVICE')).toBe(false);
    expect(canLoadSourceOrder('BANK_CREDIT_ADVICE')).toBe(false);
  });
});

describe('shouldLockLoadedSource', () => {
  it('locks after load only when the setting is off and a source is loaded', () => {
    expect(shouldLockLoadedSource({ allowEditLoadedOrder: false }, 'src-1')).toBe(true);
    expect(shouldLockLoadedSource({ allowEditLoadedOrder: false }, '')).toBe(false);
    expect(shouldLockLoadedSource({ allowEditLoadedOrder: true }, 'src-1')).toBe(false);
    expect(shouldLockLoadedSource(undefined, 'src-1')).toBe(false);
  });
});

describe('shouldLockItemPriceOverride', () => {
  it('locks the unit price only when override is explicitly off', () => {
    expect(shouldLockItemPriceOverride({ allowItemPriceOverride: false })).toBe(true);
    expect(shouldLockItemPriceOverride({ allowItemPriceOverride: true })).toBe(false);
    expect(shouldLockItemPriceOverride(undefined)).toBe(false);
  });
});

describe('shouldShowAllAccountsInPartyField', () => {
  it('opens the party field to the full posting chart only when the setting is on', () => {
    expect(shouldShowAllAccountsInPartyField({ showAllAccountsInCustomerField: true })).toBe(true);
    expect(shouldShowAllAccountsInPartyField({ showAllAccountsInCustomerField: false })).toBe(false);
    expect(shouldShowAllAccountsInPartyField(undefined)).toBe(false);
  });
});

describe('hidesPurchaseCostAndNegativeStockGuards', () => {
  it('drops below-cost and negative-qty toggles on purchase order and purchase invoice', () => {
    expect(hidesPurchaseCostAndNegativeStockGuards('PURCHASE_ORDER')).toBe(true);
    expect(hidesPurchaseCostAndNegativeStockGuards('PURCHASE_INVOICE')).toBe(true);
    expect(hidesPurchaseCostAndNegativeStockGuards('SALES_INVOICE')).toBe(false);
    expect(hidesPurchaseCostAndNegativeStockGuards('SALES_ORDER')).toBe(false);
  });
});

describe('isNonPostingOrderDocumentType', () => {
  it('marks quote and sales/purchase orders as no journal and no warehouse impact', () => {
    expect(isNonPostingOrderDocumentType('PRICE_QUOTE')).toBe(true);
    expect(isNonPostingOrderDocumentType('SALES_ORDER')).toBe(true);
    expect(isNonPostingOrderDocumentType('PURCHASE_ORDER')).toBe(true);
    expect(isNonPostingOrderDocumentType('SALES_INVOICE')).toBe(false);
    expect(isNonPostingOrderDocumentType('PURCHASE_INVOICE')).toBe(false);
    expect(isNonPostingOrderDocumentType('RECEIPT_ORDER')).toBe(false);
  });
});

describe('isNonJournalTreasuryDocumentType', () => {
  it('treats إيصال مؤقت like treasury orders: no GL from the screen', () => {
    expect(isNonJournalTreasuryDocumentType('TEMPORARY_RECEIPT')).toBe(true);
    expect(isNonJournalTreasuryDocumentType('PAYMENT_ORDER')).toBe(true);
    expect(isNonJournalTreasuryDocumentType('PAYMENT_VOUCHER')).toBe(false);
  });
});

describe('usesDefaultTreasurySafe', () => {
  it('lets سند صرف/قبض نقدية pick a default safe', () => {
    expect(usesDefaultTreasurySafe('PAYMENT_VOUCHER')).toBe(true);
    expect(usesDefaultTreasurySafe('RECEIPT_VOUCHER')).toBe(true);
    expect(usesDefaultTreasurySafe('PAYMENT_ORDER')).toBe(true);
    expect(usesDefaultTreasurySafe('TEMPORARY_RECEIPT')).toBe(true);
    expect(usesDefaultTreasurySafe('BANK_DEBIT_ADVICE')).toBe(false);
  });
});

describe('usesDefaultBankAccount', () => {
  it('lets إشعار خصم/إضافة pick a default bank account', () => {
    expect(usesDefaultBankAccount('BANK_DEBIT_ADVICE')).toBe(true);
    expect(usesDefaultBankAccount('BANK_CREDIT_ADVICE')).toBe(true);
    expect(usesDefaultBankAccount('PAYMENT_VOUCHER')).toBe(false);
  });
});

describe('warnsWhenDisablingJournalGeneration', () => {
  it('covers warehouse and invoice screens that keep perpetual inventory in sync', () => {
    expect(warnsWhenDisablingJournalGeneration('STOCK_RECEIPT')).toBe(true);
    expect(warnsWhenDisablingJournalGeneration('STOCK_ISSUE')).toBe(true);
    expect(warnsWhenDisablingJournalGeneration('PURCHASE_INVOICE')).toBe(true);
    expect(warnsWhenDisablingJournalGeneration('SALES_INVOICE')).toBe(true);
    expect(warnsWhenDisablingJournalGeneration('PURCHASE_RETURN')).toBe(true);
    expect(warnsWhenDisablingJournalGeneration('SALES_RETURN')).toBe(true);
    expect(warnsWhenDisablingJournalGeneration('STOCK_TRANSFER')).toBe(true);
    expect(warnsWhenDisablingJournalGeneration('STOCK_STOCKTAKING')).toBe(true);
    expect(warnsWhenDisablingJournalGeneration('STOCK_ASSEMBLY')).toBe(true);
    expect(warnsWhenDisablingJournalGeneration('STOCK_DISASSEMBLY')).toBe(true);
    expect(warnsWhenDisablingJournalGeneration('PAYMENT_VOUCHER')).toBe(false);
    expect(warnsWhenDisablingJournalGeneration('PURCHASE_ORDER')).toBe(false);
  });
});

describe('documentSerialPlaceholder', () => {
  it('tells the user when the number is typed vs generated', () => {
    expect(documentSerialPlaceholder(true)).toBe('يُولَّد تلقائياً');
    expect(documentSerialPlaceholder(false)).toBe('أدخل الرقم يدوياً');
  });
});
