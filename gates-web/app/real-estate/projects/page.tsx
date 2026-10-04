'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { MasterCardShell } from '@/components/erp';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type ProjectRow = {
  id: string;
  projectCode: string;
  projectName: string;
  costCenterId?: string | null;
  buildings?: Array<{ id: string; buildingCode: string; name: string }>;
};

const PATH = '/real-estate/projects';

export default function RealEstateProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidate = useInvalidateQuery();
  const idFromUrl = searchParams.get('id')?.trim() || null;

  const [selectedId, setSelectedId] = useState<string | null>(idFromUrl);
  const [projectCode, setProjectCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [saving, setSaving] = useState(false);

  const { data } = useApiQuery<ProjectRow[]>(
    ['real-estate-projects'],
    '/real-estate/units/projects'
  );
  const rows = data?.data ?? [];

  const applyRow = useCallback((row: ProjectRow) => {
    setSelectedId(row.id);
    setProjectCode(row.projectCode ?? '');
    setProjectName(row.projectName ?? '');
  }, []);

  const reset = () => {
    setSelectedId(null);
    setProjectCode('');
    setProjectName('');
    router.replace(PATH, { scroll: false });
  };

  useEffect(() => {
    if (!idFromUrl) return;
    const row = rows.find((r) => r.id === idFromUrl);
    if (row) applyRow(row);
    else if (rows.length > 0) {
      void (async () => {
        try {
          const res = await apiClient.get<ProjectRow>(`/real-estate/units/projects/${idFromUrl}`);
          if (res.data) applyRow(res.data);
        } catch {
          /* stay blank until listed */
        }
      })();
    }
  }, [idFromUrl, rows, applyRow]);

  const save = async () => {
    if (!projectCode.trim() || !projectName.trim()) {
      toast.error('كود المشروع والاسم مطلوبان');
      return;
    }
    setSaving(true);
    try {
      const body = { projectCode: projectCode.trim(), projectName: projectName.trim() };
      if (selectedId) {
        await apiClient.put(`/real-estate/units/projects/${selectedId}`, body);
        toast.success('تم تحديث المشروع');
      } else {
        const created = await apiClient.post<ProjectRow>('/real-estate/units/projects', body);
        const id = created.data?.id;
        if (id) {
          setSelectedId(id);
          router.replace(`${PATH}?id=${encodeURIComponent(id)}`, { scroll: false });
        }
        toast.success('تم حفظ المشروع');
      }
      invalidate(['real-estate-projects']);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر حفظ المشروع');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MasterCardShell
      title="المشاريع العقارية"
      breadcrumbs={[
        { label: 'التطوير العقاري', href: '/real-estate' },
        { label: 'المشاريع' },
      ]}
      favoriteHref={PATH}
      currentId={selectedId}
      onNew={reset}
      onSave={() => void save()}
      savePending={saving}
    >
      <FormSectionCard title="بيانات المشروع" subtitle="كود واسم المشروع" icon={Building2}>
        <CompactFormField label="كود المشروع" required>
          <input
            className={compactControlClass}
            value={projectCode}
            onChange={(e) => setProjectCode(e.target.value)}
            placeholder="مثال: PRJ-01"
          />
        </CompactFormField>
        <CompactFormField label="اسم المشروع" required>
          <input
            className={compactControlClass}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="اسم المشروع بالعربية"
          />
        </CompactFormField>
      </FormSectionCard>

      <FormSectionCard title="قائمة المشاريع">
        <div className="divide-y">
          {rows.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">لا توجد مشاريع بعد.</p>
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
              <span>{row.projectName}</span>
              <span className="font-mono text-xs text-slate-500">
                {row.projectCode} · {row.buildings?.length ?? 0} مبنى
              </span>
            </button>
          ))}
        </div>
      </FormSectionCard>
    </MasterCardShell>
  );
}
