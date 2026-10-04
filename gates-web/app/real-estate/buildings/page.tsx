'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building } from 'lucide-react';
import { MasterCardShell } from '@/components/erp';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type ProjectRow = {
  id: string;
  projectCode: string;
  projectName: string;
};

type BuildingRow = {
  id: string;
  projectId: string;
  buildingCode: string;
  name: string;
  totalFloors: number;
  project?: { id: string; projectCode: string; projectName: string };
  _count?: { units: number };
};

const PATH = '/real-estate/buildings';

export default function RealEstateBuildingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidate = useInvalidateQuery();
  const idFromUrl = searchParams.get('id')?.trim() || null;

  const [selectedId, setSelectedId] = useState<string | null>(idFromUrl);
  const [projectId, setProjectId] = useState('');
  const [buildingCode, setBuildingCode] = useState('');
  const [name, setName] = useState('');
  const [totalFloors, setTotalFloors] = useState('1');
  const [saving, setSaving] = useState(false);

  const { data: projectsRes } = useApiQuery<ProjectRow[]>(
    ['real-estate-projects'],
    '/real-estate/units/projects'
  );
  const projects = projectsRes?.data ?? [];

  const { data: buildingsRes } = useApiQuery<BuildingRow[]>(
    ['real-estate-buildings'],
    '/real-estate/buildings'
  );
  const rows = buildingsRes?.data ?? [];

  const applyRow = useCallback((row: BuildingRow) => {
    setSelectedId(row.id);
    setProjectId(row.projectId || row.project?.id || '');
    setBuildingCode(row.buildingCode ?? '');
    setName(row.name ?? '');
    setTotalFloors(String(row.totalFloors ?? 1));
  }, []);

  const reset = () => {
    setSelectedId(null);
    setProjectId('');
    setBuildingCode('');
    setName('');
    setTotalFloors('1');
    router.replace(PATH, { scroll: false });
  };

  useEffect(() => {
    if (!idFromUrl) return;
    const row = rows.find((r) => r.id === idFromUrl);
    if (row) applyRow(row);
    else if (rows.length >= 0) {
      void (async () => {
        try {
          const res = await apiClient.get<BuildingRow>(`/real-estate/buildings/${idFromUrl}`);
          if (res.data) applyRow(res.data);
        } catch {
          /* ignore */
        }
      })();
    }
  }, [idFromUrl, rows, applyRow]);

  const save = async () => {
    if (!projectId) {
      toast.error('يرجى اختيار المشروع');
      return;
    }
    if (!buildingCode.trim() || !name.trim()) {
      toast.error('كود المبنى والاسم مطلوبان');
      return;
    }
    const floors = Number(totalFloors);
    if (!Number.isFinite(floors) || floors < 1) {
      toast.error('عدد الأدوار غير صالح');
      return;
    }
    setSaving(true);
    try {
      const body = {
        projectId,
        buildingCode: buildingCode.trim(),
        name: name.trim(),
        totalFloors: floors,
      };
      if (selectedId) {
        await apiClient.put(`/real-estate/buildings/${selectedId}`, body);
        toast.success('تم تحديث المبنى');
      } else {
        const created = await apiClient.post<BuildingRow>('/real-estate/buildings', body);
        const id = created.data?.id;
        if (id) {
          setSelectedId(id);
          router.replace(`${PATH}?id=${encodeURIComponent(id)}`, { scroll: false });
        }
        toast.success('تم حفظ المبنى');
      }
      invalidate(['real-estate-buildings']);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر حفظ المبنى');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MasterCardShell
      title="المباني العقارية"
      breadcrumbs={[
        { label: 'التطوير العقاري', href: '/real-estate' },
        { label: 'المباني' },
      ]}
      favoriteHref={PATH}
      currentId={selectedId}
      onNew={reset}
      onSave={() => void save()}
      savePending={saving}
    >
      <FormSectionCard title="بيانات المبنى" subtitle="المشروع والكود والاسم" icon={Building}>
        <CompactFormField label="المشروع" required>
          <select
            className={compactControlClass}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">اختر المشروع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectCode} — {p.projectName}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField label="كود المبنى" required>
          <input
            className={compactControlClass}
            value={buildingCode}
            onChange={(e) => setBuildingCode(e.target.value)}
            placeholder="مثال: B1"
          />
        </CompactFormField>
        <CompactFormField label="اسم المبنى" required>
          <input
            className={compactControlClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم المبنى"
          />
        </CompactFormField>
        <CompactFormField label="عدد الأدوار">
          <input
            type="number"
            min={1}
            className={compactControlClass}
            value={totalFloors}
            onChange={(e) => setTotalFloors(e.target.value)}
          />
        </CompactFormField>
      </FormSectionCard>

      <FormSectionCard title="قائمة المباني">
        <div className="divide-y">
          {rows.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">لا توجد مبانٍ بعد.</p>
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
                {row.name}
                <span className="mr-2 text-xs text-slate-500">
                  {row.project?.projectName ?? ''}
                </span>
              </span>
              <span className="font-mono text-xs text-slate-500">
                {row.buildingCode} · {row._count?.units ?? 0} وحدة
              </span>
            </button>
          ))}
        </div>
      </FormSectionCard>
    </MasterCardShell>
  );
}
