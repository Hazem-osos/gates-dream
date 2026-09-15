'use client';

import { useMemo, useState } from 'react';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import {
  DocumentSectionNumberPair,
  sectionNumberInputClass,
  sectionNumberLabelClass,
} from '@/components/erp/DocumentSectionNumberPair';
import { useApiQuery } from '@/lib/hooks/useApi';

export type VoucherSourceSection =
  | 'CASH_PAYMENT_ORDER'
  | 'BANK_PAYMENT_ORDER'
  | 'CASH_RECEIPT_ORDER'
  | 'BANK_RECEIPT_ORDER';

type OrderRow = {
  id: string;
  voucherNumber?: string | null;
  description?: string | null;
  amount?: number | string | null;
  date?: string | null;
};

const SECTION_OPTIONS: Array<{
  value: VoucherSourceSection;
  label: string;
  kind: 'PAYMENT' | 'RECEIPT';
  fundType: 'CASHBOX' | 'BANK_ACCOUNT';
}> = [
  { value: 'CASH_PAYMENT_ORDER', label: 'أمر صرف نقدية', kind: 'PAYMENT', fundType: 'CASHBOX' },
  { value: 'BANK_PAYMENT_ORDER', label: 'أمر صرف بنكي', kind: 'PAYMENT', fundType: 'BANK_ACCOUNT' },
  { value: 'CASH_RECEIPT_ORDER', label: 'أمر توريد نقدية', kind: 'RECEIPT', fundType: 'CASHBOX' },
  { value: 'BANK_RECEIPT_ORDER', label: 'أمر توريد بنكي', kind: 'RECEIPT', fundType: 'BANK_ACCOUNT' },
];

function sectionsFor(kind: 'PAYMENT' | 'RECEIPT') {
  return SECTION_OPTIONS.filter((opt) => opt.kind === kind);
}

function defaultSection(
  kind: 'PAYMENT' | 'RECEIPT',
  fundType: 'CASHBOX' | 'BANK_ACCOUNT'
): VoucherSourceSection {
  if (kind === 'PAYMENT') {
    return fundType === 'BANK_ACCOUNT' ? 'BANK_PAYMENT_ORDER' : 'CASH_PAYMENT_ORDER';
  }
  return fundType === 'BANK_ACCOUNT' ? 'BANK_RECEIPT_ORDER' : 'CASH_RECEIPT_ORDER';
}

type Props = {
  kind: 'PAYMENT' | 'RECEIPT';
  fundType: 'CASHBOX' | 'BANK_ACCOUNT';
  value: string;
  valueLabel?: string;
  disabled?: boolean;
  onChange: (orderId: string, order?: OrderRow) => void;
};

export function VoucherSourceDocumentControl({
  kind,
  fundType,
  value,
  valueLabel,
  disabled = false,
  onChange,
}: Props) {
  const options = sectionsFor(kind);
  const [section, setSection] = useState<VoucherSourceSection>(() => defaultSection(kind, fundType));
  const [search, setSearch] = useState('');
  const selected = SECTION_OPTIONS.find((opt) => opt.value === section);

  const { data: docsRes, isFetching } = useApiQuery<OrderRow[]>(
    ['voucher-source-orders', section, search],
    '/treasury/cash-transactions',
    {
      transactionKind: selected?.kind,
      documentRole: 'ORDER',
      isCancelled: false,
      executionStatus: 'PENDING',
      fundType: selected?.fundType,
      search: search || undefined,
      page: 1,
      limit: 200,
    },
    { enabled: Boolean(selected) && !disabled }
  );

  const comboboxOptions = useMemo(
    () =>
      (docsRes?.data ?? []).map((doc) => {
        const amount = Number(doc.amount ?? 0);
        const amountLabel = Number.isFinite(amount)
          ? amount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '';
        return {
          value: doc.id,
          label: [doc.voucherNumber || doc.id.slice(0, 8), doc.description, amountLabel]
            .filter(Boolean)
            .join(' — '),
          searchText: `${doc.voucherNumber ?? ''} ${doc.description ?? ''}`,
        };
      }),
    [docsRes?.data]
  );

  return (
    <div className="flex justify-end">
      <DocumentSectionNumberPair>
        <div className="w-[9.25rem] shrink-0">
          <label className={sectionNumberLabelClass}>القسم</label>
          <select
            className={sectionNumberInputClass}
            disabled={disabled}
            value={section}
            onChange={(e) => {
              const next = e.target.value as VoucherSourceSection;
              setSearch('');
              setSection(next);
              onChange('');
            }}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[16rem] min-w-0">
          <label className={sectionNumberLabelClass}>الرقم</label>
          <SearchableCombobox
            value={value}
            valueLabel={valueLabel}
            onChange={(id) => {
              const doc = (docsRes?.data ?? []).find((row) => row.id === id);
              onChange(id, doc);
            }}
            options={comboboxOptions}
            disabled={disabled || !section}
            loading={isFetching}
            className={sectionNumberInputClass}
            placeholder={section ? 'اختر الرقم…' : 'اختر القسم أولاً'}
            emptyMessage="لا توجد أوامر مطابقة"
            onQueryChange={setSearch}
            maxVisible={200}
            maxListHeight={420}
            portaled
            menuPlacement="auto"
          />
        </div>
      </DocumentSectionNumberPair>
    </div>
  );
}
