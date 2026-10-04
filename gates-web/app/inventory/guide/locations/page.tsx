'use client';

import { useState } from 'react';
import { Button, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';

type LocationRow = {
  id: string;
  warehouseId: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
};

export default function LocationsGuidePage() {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [code, setCode] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const { data } = useApiQuery<LocationRow[]>(
    ['inventory-locations', warehouseId],
    '/inventory/locations',
    { limit: 200, warehouseId: warehouseId || undefined }
  );
  const rows = data?.data ?? [];

  const reset = () => {
    setSelectedId(null);
    setCode('');
    setArabicName('');
    setEnglishName('');
  };

  const apply = (row: LocationRow) => {
    setSelectedId(row.id);
    setWarehouseId(row.warehouseId);
    setCode(row.code ?? '');
    setArabicName(row.arabicName ?? '');
    setEnglishName(row.englishName ?? '');
  };

  const save = async () => {
    if (!warehouseId) {
      setError('اختر المخزن');
      return;
    }
    if (!arabicName.trim()) {
      setError('اسم الموقع بالعربية مطلوب');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        warehouseId,
        code: code.trim() || undefined,
        arabicName: arabicName.trim(),
        englishName: englishName.trim() || undefined,
      };
      const wasUpdate = Boolean(selectedId);
      let id = selectedId;
      if (id) {
        await apiClient.put(`/inventory/locations/${id}`, body);
      } else {
        const created = await apiClient.post<LocationRow>('/inventory/locations', body);
        id = created.data?.id ?? null;
      }
      invalidateStockViews(invalidateQuery);
      invalidateQuery(['inventory-locations']);
      if (wasUpdate) {
        finishDocumentSave({
          label: 'موقع مخزن',
          number: code || arabicName,
          savedId: id,
          onOpen: (saved) => {
            const row = rows.find((r) => r.id === saved);
            if (row) apply(row);
            else setSelectedId(saved);
          },
          cleared: false,
          reset: () => undefined,
        });
      } else {
        finishDocumentSave({
          label: 'موقع مخزن',
          number: code || arabicName,
          savedId: id,
          onOpen: (saved) => {
            const row = rows.find((r) => r.id === saved);
            if (row) apply(row);
            else setSelectedId(saved);
          },
          reset,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الموقع');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MasterCardShell
      title="مواقع المخزن"
      breadcrumbs={[{ href: '/inventory', label: 'المخزون' }, { label: 'مواقع المخزن' }]}
      onNew={reset}
      onSave={() => void save()}
      savePending={saving}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      <FormSectionCard title="بيانات الموقع">
        <div className="grid gap-3 md:grid-cols-2">
          <CompactFormField label="المخزن">
            <WarehouseSelect value={warehouseId} onChange={setWarehouseId} />
          </CompactFormField>
          <CompactFormField label="الكود">
            <input className={compactControlClass} value={code} onChange={(e) => setCode(e.target.value)} />
          </CompactFormField>
          <CompactFormField label="الاسم بالعربية">
            <input className={compactControlClass} value={arabicName} onChange={(e) => setArabicName(e.target.value)} />
          </CompactFormField>
          <CompactFormField label="الاسم بالإنجليزية">
            <input className={compactControlClass} value={englishName} onChange={(e) => setEnglishName(e.target.value)} />
          </CompactFormField>
        </div>
      </FormSectionCard>
      <FormSectionCard title="المواقع">
        <div className="divide-y">
          {rows.length === 0 ? <p className="py-4 text-sm text-slate-500">لا توجد مواقع لهذا المخزن.</p> : null}
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="flex w-full items-center justify-between py-2 text-right text-sm hover:bg-slate-50"
              onClick={() => apply(row)}
            >
              <span>{row.arabicName}</span>
              <span className="font-mono text-xs text-slate-500">{row.code || '—'}</span>
            </button>
          ))}
        </div>
        {selectedId ? (
          <Button type="button" variant="secondary" className="mt-3" onClick={reset}>
            جديد
          </Button>
        ) : null}
      </FormSectionCard>
    </MasterCardShell>
  );
}
