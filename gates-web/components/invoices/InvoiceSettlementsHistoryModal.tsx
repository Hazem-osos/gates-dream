'use client';

import { InvoiceSettlementsHistory } from '@/components/invoices/InvoiceSettlementsHistory';
import type { InvoiceCashSettlement, InvoiceChequeSettlement } from '@/lib/invoices/invoice-settlements';

type Props = {
  open: boolean;
  onClose: () => void;
  direction?: 'RECEIPT' | 'PAYMENT';
  settlements?: InvoiceCashSettlement[];
  cheques?: InvoiceChequeSettlement[];
  paidAmount?: number;
  remainingAmount?: number;
  netAmount?: number;
  loading?: boolean;
};

export function InvoiceSettlementsHistoryModal({
  open,
  onClose,
  direction = 'RECEIPT',
  settlements,
  cheques,
  paidAmount,
  remainingAmount,
  netAmount,
  loading = false,
}: Props) {
  if (!open) return null;
  const title = direction === 'PAYMENT' ? 'المدفوعات السابقة' : 'التحصيلات السابقة';

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E6F0F7] bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#0A3D5E]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            إغلاق
          </button>
        </div>
        {loading ? (
          <p className="p-2 text-sm text-slate-500">جاري تحميل القائمة…</p>
        ) : (
          <InvoiceSettlementsHistory
            settlements={settlements}
            cheques={cheques}
            paidAmount={paidAmount}
            remainingAmount={remainingAmount}
            netAmount={netAmount}
            direction={direction}
          />
        )}
      </div>
    </div>
  );
}
