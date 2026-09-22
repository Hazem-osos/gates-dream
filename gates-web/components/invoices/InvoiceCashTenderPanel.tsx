'use client';

import { useState } from 'react';
import { SafeSelect } from '@/app/components/form/SafeSelect';
import { ErpFieldError, RequiredDot, erpInputClass, erpInputErrorClass, erpLabelClass } from '@/components/erp';
import {
  emptyChequeDraft,
  parseTenderAmount,
  type CashTenderKind,
  type InvoiceChequeDraft,
} from '@/lib/invoices/cash-tender';
import { CashBankChequeModal } from '@/components/invoices/CashBankChequeModal';

const KINDS: Array<{ id: CashTenderKind; label: string }> = [
  { id: 'treasury', label: 'خزينة' },
  { id: 'bank', label: 'بنك' },
  { id: 'cheques', label: 'شيكات' },
];

type Props = {
  kind: CashTenderKind;
  onKindChange: (kind: CashTenderKind) => void;
  treasuryId: string;
  onTreasuryId: (id: string) => void;
  bankAccountId: string;
  onBankAccountId: (id: string) => void;
  bankReference: string;
  onBankReference: (value: string) => void;
  chequeRows: InvoiceChequeDraft[];
  onChequeRows: (rows: InvoiceChequeDraft[]) => void;
  issuingBankAccountId?: string;
  onIssuingBankAccountId?: (id: string) => void;
  netAmount?: number;
  direction?: 'RECEIPT' | 'PAYMENT';
  variant?: 'full' | 'advance';
  paidAmount?: number;
  onPaidAmount?: (amount: number) => void;
  paidError?: string;
  disabled?: boolean;
  treasuryError?: string;
  bankError?: string;
  chequeError?: string;
  showErrors?: boolean;
};

function instrumentSummary(bankAccountId: string, chequeRows: InvoiceChequeDraft[]): string {
  const chequeCount = chequeRows.filter((row) => row.chequeNumber.trim()).length;
  const chequeSum = chequeRows.reduce((sum, row) => sum + parseTenderAmount(row.amount), 0);
  const parts: string[] = [];
  if (bankAccountId.trim()) parts.push('بنك');
  if (chequeCount) parts.push(chequeCount > 1 ? `${chequeCount} شيكات` : 'شيك');
  if (chequeSum > 0) parts.push(chequeSum.toFixed(2));
  return parts.join(' · ');
}

export function InvoiceCashTenderPanel({
  kind,
  onKindChange,
  treasuryId,
  onTreasuryId,
  bankAccountId,
  onBankAccountId,
  bankReference,
  onBankReference,
  chequeRows,
  onChequeRows,
  issuingBankAccountId = '',
  onIssuingBankAccountId,
  netAmount = 0,
  direction = 'RECEIPT',
  variant = 'full',
  paidAmount = 0,
  onPaidAmount,
  paidError,
  disabled = false,
  treasuryError,
  bankError,
  chequeError,
  showErrors = false,
}: Props) {
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<CashTenderKind | null>(null);
  const advance = variant === 'advance';
  const needsInstrument = !advance || Number(paidAmount) > 0;
  const hasConfirmedBank = Boolean(bankAccountId.trim());
  const hasConfirmedCheque = chequeRows.some(
    (row) => row.chequeNumber.trim() && parseTenderAmount(row.amount) > 0
  );
  const usesInstrument =
    (kind === 'bank' && hasConfirmedBank) || (kind === 'cheques' && (hasConfirmedCheque || hasConfirmedBank));
  const highlightKind = instrumentOpen && pendingKind ? pendingKind : usesInstrument ? kind : 'treasury';
  const summary = instrumentSummary(bankAccountId, chequeRows);

  const openInstrument = (next: CashTenderKind) => {
    setPendingKind(next);
    if (chequeRows.length === 0) {
      const seed = advance
        ? Number(paidAmount) > 0
          ? String(paidAmount)
          : ''
        : netAmount > 0
          ? String(netAmount)
          : '';
      onChequeRows([emptyChequeDraft(next === 'cheques' ? seed : '')]);
    }
    if (!disabled) setInstrumentOpen(true);
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5 gap-0.5">
        {KINDS.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (option.id === 'treasury') {
                onKindChange('treasury');
                return;
              }
              openInstrument(option.id);
            }}
            className={`flex-1 min-w-[4rem] rounded-md px-2 py-1 text-xs font-medium ${
              highlightKind === option.id ? 'bg-[#0E78AA] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {highlightKind === 'treasury' && !instrumentOpen ? (
        <div className="space-y-2">
          <div>
            <label className={erpLabelClass}>
              الخزينة
              {needsInstrument ? (
                <RequiredDot hint={advance ? 'الخزينة مطلوبة عند دفع مبلغ في الأول' : 'الخزينة مطلوبة عند التحصيل النقدي'} />
              ) : null}
            </label>
            <SafeSelect
              value={treasuryId}
              onChange={onTreasuryId}
              disabled={disabled}
              placeholder="اختر الخزينة"
              emptyLabel="اختر الخزينة"
              className={showErrors && treasuryError ? erpInputErrorClass : undefined}
            />
            <ErpFieldError message={treasuryError} show={showErrors} />
          </div>
          {advance && onPaidAmount ? (
            <div>
              <label className={erpLabelClass}>المبلغ المدفوع في الأول</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`${erpInputClass} ${showErrors && paidError ? erpInputErrorClass : ''}`}
                disabled={disabled}
                placeholder="0"
                value={Number.isFinite(paidAmount) ? paidAmount : 0}
                onChange={(e) => onPaidAmount(Number(e.target.value) || 0)}
              />
              <ErpFieldError message={paidError} show={showErrors} />
            </div>
          ) : null}
        </div>
      ) : null}

      {usesInstrument ? (
        <div className="space-y-1.5">
          <button
            type="button"
            disabled={disabled}
            className="text-xs font-semibold text-[#0E78AA] hover:underline"
            onClick={() => setInstrumentOpen(true)}
          >
            بنك وشيكات…
          </button>
          {summary ? <p className="text-[11px] text-slate-500">{summary}</p> : (
            <p className="text-[11px] text-slate-400">افتح لإضافة تحويل بنكي أو قائمة شيكات</p>
          )}
          <ErpFieldError message={bankError} show={showErrors} />
          <ErpFieldError message={chequeError} show={showErrors} />
        </div>
      ) : null}

      {instrumentOpen ? (
        <CashBankChequeModal
          open
          onClose={() => {
            setInstrumentOpen(false);
            setPendingKind(null);
          }}
          netAmount={netAmount}
          direction={direction}
          variant={variant}
          bankAccountId={bankAccountId}
          bankReference={bankReference}
          chequeRows={chequeRows}
          issuingBankAccountId={issuingBankAccountId}
          paidAmount={paidAmount}
          onConfirm={(next) => {
            onBankAccountId(next.bankAccountId);
            onBankReference(next.bankReference);
            onChequeRows(next.chequeRows);
            if (next.issuingBankAccountId != null) onIssuingBankAccountId?.(next.issuingBankAccountId);
            if (advance && next.paidAmount != null) onPaidAmount?.(next.paidAmount);
            const hasCheques = next.chequeRows.some(
              (row) => row.chequeNumber.trim() && parseTenderAmount(row.amount) > 0
            );
            onKindChange(hasCheques ? 'cheques' : 'bank');
            setPendingKind(null);
          }}
        />
      ) : null}
    </div>
  );
}
