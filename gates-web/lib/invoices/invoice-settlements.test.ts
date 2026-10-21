import { describe, expect, it } from 'vitest';
import {
  activeSettlementTotal,
  buildInvoiceSettlementHistory,
  invoiceCashPaidDisplayAmount,
  type InvoiceCashSettlement,
} from './invoice-settlements';

describe('buildInvoiceSettlementHistory', () => {
  it('activeSettlementTotal ignores cancelled rows', () => {
    const cash: InvoiceCashSettlement[] = [
      {
        id: 'a',
        voucherNumber: '00000002',
        amount: 114,
        isPosted: true,
        isCancelled: false,
      },
      {
        id: 'b',
        voucherNumber: '00000001',
        amount: 114,
        isPosted: false,
        isCancelled: true,
      },
    ];
    const rows = buildInvoiceSettlementHistory(cash, []);
    expect(activeSettlementTotal(rows)).toBe(114);
  });

  it('shows unposted cash as غير مرحّل with no extra invoice-edit note', () => {
    const cash: InvoiceCashSettlement[] = [
      {
        id: 'draft',
        voucherNumber: '00000007',
        amount: 200,
        isPosted: false,
        isCancelled: false,
      },
    ];
    const rows = buildInvoiceSettlementHistory(cash, []);
    expect(rows[0]?.statusLabel).toBe('غير مرحّل');
    expect(rows[0]?.statusLabel).not.toMatch(/فاتورة|انتظار|ملغ/);
  });

  it('keeps saved collections visible after unpost-for-edit', () => {
    expect(
      invoiceCashPaidDisplayAmount({
        isPosted: false,
        savedPaidAmount: 750,
        paymentMethod: 'credit',
        advancePaidAmount: 0,
        splitTenderPaid: 0,
        netAmount: 1000,
      })
    ).toBe(750);
  });

  it('uses draft tenders only when the invoice has no saved collections', () => {
    expect(
      invoiceCashPaidDisplayAmount({
        isPosted: false,
        savedPaidAmount: 0,
        paymentMethod: 'credit',
        advancePaidAmount: 120,
        splitTenderPaid: 0,
        netAmount: 1000,
      })
    ).toBe(120);
  });

  it('uses treasury payment voucher number instead of internal id', () => {
    const cash: InvoiceCashSettlement[] = [
      {
        id: 'uuid-long',
        voucherNumber: '00009999',
        treasuryPayment: { voucherNumber: '00001234' },
        amount: 500,
        isPosted: true,
        isCancelled: false,
        safe: { glAccount: { code: '1101', arabicName: 'خزينة رئيسية' } },
      },
    ];
    const rows = buildInvoiceSettlementHistory(cash, []);
    expect(rows[0]?.number).toBe('00001234');
    expect(rows[0]?.ledgerAccountLabel).toContain('1101');
  });
});
