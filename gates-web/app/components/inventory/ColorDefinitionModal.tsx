'use client';

import { useEffect, useState } from 'react';
import { Button, CompactFormField, ColorField } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useInvalidateQuery } from '@/lib/hooks/useApi';

export type ClothingColor = {
  id: string;
  serial?: string | null;
  arabicName: string;
  englishName?: string | null;
  hex?: string | null;
};

const empty = () => ({ serial: '', arabicName: '', englishName: '', hex: '#0E78AA' });

export function ColorDefinitionModal({
  open,
  onClose,
  colors,
}: {
  open: boolean;
  onClose: () => void;
  colors: ClothingColor[];
}) {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setForm(empty());
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const pick = (row: ClothingColor) => {
    setSelectedId(row.id);
    setForm({
      serial: row.serial ?? '',
      arabicName: row.arabicName,
      englishName: row.englishName ?? '',
      hex: row.hex || '#0E78AA',
    });
    setError('');
  };

  const save = async () => {
    if (!form.arabicName.trim()) {
      setError('الاسم العربي مطلوب');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        serial: form.serial || null,
        arabicName: form.arabicName.trim(),
        englishName: form.englishName || null,
        hex: form.hex || null,
      };
      if (selectedId) {
        await apiClient.put(`/inventory/clothing-matrix/colors/${selectedId}`, body);
      } else {
        const res = await apiClient.post<ClothingColor>('/inventory/clothing-matrix/colors', body);
        if (res.data?.id) setSelectedId(res.data.id);
      }
      invalidateQuery(['clothing-colors']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    try {
      await apiClient.delete(`/inventory/clothing-matrix/colors/${selectedId}`);
      setSelectedId(null);
      setForm(empty());
      invalidateQuery(['clothing-colors']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" dir="rtl" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E6F0F7] px-5 py-3">
          <h2 className="text-lg font-bold text-[#0A3D5E]">تعريف الألوان</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="إغلاق">
            ✕
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto p-5 md:grid-cols-[220px_1fr]">
          <div className="space-y-1 rounded-xl border border-[#E6F0F7] p-2">
            {colors.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right text-sm ${
                  selectedId === c.id ? 'bg-[#E8F4FA] text-[#0E78AA]' : 'hover:bg-[#F6FBFD]'
                }`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded border border-[#D6EAF3]"
                  style={{ backgroundColor: c.hex || '#ccc' }}
                />
                {c.arabicName}
              </button>
            ))}
            {!colors.length ? <p className="p-2 text-xs text-slate-400">لا توجد ألوان بعد</p> : null}
          </div>
          <div className="space-y-3">
            <CompactFormField
              label="المسلسل"
              value={form.serial}
              onChange={(e) => setForm((p) => ({ ...p, serial: e.target.value }))}
            />
            <CompactFormField
              label="الاسم العربي"
              required
              value={form.arabicName}
              onChange={(e) => setForm((p) => ({ ...p, arabicName: e.target.value }))}
            />
            <CompactFormField
              label="الاسم الإنجليزي"
              value={form.englishName}
              onChange={(e) => setForm((p) => ({ ...p, englishName: e.target.value }))}
            />
            <ColorField label="اللون" value={form.hex} onChange={(hex) => setForm((p) => ({ ...p, hex }))} />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E6F0F7] px-5 py-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedId(null);
                setForm(empty());
              }}
            >
              جديد
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={!selectedId} onClick={() => void remove()}>
              حذف
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              تراجع
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              حفظ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
