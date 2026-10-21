'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { CATALOG_KIND_AR } from '@/components/contracting/tender/tender-labels';
import {
  commitWorkItemCatalogExcel,
  downloadWorkItemCatalogTemplate,
  validateWorkItemCatalogExcel,
  type WorkItemCatalogImportRow,
} from '@/lib/contracting/work-item-catalog-excel';
import type { ExcelValidatedRow, ExcelValidationReport } from '@/lib/contracting/excel-types';
import { formatEgp, formatQty } from '@/lib/subcontracts/money';
import { cn } from '@/lib/utils';

const MAX_BYTES = 15 * 1024 * 1024;

export function WorkItemCatalogExcelModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [report, setReport] = useState<ExcelValidationReport<WorkItemCatalogImportRow> | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const validateMut = useMutation({
    mutationFn: (file: File) => validateWorkItemCatalogExcel(file),
    onSuccess: (data) => {
      setReport(data);
      setLocalError(null);
    },
    onError: (error: Error) => setLocalError(error.message),
  });

  const commitMut = useMutation({
    mutationFn: async () => {
      const valid = (report?.rows ?? []).filter((row) => row.isValid).map((row) => row.data);
      if (!valid.length) throw new Error('لا توجد سطور سليمة للاستيراد');
      return commitWorkItemCatalogExcel(valid);
    },
    onSuccess: (result) => {
      notifyApiSuccess(`تم استيراد ${result.total} بنداً (${result.created} جديد / ${result.updated} محدّث)`);
      onImported();
      resetAndClose();
    },
    onError: (error: Error) => setLocalError(error.message),
  });

  const visibleRows = useMemo(() => {
    const rows = report?.rows ?? [];
    return errorsOnly ? rows.filter((row) => !row.isValid) : rows;
  }, [errorsOnly, report]);

  if (!open) return null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setLocalError('حجم الملف يتجاوز 15 ميجابايت');
      return;
    }
    setFileName(file.name);
    setReport(null);
    validateMut.mutate(file);
  }

  function resetAndClose() {
    setFileName('');
    setReport(null);
    setLocalError(null);
    setErrorsOnly(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col space-y-4 overflow-hidden rounded-xl bg-white p-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0E78AA]">استيراد بنود الأعمال من Excel</h2>
            <p className="text-xs text-slate-500">نزّل القالب، املأه، ثم ارفعه. الحد 5,000 سطر / 15 ميجابايت.</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            iconStart={<Download className="h-4 w-4" />}
            onClick={() => downloadWorkItemCatalogTemplate().catch((error: Error) => setLocalError(error.message))}
          >
            تنزيل القالب
          </Button>
        </div>

        <label
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition',
            dragOver ? 'border-[#0E78AA] bg-[#F0F7FB]' : 'border-[#D6EAF3] bg-[#F6FBFD]'
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            void onFile(event.dataTransfer.files[0]);
          }}
        >
          <Upload className="mb-2 h-8 w-8 text-[#0E78AA]" />
          <p className="text-sm font-semibold text-[#094C6B]">اسحب ملف Excel هنا أو اضغط للاختيار</p>
          <p className="mt-1 text-xs text-slate-500">.xlsx / .csv</p>
          {fileName ? (
            <p className="mt-2 flex items-center gap-1 text-xs text-[#0E78AA]">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {fileName}
            </p>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </label>

        {localError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{localError}</p> : null}
        {validateMut.isPending ? (
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#0E78AA]" />
          </div>
        ) : null}

        {report ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                إجمالي السطور {report.totalRows}
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                سطور سليمة {report.validRowsCount}
              </span>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                سطور بها أخطاء {report.invalidRowsCount}
              </span>
              <label className="ms-auto flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={errorsOnly} onChange={(event) => setErrorsOnly(event.target.checked)} />
                عرض السطور التي بها أخطاء فقط
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[#E6F0F7]">
              <PreviewTable rows={visibleRows} />
            </div>
          </>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={resetAndClose}>
            إلغاء
          </Button>
          <Button
            isLoading={commitMut.isPending}
            disabled={!report?.validRowsCount || validateMut.isPending}
            onClick={() => commitMut.mutate()}
          >
            استيراد السطور السليمة
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreviewTable({ rows }: { rows: ExcelValidatedRow<WorkItemCatalogImportRow>[] }) {
  if (rows.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-500">لا توجد سطور للعرض</p>;
  }
  return (
    <table className="w-full min-w-[880px] text-center text-sm">
      <thead>
        <tr className="bg-[#F6FBFD] text-[#094C6B]">
          <th className="px-2 py-2">#</th>
          <th className="px-2 py-2">الكود</th>
          <th className="px-2 py-2">البيان</th>
          <th className="px-2 py-2">النوع</th>
          <th className="px-2 py-2">الوحدة</th>
          <th className="px-2 py-2">الكمية</th>
          <th className="px-2 py-2">السعر</th>
          <th className="px-2 py-2">الخطأ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.rowNumber}
            className={cn('border-t border-slate-100', !row.isValid && 'bg-red-50/80')}
            title={row.errors.join(' — ')}
          >
            <td className="px-2 py-2 tabular-nums">{row.rowNumber}</td>
            <td className="px-2 py-2">{row.data.itemCode}</td>
            <td className="px-2 py-2 text-right">{row.data.descriptionAr}</td>
            <td className="px-2 py-2">{CATALOG_KIND_AR[row.data.kind] ?? row.data.kind}</td>
            <td className="px-2 py-2">{row.data.unit}</td>
            <td className="px-2 py-2 tabular-nums">{formatQty(row.data.quantity)}</td>
            <td className="px-2 py-2 tabular-nums">{formatEgp(row.data.unitPrice)}</td>
            <td className="px-2 py-2 text-right text-xs text-red-700">{row.errors.join(' · ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
