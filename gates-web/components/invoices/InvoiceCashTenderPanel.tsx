'use client';

import { SafeSelect } from '@/app/components/form/SafeSelect';
import { BankSelect } from '@/app/components/form/BankSelect';
import { ErpFieldError, RequiredDot, erpInputClass, erpInputErrorClass, erpLabelClass } from '@/components/erp';
import {
  emptyChequeDraft,
  parseTenderAmount,
  type CashTenderKind,
  type InvoiceChequeDraft,
} from '@/lib/invoices/cash-tender';

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

function AmountField({
  value,
  onChange,
  disabled,
  error,
  showErrors,
}: {
  value: number;
  onChange: (amount: number) => void;
  disabled?: boolean;
  error?: string;
  showErrors?: boolean;
}) {
  return (
    <div>
      <label className={erpLabelClass}>القيمة</label>
      <input
        type="number"
        step="0.01"
        min="0"
        className={`${erpInputClass} ${showErrors && error ? erpInputErrorClass : ''}`}
        disabled={disabled}
        placeholder="0"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      <ErpFieldError message={error} show={showErrors} />
    </div>
  );
}

export function InvoiceCashTenderPanel({
  kind,
  onKindChange,
  treasuryId,
  onTreasuryId,
  bankAccountId,
  onBankAccountId,
  bankReference: _bankReference,
  onBankReference,
  chequeRows,
  onChequeRows,
  issuingBankAccountId: _issuingBankAccountId,
  onIssuingBankAccountId: _onIssuingBankAccountId,
  netAmount = 0,
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
  const advance = variant === 'advance';
  const needsInstrument = !advance || Number(paidAmount) > 0;
  const rows = chequeRows.length ? chequeRows : [emptyChequeDraft()];
  const chequeSum = rows.reduce((sum, row) => sum + parseTenderAmount(row.amount), 0);

  const selectKind = (next: CashTenderKind) => {
    if (next === 'treasury') {
      onBankAccountId('');
      onBankReference('');
      onChequeRows([emptyChequeDraft()]);
      onKindChange('treasury');
      return;
    }
    if (next === 'bank') {
      onChequeRows([emptyChequeDraft()]);
      onKindChange('bank');
      return;
    }
    onBankAccountId('');
    onBankReference('');
    onChequeRows(chequeRows.length ? chequeRows : [emptyChequeDraft()]);
    onKindChange('cheques');
  };

  const updateCheque = (id: string, patch: Partial<InvoiceChequeDraft>) => {
    const next = rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
    onChequeRows(next);
    if (advance && onPaidAmount) {
      onPaidAmount(next.reduce((sum, row) => sum + parseTenderAmount(row.amount), 0));
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5 gap-0.5">
        {KINDS.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => selectKind(option.id)}
            className={`flex-1 min-w-[4rem] rounded-md px-2 py-1 text-xs font-medium ${
              kind === option.id ? 'bg-[#0E78AA] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {kind === 'treasury' ? (
        <div className="space-y-2">
          <div>
            <label className={erpLabelClass}>
              الخزينة
              {needsInstrument ? (
                <RequiredDot hint={advance ? 'الخزينة مطلوبة عند إدخال قيمة' : 'الخزينة مطلوبة عند التحصيل النقدي'} />
              ) : null}
            </label>
            <SafeSelect
              value={treasuryId}
              onChange={onTreasuryId}
              disabled={disabled}
              allowEmpty={!needsInstrument}
              placeholder="اختر الخزينة"
              emptyLabel="اختر الخزينة"
              className={showErrors && treasuryError ? erpInputErrorClass : undefined}
            />
            <ErpFieldError message={treasuryError} show={showErrors} />
          </div>
          {advance && onPaidAmount ? (
            <AmountField
              value={paidAmount}
              onChange={onPaidAmount}
              disabled={disabled}
              error={paidError}
              showErrors={showErrors}
            />
          ) : null}
        </div>
      ) : null}

      {kind === 'bank' ? (
        <div className="space-y-2">
          <div>
            <label className={erpLabelClass}>
              الحساب البنكي
              {needsInstrument ? <RequiredDot hint="اختر البنك من العدسة" /> : null}
            </label>
            <BankSelect
              value={bankAccountId}
              onChange={onBankAccountId}
              disabled={disabled}
              placeholder="ابحث واختر البنك"
              emptyLabel="اختر الحساب البنكي"
              className={showErrors && bankError ? erpInputErrorClass : undefined}
            />
            <ErpFieldError message={bankError} show={showErrors} />
          </div>
          {advance && onPaidAmount ? (
            <AmountField
              value={paidAmount}
              onChange={onPaidAmount}
              disabled={disabled}
              error={paidError}
              showErrors={showErrors}
            />
          ) : null}
        </div>
      ) : null}

      {kind === 'cheques' ? (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={row.id} className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2">
              {rows.length > 1 ? (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">شيك {index + 1}</span>
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-600 hover:underline"
                    disabled={disabled}
                    onClick={() => {
                      const next = rows.filter((item) => item.id !== row.id);
                      onChequeRows(next.length ? next : [emptyChequeDraft()]);
                      if (advance && onPaidAmount) {
                        onPaidAmount(next.reduce((sum, item) => sum + parseTenderAmount(item.amount), 0));
                      }
                    }}
                  >
                    حذف
                  </button>
                </div>
              ) : null}
              <input
                placeholder="رقم الشيك"
                className={erpInputClass}
                disabled={disabled}
                value={row.chequeNumber}
                onChange={(e) => updateCheque(row.id, { chequeNumber: e.target.value })}
              />
              <input
                type="date"
                className={erpInputClass}
                disabled={disabled}
                value={row.dueDate}
                onChange={(e) => updateCheque(row.id, { dueDate: e.target.value })}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="القيمة"
                className={erpInputClass}
                disabled={disabled}
                value={row.amount}
                onChange={(e) => updateCheque(row.id, { amount: e.target.value })}
              />
            </div>
          ))}
          <button
            type="button"
            disabled={disabled}
            className="text-xs font-semibold text-[#0E78AA] hover:underline"
            onClick={() => {
              const leftover = Math.max(0, Number((netAmount - chequeSum).toFixed(2)));
              onChequeRows([...rows, emptyChequeDraft(leftover > 0 ? String(leftover) : '')]);
            }}
          >
            + إضافة شيك
          </button>
          <ErpFieldError message={chequeError} show={showErrors} />
        </div>
      ) : null}
    </div>
  );
}
