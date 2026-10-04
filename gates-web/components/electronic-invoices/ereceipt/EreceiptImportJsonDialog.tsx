'use client';

import { useState } from 'react';
import apiClient from '@/lib/api/client';

type Props = { open: boolean; onClose: () => void };

export function EreceiptImportJsonDialog({ open, onClose }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<{
    ok: boolean;
    errorsAr: string[];
    preview: Record<string, unknown> | null;
    allowSubmit: false;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const validate = async () => {
    setBusy(true);
    setResult(null);
    try {
      const parsed = JSON.parse(text) as unknown;
      const res = await apiClient.post<{
        ok: boolean;
        errorsAr: string[];
        preview: Record<string, unknown> | null;
        allowSubmit: false;
      }>('/electronic-receipts/import/validate', { document: parsed });
      setResult(res.data ?? null);
    } catch (err) {
      setResult({
        ok: false,
        errorsAr: [err instanceof Error ? err.message : 'JSON غير صالح'],
        preview: null,
        allowSubmit: false,
      });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File) => {
    const raw = await file.text();
    setText(raw);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-4">
        <h2 className="text-lg font-bold">استيراد JSON (متقدم)</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          للتحقق والمعاينة فقط. لا يمكن إرسال JSON مستورد عبر Gates لأنه قد يكسر سلسلة previousUUID أو نطاق الشركة.
        </p>
        <input
          type="file"
          accept=".json,application/json"
          className="mt-3 text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <textarea
          className="mt-2 h-40 w-full rounded border p-2 font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="أو الصق JSON هنا"
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => void validate()}
        >
          تحقق من البنية
        </button>
        {result && (
          <div className="mt-3 text-sm">
            {result.ok ? <p className="text-emerald-800">✓ البنية مقبولة للمعاينة</p> : null}
            {result.errorsAr.map((e) => (
              <p key={e} className="text-rose-700">✗ {e}</p>
            ))}
            {result.preview ? (
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-xs">
                {JSON.stringify(result.preview, null, 2)}
              </pre>
            ) : null}
          </div>
        )}
        <button type="button" className="mt-3 text-sm text-brand underline" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  );
}
