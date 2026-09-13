'use client';

import { useMemo, useState } from 'react';
import { useApiMutation } from '@/lib/hooks/useApi';
import { parseSheetMatrix } from '@/lib/import/excelRowMapper';
import { parseExcelMatrixInWorker } from '@/lib/workers/computeBridge';

type Entity = 'CUSTOMERS' | 'ITEMS' | 'SUPPLIERS';

export function ExcelImporterStep({
  onImported,
  onError,
  apiPath = '/onboarding/import-excel',
}: {
  onImported: (summary: string) => void;
  onError: (msg: string) => void;
  apiPath?: string;
}) {
  const [entity, setEntity] = useState<Entity>('ITEMS');
  const [preview, setPreview] = useState<Record<string, string | number | null>[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string | number | null>[]>([]);
  const [fileName, setFileName] = useState('');

  const importMut = useApiMutation<
    { created: number; total: number },
    { entity: Entity; rows: Record<string, unknown>[]; openingStock?: boolean }
  >(apiPath, 'POST', { showSuccessToast: true, successMessage: 'تم الاستيراد' });

  const downloadTemplate = async () => {
    const { utils, writeFile } = await import(/* webpackChunkName: "xlsx" */ 'xlsx');
    const sheets: Record<string, string[][]> = {
      ITEMS: [
        ['اسم الصنف', 'باركود', 'سعر البيع', 'كمية افتتاحية'],
        ['صنف تجريبي', '1001', '150', '10'],
      ],
      CUSTOMERS: [
        ['اسم العميل', 'موبايل', 'رصيد افتتاحي'],
        ['عميل تجريبي', '01000000000', '500'],
      ],
      SUPPLIERS: [
        ['اسم المورد', 'موبايل', 'رصيد افتتاحي'],
        ['مورد تجريبي', '01000000001', '200'],
      ],
    };
    const ws = utils.aoa_to_sheet(sheets[entity]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, entity);
    writeFile(wb, `gates-onboarding-${entity.toLowerCase()}.xlsx`);
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    const XLSX = await import(/* webpackChunkName: "xlsx" */ 'xlsx');
    const { read, utils } = XLSX;
    const buf = await file.arrayBuffer();
    const wb = read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    if (rows.length < 2) {
      onError('الملف فارغ أو بدون صف عناوين');
      return;
    }
    let mapped: Record<string, string | number | null>[];
    try {
      mapped = await parseExcelMatrixInWorker(rows as unknown[][]);
    } catch {
      mapped = parseSheetMatrix(rows as unknown[][]);
    }
    mapped = mapped.filter((r) => r.arabicName);
    setAllRows(mapped);
    setPreview(mapped.slice(0, 8));
  };

  const submit = async () => {
    if (!allRows.length) {
      onError('ارفع ملف Excel أولاً');
      return;
    }
    try {
      const res = await importMut.mutateAsync({
        entity,
        rows: allRows as Record<string, unknown>[],
        openingStock: entity === 'ITEMS',
      });
      const d = res.data;
      onImported(`تم استيراد ${d?.created ?? 0} من ${d?.total ?? allRows.length}`);
      setPreview([]);
      setAllRows([]);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'فشل الاستيراد');
    }
  };

  const hint = useMemo(
    () =>
      entity === 'ITEMS'
        ? 'مثال: اسم الصنف، البarcode، السعر، الكمية'
        : entity === 'SUPPLIERS'
          ? 'مثال: اسم المورد، الموبايل، الرصيد الافتتاحي'
          : 'مثال: اسم العميل، الموبايل، الرصيد الافتتاحي',
    [entity]
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        اسحب ملف Excel أو CSV — نطابق الأعمدة تلقائياً ({hint}).
      </p>
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={entity === 'ITEMS'} onChange={() => setEntity('ITEMS')} /> أصناف
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={entity === 'CUSTOMERS'} onChange={() => setEntity('CUSTOMERS')} /> عملاء
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={entity === 'SUPPLIERS'} onChange={() => setEntity('SUPPLIERS')} /> موردون
        </label>
        <button
          type="button"
          onClick={() => void downloadTemplate()}
          className="mr-auto text-sm text-[#0E79AA] underline"
        >
          تنزيل قالب Excel
        </button>
      </div>
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#0E79AA]/40 rounded-xl p-8 cursor-pointer bg-[#F6FBFD] hover:bg-[#EEF7FB]">
        <span className="text-[#0E79AA] font-medium">إفلات الملف هنا أو انقر للاختيار</span>
        {fileName ? <span className="text-xs text-gray-500 mt-2">{fileName}</span> : null}
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </label>
      {preview.length > 0 ? (
        <div className="text-xs text-gray-600">
          <p className="font-medium mb-1">معاينة ({preview.length} صفوف):</p>
          <ul className="list-disc pr-4">
            {preview.map((r, i) => (
              <li key={i}>{String(r.arabicName)} {r.price != null ? `— ${r.price}` : ''}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        disabled={importMut.isPending || allRows.length === 0}
        onClick={() => void submit()}
        className="w-full py-2.5 bg-[#0E79AA] text-white rounded-lg font-medium disabled:opacity-50"
      >
        {importMut.isPending ? 'جاري الاستيراد…' : 'استيراد إلى النظام'}
      </button>
    </div>
  );
}
