'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Printer, Search, Sparkles, CheckSquare, Square } from 'lucide-react';
import { useApiMutation } from '@/lib/hooks/useApi';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  BULK_PRINT_UNITS,
  DEFAULT_BULK_PRINT_UNIT_IDS,
  type BulkPrintUnitId,
} from '@/lib/operations/bulk-print-units';
import { runBulkPrintJob, type BulkPrintRenderItem } from '@/lib/print/runBulkPrintJob';
import { useApiQuery } from '@/lib/hooks/useApi';

type BulkPrintHit = {
  unitId: BulkPrintUnitId;
  documentId: string;
  serial: string | null;
  date: string;
  title: string;
  subtitle: string | null;
  isPosted: boolean;
  isCancelled: boolean;
};

type FiscalYearRow = { startDate: string; endDate: string; status?: string; code?: string };

function isoDateOnly(v?: string) {
  return v ? v.slice(0, 10) : '';
}

export default function BulkPrintSettingsPage() {
  useBackendReachability();
  const { profile: companyProfile } = useCompanyPrintProfile();

  const [units, setUnits] = useState<Set<BulkPrintUnitId>>(() => new Set(DEFAULT_BULK_PRINT_UNIT_IDS));
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [serialFrom, setSerialFrom] = useState('');
  const [serialTo, setSerialTo] = useState('');
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [postedOnly, setPostedOnly] = useState(false);
  const [draftOnly, setDraftOnly] = useState(false);
  const [hits, setHits] = useState<BulkPrintHit[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: fiscalYearsRes } = useApiQuery<FiscalYearRow[]>(
    ['company-fiscal-years', 'bulk-print'],
    '/company/fiscal-years',
    { page: 1, limit: 50 }
  );

  const openFiscalYear = useMemo(() => {
    const rows = Array.isArray(fiscalYearsRes?.data) ? fiscalYearsRes.data : [];
    const openRows = rows.filter((y) => (y.status ?? '').toLowerCase() !== 'close');
    const today = new Date().toISOString().slice(0, 10);
    return (
      openRows.find((y) => {
        const f = isoDateOnly(y.startDate);
        const t = isoDateOnly(y.endDate);
        return f && t && f <= today && today <= t;
      }) ?? openRows[0]
    );
  }, [fiscalYearsRes?.data]);

  const openFrom = isoDateOnly(openFiscalYear?.startDate);
  const openTo = isoDateOnly(openFiscalYear?.endDate);

  const searchMutation = useApiMutation<
    { hits: BulkPrintHit[]; total: number },
    Record<string, unknown>
  >('/print-tools/bulk-print/search', 'POST', {
    onSuccess: (res) => {
      const list = res.data?.hits ?? [];
      setHits(list);
      setSelected(new Set(list.map((h) => `${h.unitId}:${h.documentId}`)));
      setSuccess(`تم العثور على ${list.length} مستند`);
      setError('');
    },
    onError: (e: { message?: string }) => {
      setError(e?.message || 'فشل البحث');
      setSuccess('');
    },
  });

  const renderMutation = useApiMutation<
    { items: BulkPrintRenderItem[] },
    { items: Array<{ unitId: BulkPrintUnitId; documentId: string }> }
  >('/print-tools/bulk-print/render', 'POST');

  const toggleUnit = (id: BulkPrintUnitId) => {
    setUnits((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleAllUnits = (on: boolean) => {
    setUnits(on ? new Set(DEFAULT_BULK_PRINT_UNIT_IDS) : new Set());
  };

  const rowKey = (h: BulkPrintHit) => `${h.unitId}:${h.documentId}`;

  const toggleRow = (key: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const runSearch = () => {
    setError('');
    setSuccess('');
    searchMutation.mutate({
      operationUnits: Array.from(units),
      fromDate: fromDate || openFrom || undefined,
      toDate: toDate || openTo || undefined,
      serialFrom: serialFrom.trim() || undefined,
      serialTo: serialTo.trim() || undefined,
      includeCancelled,
      postedOnly,
      draftOnly,
      limit: 100,
    });
  };

  const runPrint = async () => {
    const picked = hits.filter((h) => selected.has(rowKey(h)));
    if (!picked.length) {
      setError('حدّد مستنداً واحداً على الأقل');
      return;
    }
    setPrinting(true);
    setPrintProgress('');
    setError('');
    try {
      const batches: typeof picked[] = [];
      for (let i = 0; i < picked.length; i += 50) {
        batches.push(picked.slice(i, i + 50));
      }
      const allItems: BulkPrintRenderItem[] = [];
      for (const batch of batches) {
        const res = await renderMutation.mutateAsync({
          items: batch.map((h) => ({ unitId: h.unitId, documentId: h.documentId })),
        });
        allItems.push(...(res.data?.items ?? []));
      }
      await runBulkPrintJob(allItems, companyProfile, (i, total) => {
        setPrintProgress(`${i} / ${total}`);
      });
      setSuccess(`تم فتح طباعة ${allItems.length} مستند`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل الطباعة');
    } finally {
      setPrinting(false);
      setPrintProgress('');
    }
  };

  const busy = searchMutation.isPending || printing;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/80 to-indigo-50/40"
      dir="rtl"
    >
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-l from-[#0E78AA] to-[#094C6B] px-6 py-8 text-white shadow-xl">
          <div className="absolute -left-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sky-100 text-sm font-medium mb-2">
                <Sparkles className="h-4 w-4" />
                الإعدادات
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">مركز الطباعة الجماعية</h1>
              <p className="mt-2 max-w-xl text-sm text-sky-100/90 leading-relaxed">
                ابحث عن مستندات متعددة (فواتير، قيود، سندات، مخزون…) حسب التاريخ والمسلسل والشاشة،
                ثم اطبعها دفعة واحدة.
              </p>
            </div>
            <Printer className="h-14 w-14 opacity-30 shrink-0 hidden sm:block" />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm space-y-4">
            <h2 className="font-bold text-[#094C6B] flex items-center gap-2">
              <Search className="h-5 w-5 text-[#0E78AA]" />
              فلاتر البحث
            </h2>

            {openFiscalYear ? (
              <p className="text-xs text-slate-500 rounded-lg bg-slate-50 px-3 py-2">
                السنة المفتوحة: {openFrom} → {openTo}
                {openFiscalYear.code ? ` (${openFiscalYear.code})` : ''}
              </p>
            ) : null}

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="font-semibold text-slate-700">من تاريخ</span>
                <input
                  type="date"
                  min={openFrom}
                  max={openTo}
                  value={fromDate || openFrom}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-2"
                  disabled={busy}
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700">إلى تاريخ</span>
                <input
                  type="date"
                  min={openFrom}
                  max={openTo}
                  value={toDate || openTo}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-2"
                  disabled={busy}
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700">من مسلسل</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000001"
                  value={serialFrom}
                  onChange={(e) => setSerialFrom(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 font-mono"
                  disabled={busy}
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700">إلى مسلسل</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000099"
                  value={serialTo}
                  onChange={(e) => setSerialTo(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 font-mono"
                  disabled={busy}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={postedOnly}
                  onChange={(e) => {
                    setPostedOnly(e.target.checked);
                    if (e.target.checked) setDraftOnly(false);
                  }}
                  disabled={busy}
                />
                مرحّل فقط
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftOnly}
                  onChange={(e) => {
                    setDraftOnly(e.target.checked);
                    if (e.target.checked) setPostedOnly(false);
                  }}
                  disabled={busy}
                />
                مسودة فقط
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCancelled}
                  onChange={(e) => setIncludeCancelled(e.target.checked)}
                  disabled={busy}
                />
                تضمين الملغى
              </label>
            </div>

            <button
              type="button"
              onClick={runSearch}
              disabled={busy || units.size === 0}
              className="w-full sm:w-auto px-6 h-11 rounded-xl bg-[#0E78AA] text-white font-semibold hover:bg-[#0A5F8A] disabled:opacity-50"
            >
              {searchMutation.isPending ? 'جاري البحث…' : 'بحث'}
            </button>
          </section>

          <aside className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm max-h-[520px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-[#094C6B] text-sm">الشاشات</span>
              <button
                type="button"
                className="text-xs text-[#0E78AA] font-semibold"
                onClick={() => toggleAllUnits(units.size !== DEFAULT_BULK_PRINT_UNIT_IDS.length)}
                disabled={busy}
              >
                {units.size === DEFAULT_BULK_PRINT_UNIT_IDS.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
              {BULK_PRINT_UNITS.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-sky-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={units.has(u.id)}
                    onChange={() => toggleUnit(u.id)}
                    disabled={busy}
                  />
                  {u.label}
                </label>
              ))}
            </div>
            <Link
              href="/settings/document-layout"
              className="mt-3 text-xs text-[#0E78AA] font-medium hover:underline"
            >
              تخصيص قوالب الطباعة →
            </Link>
          </aside>
        </div>

        <section className="rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h2 className="font-bold text-[#094C6B]">النتائج ({hits.length})</h2>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!hits.length || busy}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200"
                onClick={() => setSelected(new Set(hits.map(rowKey)))}
              >
                تحديد الكل
              </button>
              <button
                type="button"
                disabled={!selected.size || busy}
                onClick={() => void runPrint()}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                {printing ? `طباعة… ${printProgress}` : `طباعة (${selected.size})`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-right text-slate-600">
                  <th className="p-2 w-10" />
                  <th className="p-2">النوع</th>
                  <th className="p-2">المسلسل</th>
                  <th className="p-2">التاريخ</th>
                  <th className="p-2">البيان</th>
                  <th className="p-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {hits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      نفّذ بحثاً لعرض المستندات
                    </td>
                  </tr>
                ) : (
                  hits.map((h) => {
                    const key = rowKey(h);
                    const on = selected.has(key);
                    return (
                      <tr key={key} className="border-t border-slate-50 hover:bg-sky-50/50">
                        <td className="p-2">
                          <button type="button" onClick={() => toggleRow(key)} aria-label="تحديد">
                            {on ? (
                              <CheckSquare className="h-5 w-5 text-[#0E78AA]" />
                            ) : (
                              <Square className="h-5 w-5 text-slate-300" />
                            )}
                          </button>
                        </td>
                        <td className="p-2 font-medium">{h.title}</td>
                        <td className="p-2 font-mono text-xs">{h.serial ?? '—'}</td>
                        <td className="p-2">{h.date}</td>
                        <td className="p-2 text-slate-600 truncate max-w-[200px]">{h.subtitle ?? '—'}</td>
                        <td className="p-2">
                          {h.isCancelled ? (
                            <span className="text-rose-600">ملغى</span>
                          ) : h.isPosted ? (
                            <span className="text-emerald-700">مرحّل</span>
                          ) : (
                            <span className="text-amber-700">مسودة</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}
