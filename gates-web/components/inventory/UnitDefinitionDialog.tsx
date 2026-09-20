'use client';

import { useMemo, useState } from 'react';
import { Ruler, Trash2 } from 'lucide-react';
import { Button, CompactFormField, compactControlClass } from '@/components/ui';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { UNIT_CATALOG, findUnitCatalog } from '@/lib/inventory/unit-catalog';
import { confirmAction } from '@/lib/feedback/confirm';
import { queryKeys } from '@/lib/query/query-keys';
import type { ApiError } from '@/lib/api/types';
import type { UnitRow } from '@/components/inventory/UnitsListSection';

type UnitForm = {
  code: string;
  arabicName: string;
  englishName: string;
};

const emptyForm = (): UnitForm => ({
  code: '',
  arabicName: '',
  englishName: '',
});

function formFromRow(row: UnitRow): UnitForm {
  return {
    code: row.code ?? '',
    arabicName: row.arabicName ?? '',
    englishName: row.englishName ?? '',
  };
}

export function UnitDefinitionDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UnitForm>(emptyForm);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { data, refetch } = useApiQuery<UnitRow[]>(
    queryKeys.units({ limit: 200 }),
    '/inventory/units',
    { limit: 200, isActive: true },
    { enabled: open, staleTime: 15_000 }
  );
  const units = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data?.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units;
    return units.filter((row) =>
      `${row.code ?? ''} ${row.arabicName} ${row.englishName ?? ''}`.toLowerCase().includes(q)
    );
  }, [search, units]);

  const patch = (next: Partial<UnitForm>) => setFormData((prev) => ({ ...prev, ...next }));

  const resetNew = () => {
    setSelectedId(null);
    setFormData(emptyForm());
    setError('');
  };

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/units',
    'POST',
    {
      onSuccess: () => {
        invalidateQuery(['units']);
        void refetch();
        resetNew();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر حفظ الوحدة'),
    }
  );

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedId ? `/inventory/units/${selectedId}` : '/inventory/units',
    'PUT',
    {
      onSuccess: () => {
        invalidateQuery(['units']);
        void refetch();
        resetNew();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر تحديث الوحدة'),
    }
  );

  const loading = createMutation.isPending || updateMutation.isPending || deleting;

  const applyCatalog = (code: string) => {
    const item = findUnitCatalog(code);
    if (!item) {
      patch({ code });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      code: item.code,
      arabicName: prev.arabicName || item.arabicName,
      englishName: prev.englishName || item.englishName,
    }));
  };

  const handleSave = () => {
    setError('');
    if (!formData.arabicName.trim()) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }
    const body = {
      code: formData.code.trim() || undefined,
      arabicName: formData.arabicName.trim(),
      englishName: formData.englishName.trim() || undefined,
    };
    if (selectedId) {
      updateMutation.mutate(body);
      return;
    }
    createMutation.mutate(body);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!(await confirmAction({ message: `حذف الوحدة «${formData.arabicName || formData.code}»؟` }))) {
      return;
    }
    setDeleting(true);
    setError('');
    try {
      await apiClient.delete(`/inventory/units/${selectedId}`);
      invalidateQuery(['units']);
      void refetch();
      resetNew();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الوحدة');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <CenteredOverlay open={open} onClose={onClose} width="lg" labelledBy="unit-definition-title">
      <div className="p-5" dir="rtl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="unit-definition-title" className="flex items-center gap-2 text-lg font-bold text-[#0E79AA]">
              <Ruler className="h-5 w-5" />
              تعريف الوحدات
            </h2>
            <p className="mt-1 text-xs text-slate-500">نفس بطاقة الوحدة — اختَر من الدليل أو اكتب وحدة خاصة.</p>
          </div>
          <button type="button" className="text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>
            إغلاق
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-3">
            <CompactFormField label="الوحدة من الدليل العالمي">
              <SearchableCombobox
                value={UNIT_CATALOG.some((item) => item.code === formData.code) ? formData.code : ''}
                onChange={applyCatalog}
                className={compactControlClass}
                placeholder="ابحث — قطعة، KG، liter…"
                emptyMessage="لا توجد وحدة مطابقة"
                portaled
                menuPlacement="auto"
                options={UNIT_CATALOG.map((item) => ({
                  value: item.code,
                  label: `${item.arabicName} (${item.code})`,
                  searchText: `${item.code} ${item.arabicName} ${item.englishName}`,
                }))}
              />
            </CompactFormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CompactFormField
                label="الكود"
                value={formData.code}
                onChange={(e) => patch({ code: e.target.value })}
                placeholder="PCS"
              />
              <CompactFormField
                label="الاسم العربي"
                required
                value={formData.arabicName}
                onChange={(e) => patch({ arabicName: e.target.value })}
                placeholder="قطعة"
              />
            </div>
            <CompactFormField
              label="الاسم الإنجليزي"
              value={formData.englishName}
              onChange={(e) => patch({ englishName: e.target.value })}
              placeholder="Piece"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={handleSave} disabled={loading}>
                {loading ? 'جاري الحفظ…' : selectedId ? 'حفظ التعديل' : 'حفظ'}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={resetNew} disabled={loading}>
                جديد
              </Button>
              {selectedId ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void handleDelete()} disabled={loading}>
                  <Trash2 className="h-4 w-4" />
                  حذف
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-[#E6EEF4] bg-[#F7FBFD] p-3">
            <p className="mb-2 text-xs font-semibold text-[#0A3D5E]">الوحدات المعرفة</p>
            <input
              className={`${compactControlClass} mb-2`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث…"
            />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">لا توجد وحدات</p>
              ) : (
                filtered.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(row.id);
                      setFormData(formFromRow(row));
                      setError('');
                    }}
                    className={`w-full rounded-lg px-2.5 py-2 text-right text-sm ${
                      selectedId === row.id
                        ? 'bg-[#0E79AA] text-white'
                        : 'bg-white text-[#0A3D5E] hover:bg-white/80'
                    }`}
                  >
                    <span className="block font-semibold">{row.arabicName}</span>
                    <span className={`block text-[11px] ${selectedId === row.id ? 'text-white/80' : 'text-slate-500'}`}>
                      {row.code || '—'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </CenteredOverlay>
  );
}
