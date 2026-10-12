'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import {
  SOURCE_TYPE_LABELS,
  formatSourceAmount,
  type SourceDocumentListItem,
  type SourceHydratePayload,
} from '@/lib/invoices/sourceDocument';
import {
  MULTI_STOCK_PERMIT_SOURCE_TYPES,
  type MultiSourceLineMode,
  type MultiStockPermitHydrateRequest,
  type MultiStockPermitSourceType,
} from '@/lib/invoices/multi-source-hydrate';

export type { MultiStockPermitHydrateRequest };

type Props = {
  disabled?: boolean;
  hasExistingLines: boolean;
  onApply: (request: MultiStockPermitHydrateRequest) => void | Promise<void>;
  /** Default: إذن صرف + إذن إضافة — على فاتورة المبيعات/المشتريات يُقيَّد لنوع واحد. */
  permitTypes?: readonly MultiStockPermitSourceType[];
};

export function MultiStockPermitLoadControl({
  disabled = false,
  hasExistingLines,
  onApply,
  permitTypes = MULTI_STOCK_PERMIT_SOURCE_TYPES,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'pick' | 'options'>('pick');
  const [sourceType, setSourceType] = useState<MultiStockPermitSourceType>(
    permitTypes[0] ?? 'DELIVERY_NOTE'
  );
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lineMode, setLineMode] = useState<MultiSourceLineMode>('merge_similar');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: docsRes, isFetching } = useApiQuery<SourceDocumentListItem[]>(
    ['invoice-source-documents-multi', sourceType, search],
    '/invoices/sources/documents',
    { type: sourceType, search: search || undefined, page: 1, limit: 200 },
    { enabled: open && !disabled }
  );

  const docs = docsRes?.data ?? [];

  const selectedDocs = useMemo(
    () => docs.filter((doc) => selectedIds.includes(doc.id)),
    [docs, selectedIds]
  );

  const reset = () => {
    setStep('pick');
    setSelectedIds([]);
    setSearch('');
    setLineMode('merge_similar');
    setReplaceExisting(false);
    setError('');
    setLoading(false);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const runLoad = async () => {
    if (!selectedIds.length) return;
    setLoading(true);
    setError('');
    try {
      const payloads: SourceHydratePayload[] = [];
      for (const id of selectedIds) {
        const res = await apiClient.get<SourceHydratePayload>(
          `/invoices/sources/${sourceType}/${id}`
        );
        if (res.data) payloads.push(res.data);
      }
      if (!payloads.length) {
        setError('تعذر قراءة بنود المستندات المختارة');
        return;
      }
      await onApply({ payloads, lineMode, replaceExisting });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل المستندات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={formActionButtonClass}
        disabled={disabled}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        تحميل متعدد (إضافة / صرف)
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/40 px-4" dir="rtl">
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[min(32rem,90vh)] w-full max-w-lg flex-col rounded-2xl border border-[#D6EAF3] bg-white shadow-xl"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-[#0A3D5E]">
                {step === 'pick' ? 'تحميل متعدد — إذن إضافة / إذن صرف' : 'طريقة إدراج الأصناف'}
              </h2>
              {step === 'pick' ? (
                <p className="mt-1 text-xs text-slate-500">
                  اختر نوع المستند ثم حدّد أكثر من إذن، ثم اضغط متابعة.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  {selectedDocs.length} مستند:{' '}
                  {selectedDocs.map((d) => d.documentNumber).join('، ')}
                </p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
              {step === 'pick' ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">نوع المستند</label>
                    <select
                      className="w-full rounded-lg border border-[#D6EAF3] px-3 py-2 text-sm"
                      value={sourceType}
                      onChange={(e) => {
                        setSourceType(e.target.value as MultiStockPermitSourceType);
                        setSelectedIds([]);
                      }}
                    >
                      {permitTypes.map((t) => (
                        <option key={t} value={t}>
                          {SOURCE_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">بحث</label>
                    <input
                      className="w-full rounded-lg border border-[#D6EAF3] px-3 py-2 text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="رقم أو اسم…"
                    />
                  </div>
                  <div className="rounded-lg border border-slate-100">
                    {isFetching ? (
                      <p className="p-3 text-sm text-slate-500">جاري التحميل…</p>
                    ) : docs.length === 0 ? (
                      <p className="p-3 text-sm text-slate-500">لا توجد مستندات</p>
                    ) : (
                      <ul className="max-h-52 divide-y divide-slate-50 overflow-auto">
                        {docs.map((doc) => {
                          const on = selectedIds.includes(doc.id);
                          return (
                            <li key={doc.id}>
                              <label className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={on}
                                  onChange={() => toggleId(doc.id)}
                                />
                                <span className="text-sm text-slate-800">
                                  <span className="font-mono font-medium">{doc.documentNumber}</span>
                                  <span className="text-slate-500"> — {doc.partyName}</span>
                                  <span className="text-slate-400"> ({formatSourceAmount(doc.totalAmount)})</span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-slate-700">البنود من المستندات</legend>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 p-3">
                      <input
                        type="radio"
                        name="lineMode"
                        checked={lineMode === 'merge_similar'}
                        onChange={() => setLineMode('merge_similar')}
                      />
                      <span className="text-sm">
                        <span className="font-medium">دمج الأصناف المتشابهة</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          نفس الصنف والوحدة يُجمع في سطر واحد (الكميات تُجمع).
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 p-3">
                      <input
                        type="radio"
                        name="lineMode"
                        checked={lineMode === 'separate'}
                        onChange={() => setLineMode('separate')}
                      />
                      <span className="text-sm">
                        <span className="font-medium">أصناف منفردة</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          كل سطر من كل إذن يبقى منفصلاً حتى لو تكرر الصنف.
                        </span>
                      </span>
                    </label>
                  </fieldset>
                  {hasExistingLines ? (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium text-slate-700">السطور الحالية</legend>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={!replaceExisting}
                          onChange={() => setReplaceExisting(false)}
                        />
                        إضافة إلى السطور الحالية
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={replaceExisting}
                          onChange={() => setReplaceExisting(true)}
                        />
                        استبدال السطور الحالية
                      </label>
                    </fieldset>
                  ) : null}
                </div>
              )}
              {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                onClick={() => (step === 'options' ? setStep('pick') : close())}
                disabled={loading}
              >
                {step === 'options' ? 'رجوع' : 'إلغاء'}
              </button>
              {step === 'pick' ? (
                <button
                  type="button"
                  className="rounded-lg bg-[#0E78AA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c6a96] disabled:opacity-50"
                  disabled={selectedIds.length === 0}
                  onClick={() => setStep('options')}
                >
                  متابعة ({selectedIds.length})
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-lg bg-[#0E78AA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c6a96] disabled:opacity-50"
                  disabled={loading}
                  onClick={() => void runLoad()}
                >
                  {loading ? 'جاري التحميل…' : 'تحميل'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
