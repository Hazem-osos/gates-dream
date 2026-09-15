'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { emptyPaymentLine, splitPaymentLineTotals, type PaymentVoucherLine } from '@/lib/treasury/payment-voucher-line';
import { BankCreditLinesTable } from './BankCreditLinesTable';
import type { PaymentLineCurrency } from './PaymentLinesTable';

type Props = {
  open: boolean;
  lines: PaymentVoucherLine[];
  currencies: PaymentLineCurrency[];
  baseCurrency?: string;
  showFx?: boolean;
  disabled?: boolean;
  accountLabelFor?: (accountId: string) => string | undefined;
  onClose: () => void;
  onApply: (lines: PaymentVoucherLine[]) => void;
};

export function BankCreditOtherDebitPartiesModal({
  open,
  lines,
  currencies,
  baseCurrency = 'EGP',
  showFx = true,
  disabled,
  accountLabelFor,
  onClose,
  onApply,
}: Props) {
  const { label: companyBaseLabel } = useCompanyBaseCurrency();
  const [draft, setDraft] = useState<PaymentVoucherLine[]>(lines);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setDraft(lines.length ? lines : [emptyPaymentLine(baseCurrency, 'DEBIT', '', 1)]);
  }, [open, lines, baseCurrency]);

  if (!open || !mounted) return null;

  const { debitTotal } = splitPaymentLineTotals(draft.map((l) => ({ ...l, entrySide: 'DEBIT' })));

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-900/40 p-4" dir="rtl">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="إغلاق" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#E6F0F7] bg-white shadow-2xl">
        <div className="border-b border-[#E6F0F7] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0A3D5E]">
            إضافة أطراف مدينة أخرى (عمولات بنكية / مصاريف تحويل / خصومات مسموحة)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            البيانات المدخلة هنا ستُدرج في الجانب المدين من القيد لخصم مصاريف البنك أو الخصومات من إجمالي المبلغ
            المحول قبل قيد الصافي بالبنك.
          </p>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <BankCreditLinesTable
            gridId="bank-credit-debit-parties"
            lines={draft}
            onChange={setDraft}
            onAddLine={() => setDraft((prev) => [...prev, emptyPaymentLine(baseCurrency, 'DEBIT', '', 1)])}
            disabled={disabled}
            accountLabelFor={accountLabelFor}
            currencies={currencies}
            baseCurrency={baseCurrency}
            showFx={showFx}
            accountColumnLabel="الحساب / المستفيد"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6F0F7] px-5 py-3">
          <p className="text-sm">
            <span className="text-slate-500">إجمالي الأطراف المدينة: </span>
            <span className="font-mono font-bold text-[#0A3D5E]">
              {debitTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {companyBaseLabel}
            </span>
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() =>
                onApply(draft.filter((l) => l.accountId && Number(l.amount) > 0).map((l) => ({ ...l, entrySide: 'DEBIT' })))
              }
            >
              ✓ اعتماد الأطراف المدينة
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
