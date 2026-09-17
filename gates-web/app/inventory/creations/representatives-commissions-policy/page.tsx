'use client';

import { useState } from 'react';
import { BadgePercent, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  CompactFormField,
  FormSectionCard,
  AppTable,
  compactControlClass,
} from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import {
  CommissionPoliciesListSection,
  type CommissionPolicyRow,
} from '@/components/inventory/CommissionPoliciesListSection';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type TierRow = {
  key: string;
  targetSlice: string;
  targetPct: string;
  commissionPct: string;
  bonusPct: string;
  increasePct: string;
  [key: string]: unknown;
};

type FormState = {
  code: string;
  arabicName: string;
  englishName: string;
};

const emptyForm = (): FormState => ({ code: '', arabicName: '', englishName: '' });

const emptyTier = (): TierRow => ({
  key: crypto.randomUUID(),
  targetSlice: '',
  targetPct: '',
  commissionPct: '',
  bonusPct: '',
  increasePct: '',
});

const cellCls = '!max-w-none !overflow-visible !h-auto whitespace-normal py-1.5';

function num(value: string): number | null {
  if (!value.trim()) return null;
  const n = parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export default function RepresentativesCommissionsPolicyPage() {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tiers, setTiers] = useState<TierRow[]>([emptyTier(), emptyTier(), emptyTier()]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));
  const patchTier = (key: string, next: Partial<TierRow>) => {
    setTiers((prev) => prev.map((row) => (row.key === key ? { ...row, ...next } : row)));
  };

  const applyRow = (row: CommissionPolicyRow) => {
    setSelectedId(row.id);
    setForm({
      code: row.code ?? '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
    });
    const next = (row.tiers ?? []).map((t) => ({
      key: crypto.randomUUID(),
      targetSlice: t.targetSlice ?? '',
      targetPct: t.targetPct != null ? String(t.targetPct) : '',
      commissionPct: t.commissionPct != null ? String(t.commissionPct) : '',
      bonusPct: t.bonusPct != null ? String(t.bonusPct) : '',
      increasePct: t.increasePct != null ? String(t.increasePct) : '',
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
    if (!form.arabicName.trim()) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }
    const body = {
      code: form.code || null,
      arabicName: form.arabicName.trim(),
      englishName: form.englishName || null,
      tiers: tiers
        .filter(
          (t) =>
            t.targetSlice.trim() ||
            t.targetPct.trim() ||
            t.commissionPct.trim() ||
            t.bonusPct.trim() ||
            t.increasePct.trim()
        )
        .map((t) => ({
          targetSlice: t.targetSlice || null,
          targetPct: num(t.targetPct),
          commissionPct: num(t.commissionPct),
          bonusPct: num(t.bonusPct),
          increasePct: num(t.increasePct),
        })),
    };
    setSaving(true);
    try {
      if (selectedId) {
        await apiClient.put(`/inventory/representatives-commissions-policy/${selectedId}`, body);
      } else {
        await apiClient.post<CommissionPolicyRow>(
          '/inventory/representatives-commissions-policy',
          body
        );
      }
      invalidateQuery(['representatives-commissions-policy']);
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
      await apiClient.delete(`/inventory/representatives-commissions-policy/${selectedId}`);
      handleNew();
      setSuccess('تم حذف السياسة');
      invalidateQuery(['representatives-commissions-policy']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  return (
    <MasterCardShell
      title="سياسة عمولات المندوبين"
      breadcrumbs={[
        { label: 'المخازن', href: '/inventory' },
        { label: 'التعريفات' },
        { label: 'سياسة عمولات المندوبين' },
      ]}
      docNumber={form.code || form.arabicName || 'جديد'}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      onSave={() => void handleSave()}
      savePending={saving}
      canSave={!saving}
      onNew={handleNew}
      onDelete={selectedId ? () => void handleDelete() : undefined}
      currentId={selectedId}
      favoriteHref="/inventory/creations/representatives-commissions-policy"
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <CommissionPoliciesListSection onSelect={applyRow} selectedId={selectedId} />

      <FormSectionCard
        title="بيانات السياسة"
        subtitle="الكود والاسم. شرائح التارجت في الجدول تحت."
        icon={BadgePercent}
      >
        <CompactFormField
          label="الكود"
          value={form.code}
          onChange={(e) => patch({ code: e.target.value })}
        />
        <CompactFormField
          label="الاسم العربي"
          required
          value={form.arabicName}
          onChange={(e) => patch({ arabicName: e.target.value })}
        />
        <CompactFormField
          label="الاسم الإنجليزي"
          value={form.englishName}
          onChange={(e) => patch({ englishName: e.target.value })}
        />
      </FormSectionCard>

      <section className="mb-4 rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-zinc-900">شرائح التارجت</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => setTiers((p) => [...p, emptyTier()])}>
            <Plus className="h-4 w-4" />
            شريحة
          </Button>
        </div>
        <AppTable<TierRow>
          data={tiers}
          getRowKey={(r) => r.key}
          emptyTitle="أضف شريحة تارجت"
          virtualizeThreshold={10_000}
          columns={[
            {
              id: 'slice',
              header: 'شريحة التارجت',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  value={row.targetSlice}
                  onChange={(e) => patchTier(row.key, { targetSlice: e.target.value })}
                />
              ),
            },
            {
              id: 'targetPct',
              header: 'نسبة التارجت',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.targetPct}
                  onChange={(e) => patchTier(row.key, { targetPct: e.target.value })}
                />
              ),
            },
            {
              id: 'commission',
              header: 'العمولة',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.commissionPct}
                  onChange={(e) => patchTier(row.key, { commissionPct: e.target.value })}
                />
              ),
            },
            {
              id: 'bonus',
              header: 'البونص',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.bonusPct}
                  onChange={(e) => patchTier(row.key, { bonusPct: e.target.value })}
                />
              ),
            },
            {
              id: 'increase',
              header: 'نسبة الزيادة',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.increasePct}
                  onChange={(e) => patchTier(row.key, { increasePct: e.target.value })}
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
