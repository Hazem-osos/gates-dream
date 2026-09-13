'use client';

import { useEffect, useState } from 'react';
import { Button, CompactFormField } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useInvalidateQuery } from '@/lib/hooks/useApi';

export type ClothingSize = {
  id: string;
  serial?: string | null;
  arabicName: string;
  englishName?: string | null;
  sortOrder?: number;
};

const empty = () => ({ serial: '', arabicName: '', englishName: '', sortOrder: '' });

export function SizeDefinitionModal({
  open,
  onClose,
  sizes,
}: {
  open: boolean;
  onClose: () => void;
  sizes: ClothingSize[];
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

  const pick = (row: ClothingSize) => {
    setSelectedId(row.id);
    setForm({
      serial: row.serial ?? '',
      arabicName: row.arabicName,
      englishName: row.englishName ?? '',
      sortOrder: row.sortOrder != null ? String(row.sortOrder) : '',
    });
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
        sortOrder: form.sortOrder ? parseInt(form.sortOrder, 10) : 0,
      };
      if (selectedId) {
        await apiClient.put(`/inventory/clothing-matrix/sizes/${selectedId}`, body);
      } else {
        const res = await apiClient.post<ClothingSize>('/inventory/clothing-matrix/sizes', body);
        if (res.data?.id) setSelectedId(res.data.id);
      }
      invalidateQuery(['clothing-sizes']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    try {
      await apiClient.delete(`/inventory/clothing-matrix/sizes/${selectedId}`);
      setSelectedId(null);
      setForm(empty());
      invalidateQuery(['clothing-sizes']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" dir="rtl" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E6F0F7] px-5 py-3">
          <h2 className="text-lg font-bold text-[#0A3D5E]">تعريف المقاسات</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="إغلاق">
            ✕
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto p-5 md:grid-cols-[220px_1fr]">
          <div className="space-y-1 rounded-xl border border-[#E6F0F7] p-2">
            {sizes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s)}
                className={`w-full rounded-lg px-2 py-1.5 text-right text-sm ${
                  selectedId === s.id ? 'bg-[#E8F4FA] text-[#0E78AA]' : 'hover:bg-[#F6FBFD]'
                }`}
              >
                {s.arabicName}
              </button>
            ))}
            {!sizes.length ? <p className="p-2 text-xs text-slate-400">لا توجد مقاسات بعد</p> : null}
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
            <CompactFormField
              label="الترتيب"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
            />
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
