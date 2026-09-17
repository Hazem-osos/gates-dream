'use client';

import { useState } from 'react';
import { Percent, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  CompactFormField,
  FormSectionCard,
  AppTable,
  compactControlClass,
} from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import {
  CommissionValuesListSection,
  type CommissionValueRow,
} from '@/components/inventory/CommissionValuesListSection';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type TierRow = {
  key: string;
  days: string;
  commissionPct: string;
  [key: string]: unknown;
};

type FormState = {
  serial: string;
  name: string;
  target: string;
  targetPercentage: string;
};

const emptyForm = (): FormState => ({
  serial: '',
  name: '',
  target: '',
  targetPercentage: '',
});

const emptyTier = (): TierRow => ({
  key: crypto.randomUUID(),
  days: '',
  commissionPct: '',
});

const cellCls = '!max-w-none !overflow-visible !h-auto whitespace-normal py-1.5';

function num(value: string): number | null {
  if (!value.trim()) return null;
  const n = parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export default function RepresentativesCommissionValuesPage() {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tiers, setTiers] = useState<TierRow[]>([emptyTier(), emptyTier(), emptyTier()]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));

  const applyRow = (row: CommissionValueRow) => {
    setSelectedId(row.id);
    setForm({
      serial: row.serial ?? '',
      name: row.name ?? '',
      target: row.target != null ? String(row.target) : '',
      targetPercentage: row.targetPercentage != null ? String(row.targetPercentage) : '',
    });
    const next = (row.tiers ?? []).map((t) => ({
      key: crypto.randomUUID(),
      days: t.days != null ? String(t.days) : '',
      commissionPct: t.commissionPct != null ? String(t.commissionPct) : '',
    }));
    setTiers(next.length ? next : [emptyTier(), emptyTier(), emptyTier()]);
    setError('');
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setTiers([emptyTier(), emptyTier(), emptyTier()]);
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!form.name.trim()) {
      setError('يرجى إدخال الاسم');
      return;
    }
    const body = {
      serial: form.serial || null,
      name: form.name.trim(),
      target: num(form.target),
      targetPercentage: num(form.targetPercentage),
      tiers: tiers
        .filter((t) => t.days.trim() || t.commissionPct.trim())
        .map((t) => ({
          days: num(t.days) != null ? Math.round(num(t.days) as number) : null,
          commissionPct: num(t.commissionPct),
        })),
    };
    setSaving(true);
    try {
      if (selectedId) {
        await apiClient.put(`/inventory/representatives-commissions-values/${selectedId}`, body);
      } else {
        await apiClient.post<CommissionValueRow>(
          '/inventory/representatives-commissions-values',
          body
        );
      }
      invalidateQuery(['representatives-commissions-values']);
      handleNew();
      setSuccess('تم حفظ سياسة العمولة — تقدر تضيف التالي');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setError('');
    try {
      await apiClient.delete(`/inventory/representatives-commissions-values/${selectedId}`);
      handleNew();
      setSuccess('تم حذف السياسة');
      invalidateQuery(['representatives-commissions-values']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  return (
    <MasterCardShell
      title="تعريف سياسة عمولات المندوبين قيم"
      breadcrumbs={[
        { label: 'المخازن', href: '/inventory' },
        { label: 'التعريفات' },
        { label: 'عمولات المندوبين قيم' },
      ]}
      docNumber={form.serial || form.name || 'جديد'}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      onSave={() => void handleSave()}
      savePending={saving}
      canSave={!saving}
      onNew={handleNew}
      onDelete={selectedId ? () => void handleDelete() : undefined}
      currentId={selectedId}
      favoriteHref="/inventory/creations/representatives-commission-values"
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <CommissionValuesListSection onSelect={applyRow} selectedId={selectedId} />

      <FormSectionCard
        title="بيانات السياسة"
        subtitle="المسلسل والاسم والتارجت ظاهرين هنا، والعمولات في الجدول تحت."
        icon={Percent}
      >
        <CompactFormField
          label="المسلسل"
          value={form.serial}
          onChange={(e) => patch({ serial: e.target.value })}
        />
        <CompactFormField
          label="الاسم"
          required
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
        <CompactFormField
          label="التارجت"
          type="number"
          value={form.target}
          onChange={(e) => patch({ target: e.target.value })}
        />
        <CompactFormField
          label="نسبة التارجت"
          type="number"
          suffix="%"
          value={form.targetPercentage}
          onChange={(e) => patch({ targetPercentage: e.target.value })}
        />
      </FormSectionCard>

      <section className="mb-4 rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">العمولات</h2>
            <p className="text-xs text-slate-500">عدد الأيام ونسبة العمولة لكل شريحة.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setTiers((prev) => [...prev, emptyTier()])}
          >
            <Plus className="h-4 w-4" />
            شريحة
          </Button>
        </div>
        <AppTable<TierRow>
          data={tiers}
          getRowKey={(r) => r.key}
          emptyTitle="أضف شريحة عمولة"
          virtualizeThreshold={10_000}
          columns={[
            {
              id: 'days',
              header: 'عدد الأيام',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.days}
                  onChange={(e) =>
                    setTiers((prev) =>
                      prev.map((t) => (t.key === row.key ? { ...t, days: e.target.value } : t))
                    )
                  }
                />
              ),
            },
            {
              id: 'pct',
              header: 'نسبة العمولة',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.commissionPct}
                  onChange={(e) =>
                    setTiers((prev) =>
                      prev.map((t) =>
                        t.key === row.key ? { ...t, commissionPct: e.target.value } : t
                      )
                    )
                  }
                />
              ),
            },
            {
              id: 'remove',
              header: '',
              align: 'center',
              className: cellCls,
              cell: (row) => (
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-500"
                  onClick={() =>
                    setTiers((prev) =>
                      prev.length > 1 ? prev.filter((t) => t.key !== row.key) : [emptyTier()]
                    )
                  }
                  aria-label="حذف الشريحة"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ),
            },
          ]}
        />
      </section>

    </MasterCardShell>
  );
}
