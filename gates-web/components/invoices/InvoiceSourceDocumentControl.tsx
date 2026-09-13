'use client';

import { useMemo, useState } from 'react';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import {
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_OPTIONS,
  formatSourceAmount,
  type SelectableSourceType,
  type SourceDocumentListItem,
  type SourceHydratePayload,
} from '@/lib/invoices/sourceDocument';
import { SourceHydrateConfirmDialog } from './SourceHydrateConfirmDialog';
import {
  DocumentSectionNumberPair,
  sectionNumberInputClass,
  sectionNumberLabelClass,
} from '@/components/erp/DocumentSectionNumberPair';

type Props = {
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  onTypeChange: (type: SelectableSourceType | '') => void;
  onHydrate: (payload: SourceHydratePayload) => void;
  hasExistingLines: boolean;
  disabled?: boolean;
};

export function InvoiceSourceDocumentControl({
  sourceType,
  sourceId,
  sourceNumber,
  onTypeChange,
  onHydrate,
  hasExistingLines,
  disabled = false,
}: Props) {
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<SourceDocumentListItem | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const selectedType = SOURCE_TYPE_OPTIONS.some((opt) => opt.value === sourceType)
    ? (sourceType as SelectableSourceType)
    : '';

  const { data: docsRes, isFetching } = useApiQuery<SourceDocumentListItem[]>(
    ['invoice-source-documents', selectedType, search],
    '/invoices/sources/documents',
    { type: selectedType, search: search || undefined, page: 1, limit: 20 },
    { enabled: Boolean(selectedType) && !disabled }
  );

  const options = useMemo(
    () =>
      (docsRes?.data ?? []).map((doc) => ({
        value: doc.id,
        label: `${doc.documentNumber} — ${doc.partyName} — ${formatSourceAmount(doc.totalAmount)}`,
        searchText: `${doc.documentNumber} ${doc.partyName}`,
      })),
    [docsRes?.data]
  );

  const applyDocument = async (doc: SourceDocumentListItem) => {
    if (!selectedType) return;
    setLoadingId(doc.id);
    try {
      const res = await apiClient.get<SourceHydratePayload>(
        `/invoices/sources/${selectedType}/${doc.id}`
      );
      if (res.data) onHydrate(res.data);
    } finally {
      setLoadingId(null);
      setPending(null);
    }
  };

  const handleSelect = (id: string) => {
    if (!id) return;
    const doc = (docsRes?.data ?? []).find((row) => row.id === id);
    if (!doc) return;
    if (hasExistingLines) {
      setPending(doc);
      return;
    }
    void applyDocument(doc);
  };

  return (
    <div className="flex justify-end" data-tour="source-reference">
      <DocumentSectionNumberPair>
        <div className="w-[7.75rem] shrink-0">
          <label className={sectionNumberLabelClass}>القسم</label>
          <select
            className={sectionNumberInputClass}
            disabled={disabled}
            value={selectedType}
            onChange={(e) => {
              const next = e.target.value as SelectableSourceType | '';
              setSearch('');
              setPending(null);
              onTypeChange(next);
            }}
          >
            <option value="">اختر القسم...</option>
            {SOURCE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.icon} {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[12.5rem] min-w-0">
          <label className={sectionNumberLabelClass}>الرقم</label>
          <SearchableCombobox
            value={sourceId}
            valueLabel={sourceNumber || undefined}
            onChange={handleSelect}
            options={options}
            disabled={disabled || !selectedType}
            loading={isFetching || Boolean(loadingId)}
            className={sectionNumberInputClass}
            placeholder={selectedType ? 'بحث برقم أو اسم…' : 'اختر القسم أولاً'}
            emptyMessage="لا توجد مستندات مطابقة"
            onQueryChange={setSearch}
            maxVisible={20}
          />
        </div>
      </DocumentSectionNumberPair>
      <SourceHydrateConfirmDialog
        open={Boolean(pending)}
        sourceLabel={selectedType ? SOURCE_TYPE_LABELS[selectedType] : 'المستند'}
        sourceNumber={pending?.documentNumber ?? ''}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) void applyDocument(pending);
        }}
      />
    </div>
  );
}
