'use client';

import { useState } from 'react';
import { Button, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { bumpMasterCatalog } from '@/lib/query/master-catalog-sync';

type UnitRow = {
  id: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
  isActive?: boolean;
};

export default function UnitsGuidePage() {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const { data } = useApiQuery<UnitRow[]>(['inventory-units'], '/inventory/units', { limit: 200 });
  const rows = data?.data ?? [];

  const reset = () => {
    setSelectedId(null);
    setCode('');
    setArabicName('');
    setEnglishName('');
  };

  const apply = (row: UnitRow) => {
    setSelectedId(row.id);
    setCode(row.code ?? '');
    setArabicName(row.arabicName ?? '');
    setEnglishName(row.englishName ?? '');
  };

  const save = async () => {
    if (!arabicName.trim()) {
      setError('اسم الوحدة بالعربية مطلوب');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        code: code.trim() || undefined,
        arabicName: arabicName.trim(),
        englishName: englishName.trim() || undefined,
      };
      const wasUpdate = Boolean(selectedId);
      let id = selectedId;
      if (id) {
        await apiClient.put(`/inventory/units/${id}`, body);
      } else {
        const created = await apiClient.post<UnitRow>('/inventory/units', body);
        id = created.data?.id ?? null;
      }
      invalidateStockViews(invalidateQuery);
      invalidateQuery(['inventory-units']);
      bumpMasterCatalog('unit');
      if (wasUpdate) {
        finishDocumentSave({
          label: 'وحدة',
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
          label: 'وحدة',
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
      setError(err instanceof Error ? err.message : 'تعذر حفظ الوحدة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MasterCardShell
      title="دليل الوحدات"
      breadcrumbs={[{ href: '/inventory', label: 'المخزون' }, { label: 'دليل الوحدات' }]}
      onNew={reset}
      onSave={() => void save()}
      savePending={saving}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      <FormSectionCard title="بيانات الوحدة">
        <div className="grid gap-3 md:grid-cols-3">
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
      <FormSectionCard title="الوحدات">
        <div className="divide-y">
          {rows.length === 0 ? <p className="py-4 text-sm text-slate-500">لا توجد وحدات بعد.</p> : null}
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
