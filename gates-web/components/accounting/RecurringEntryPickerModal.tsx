'use client';

import { useMemo, useState } from 'react';
import { ClipboardList, Search, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { RECURRING_FREQUENCY_LABELS } from '@/lib/accounting/journal-source';

export type RecurringTemplateLine = {
  accountId: string;
  accountName?: string;
  accountCode?: string;
  costCenterId?: string | null;
  costCenterName?: string | null;
  description?: string | null;
  debit: number;
  credit: number;
};

export type RecurringTemplate = {
  id: string;
  templateNameAr: string;
  frequency: string;
  notes?: string | null;
  totalAmount: number;
  lines: RecurringTemplateLine[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (template: RecurringTemplate) => void;
};

function formatAmount(value: number) {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function RecurringEntryPickerModal({ open, onClose, onApply }: Props) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useApiQuery<RecurringTemplate[]>(
    ['recurring-journal-entries', search],
    '/accounting/recurring-entries',
    search.trim() ? { search: search.trim() } : undefined,
    { enabled: open }
  );

  const templates = useMemo(() => data?.data ?? [], [data?.data]);
  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return templates;
    return templates.filter((t) => t.templateNameAr.includes(q) || (t.notes ?? '').includes(q));
  }, [templates, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 px-4" dir="rtl">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-picker-title"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-purple-600" aria-hidden />
            <h2 id="recurring-picker-title" className="text-base font-bold text-slate-900">
              استدعاء قيد دوري
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم القيد الدوري…"
              className="w-full rounded-lg border border-slate-200 py-2 pr-9 pl-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-slate-500">جاري تحميل القوالب…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              لا توجد قيود دورية محفوظة حالياً.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-right text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">اسم القيد الدوري</th>
                  <th className="px-3 py-2 font-semibold">التكرار</th>
                  <th className="px-3 py-2 font-semibold">الملاحظات</th>
                  <th className="px-3 py-2 font-semibold">إجمالي القيمة</th>
                  <th className="px-3 py-2 font-semibold">عدد السطور</th>
                  <th className="px-3 py-2 font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((template) => {
                  const expanded = expandedId === template.id;
                  return (
                    <tr key={template.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2" colSpan={6}>
                        <button
                          type="button"
                          className="grid w-full grid-cols-6 items-center gap-2 text-right hover:bg-slate-50"
                          onClick={() => setExpandedId(expanded ? null : template.id)}
                        >
                          <span className="font-medium text-slate-800">{template.templateNameAr}</span>
                          <span>{RECURRING_FREQUENCY_LABELS[template.frequency] ?? template.frequency}</span>
                          <span className="truncate text-slate-500">{template.notes || '—'}</span>
                          <span className="font-mono">{formatAmount(template.totalAmount)}</span>
                          <span>{template.lines?.length ?? 0}</span>
                          <span className="text-xs text-purple-700">
                            {expanded ? 'إخفاء السطور' : 'معاينة السطور'}
                          </span>
                        </button>
                        {expanded ? (
                          <div className="mt-2 rounded-lg border border-purple-100 bg-purple-50/50 p-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-500">
                                  <th className="py-1 text-right">الحساب</th>
                                  <th className="py-1 text-right">مركز التكلفة</th>
                                  <th className="py-1 text-right">الشرح</th>
                                  <th className="py-1 text-center">مدين</th>
                                  <th className="py-1 text-center">دائن</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(template.lines ?? []).map((line, idx) => (
                                  <tr key={`${template.id}-${idx}`} className="border-t border-purple-100">
                                    <td className="py-1">
                                      {line.accountCode ? `[${line.accountCode}] ` : ''}
                                      {line.accountName || line.accountId}
                                    </td>
                                    <td className="py-1">{line.costCenterName || '—'}</td>
                                    <td className="py-1">{line.description || '—'}</td>
                                    <td className="py-1 text-center font-mono">{formatAmount(line.debit)}</td>
                                    <td className="py-1 text-center font-mono">{formatAmount(line.credit)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="mt-3 flex justify-end">
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  onApply(template);
                                  onClose();
                                }}
                              >
                                ✓ استدعاء البيانات في القيد
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
