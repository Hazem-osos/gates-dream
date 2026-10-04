'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Home } from 'lucide-react';
import { MasterCardShell } from '@/components/erp';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type BuildingRow = {
  id: string;
  buildingCode: string;
  name: string;
  project?: { id: string; projectCode: string; projectName: string };
};

type UnitRow = {
  id: string;
  buildingId: string;
  unitCode: string;
  unitType: string;
  floor: number;
  grossArea: string | number;
  netArea: string | number;
  meterPrice: string | number;
  totalPrice: string | number;
  maintenanceDeposit: string | number;
  status?: string;
  building?: BuildingRow;
};

const PATH = '/real-estate/units';
const UNIT_TYPES = [
  { value: 'RESIDENTIAL', label: 'سكني' },
  { value: 'COMMERCIAL', label: 'تجاري' },
  { value: 'ADMINISTRATIVE', label: 'إداري' },
];

const emptyForm = () => ({
  buildingId: '',
  unitCode: '',
  unitType: 'RESIDENTIAL',
  floor: '0',
  grossArea: '',
  netArea: '',
  meterPrice: '',
  totalPrice: '',
  maintenanceDeposit: '',
});

export default function RealEstateUnitsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidate = useInvalidateQuery();
  const idFromUrl = searchParams.get('id')?.trim() || null;

  const [selectedId, setSelectedId] = useState<string | null>(idFromUrl);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: buildingsRes } = useApiQuery<BuildingRow[]>(
    ['real-estate-buildings'],
    '/real-estate/buildings'
  );
  const buildings = buildingsRes?.data ?? [];

  const { data: unitsRes } = useApiQuery<UnitRow[]>(['real-estate-units'], '/real-estate/units', {
    limit: 500,
  });
  const rows = unitsRes?.data ?? [];

  const patch = (field: keyof ReturnType<typeof emptyForm>, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const applyRow = useCallback((row: UnitRow) => {
    setSelectedId(row.id);
    setForm({
      buildingId: row.buildingId || row.building?.id || '',
      unitCode: row.unitCode ?? '',
      unitType: row.unitType || 'RESIDENTIAL',
      floor: String(row.floor ?? 0),
      grossArea: String(row.grossArea ?? ''),
      netArea: String(row.netArea ?? ''),
      meterPrice: String(row.meterPrice ?? ''),
      totalPrice: String(row.totalPrice ?? ''),
      maintenanceDeposit: String(row.maintenanceDeposit ?? ''),
    });
  }, []);

  const reset = () => {
    setSelectedId(null);
    setForm(emptyForm());
    router.replace(PATH, { scroll: false });
  };

  useEffect(() => {
    if (!idFromUrl) return;
    const row = rows.find((r) => r.id === idFromUrl);
    if (row) applyRow(row);
    else {
      void (async () => {
        try {
          const res = await apiClient.get<UnitRow>(`/real-estate/units/${idFromUrl}`);
          if (res.data) applyRow(res.data);
        } catch {
          /* ignore */
        }
      })();
    }
  }, [idFromUrl, rows, applyRow]);

  const computedTotal = useMemo(() => {
    const gross = parseFloat(form.grossArea);
    const meter = parseFloat(form.meterPrice);
    if (Number.isFinite(gross) && Number.isFinite(meter) && gross > 0 && meter > 0) {
      return (gross * meter).toLocaleString();
    }
    return form.totalPrice;
  }, [form.grossArea, form.meterPrice, form.totalPrice]);

  const save = async () => {
    if (!form.buildingId) {
      toast.error('يرجى اختيار المبنى');
      return;
    }
    if (!form.unitCode.trim()) {
      toast.error('كود الوحدة مطلوب');
      return;
    }
    setSaving(true);
    try {
      const body = {
        buildingId: form.buildingId,
        unitCode: form.unitCode.trim(),
        unitType: form.unitType,
        floor: Number(form.floor) || 0,
        grossArea: form.grossArea ? parseFloat(form.grossArea) : undefined,
        netArea: form.netArea ? parseFloat(form.netArea) : undefined,
        meterPrice: form.meterPrice ? parseFloat(form.meterPrice) : undefined,
        totalPrice: form.totalPrice
          ? parseFloat(String(form.totalPrice).replace(/,/g, ''))
          : computedTotal
            ? parseFloat(String(computedTotal).replace(/,/g, ''))
            : undefined,
        maintenanceDeposit: form.maintenanceDeposit
          ? parseFloat(form.maintenanceDeposit)
          : undefined,
      };
      if (selectedId) {
        await apiClient.put(`/real-estate/units/${selectedId}`, body);
        toast.success('تم تحديث الوحدة');
      } else {
        const created = await apiClient.post<UnitRow>('/real-estate/units', body);
        const id = created.data?.id;
        if (id) {
          setSelectedId(id);
          router.replace(`${PATH}?id=${encodeURIComponent(id)}`, { scroll: false });
        }
        toast.success('تم حفظ الوحدة');
      }
      invalidate(['real-estate-units']);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر حفظ الوحدة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MasterCardShell
      title="الوحدات العقارية"
      breadcrumbs={[
        { label: 'التطوير العقاري', href: '/real-estate' },
        { label: 'الوحدات' },
      ]}
      favoriteHref={PATH}
      currentId={selectedId}
      onNew={reset}
      onSave={() => void save()}
      savePending={saving}
    >
      <FormSectionCard title="بيانات الوحدة" subtitle="المبنى والمساحة والسعر" icon={Home}>
        <CompactFormField label="المبنى" required>
          <select
            className={compactControlClass}
            value={form.buildingId}
            onChange={(e) => patch('buildingId', e.target.value)}
          >
            <option value="">اختر المبنى</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.project?.projectCode ? `${b.project.projectCode} / ` : ''}
                {b.buildingCode} — {b.name}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField label="كود الوحدة" required>
          <input
            className={compactControlClass}
            value={form.unitCode}
            onChange={(e) => patch('unitCode', e.target.value)}
            placeholder="مثال: A-101"
          />
        </CompactFormField>
        <CompactFormField label="نوع الوحدة">
          <select
            className={compactControlClass}
            value={form.unitType}
            onChange={(e) => patch('unitType', e.target.value)}
          >
            {UNIT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField label="الدور">
          <input
            type="number"
            className={compactControlClass}
            value={form.floor}
            onChange={(e) => patch('floor', e.target.value)}
          />
        </CompactFormField>
        <CompactFormField label="المساحة الإجمالية (م²)">
          <input
            type="number"
            className={compactControlClass}
            value={form.grossArea}
            onChange={(e) => patch('grossArea', e.target.value)}
          />
        </CompactFormField>
        <CompactFormField label="المساحة الصافية (م²)">
          <input
            type="number"
            className={compactControlClass}
            value={form.netArea}
            onChange={(e) => patch('netArea', e.target.value)}
          />
        </CompactFormField>
        <CompactFormField label="سعر المتر">
          <input
            type="number"
            className={compactControlClass}
            value={form.meterPrice}
            onChange={(e) => patch('meterPrice', e.target.value)}
          />
        </CompactFormField>
        <CompactFormField label="السعر الإجمالي">
          <input
            type="number"
            className={compactControlClass}
            value={form.totalPrice || computedTotal}
            onChange={(e) => patch('totalPrice', e.target.value)}
          />
        </CompactFormField>
        <CompactFormField label="وديعة الصيانة">
          <input
            type="number"
            className={compactControlClass}
            value={form.maintenanceDeposit}
            onChange={(e) => patch('maintenanceDeposit', e.target.value)}
          />
        </CompactFormField>
      </FormSectionCard>

      <FormSectionCard title="قائمة الوحدات">
        <div className="divide-y">
          {rows.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">لا توجد وحدات بعد.</p>
          ) : null}
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`flex w-full items-center justify-between py-2 text-right text-sm hover:bg-slate-50 ${
                selectedId === row.id ? 'bg-[#0E78AA0D]' : ''
              }`}
              onClick={() => {
                applyRow(row);
                router.replace(`${PATH}?id=${encodeURIComponent(row.id)}`, { scroll: false });
              }}
            >
              <span>
                {row.unitCode}
                <span className="mr-2 text-xs text-slate-500">
                  {row.building?.project?.projectName} / {row.building?.name}
                </span>
              </span>
              <span className="font-mono text-xs text-slate-500">
                {Number(row.grossArea || 0)} م² · {row.status ?? '—'}
              </span>
            </button>
          ))}
        </div>
      </FormSectionCard>
    </MasterCardShell>
  );
}
