"use client";

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CrudButtons } from '@/components/ui/CrudButtons';
import { ActionButtons } from "@/components/ui/ActionButtons";
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { useApiQuery } from "@/lib/hooks/useApi";

type MeasurementRow = {
  id: string;
  createdAt: string;
  arabicName: string;
  projectLabel: string;
  unit: string;
  notes: string | null;
};

function cell(v: unknown) {
  if (v == null || v === '') return '—';
  return String(v);
}

export default function MaqaysaPage() {
  useBackendReachability();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramProjectId = searchParams.get("projectId") ?? "";

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const { data: projectsResponse } = useApiQuery<{ id: string; arabicName?: string; serial?: string }[]>(
    ["projects"],
    "/extracts/projects",
    { limit: 1000, isActive: true }
  );
  const projects = projectsResponse?.data ?? [];

  const projectId = useMemo(() => {
    if (paramProjectId) return paramProjectId;
    return projects[0]?.id ?? "";
  }, [paramProjectId, projects]);

  useEffect(() => {
    if (!projects.length) return;
    if (!paramProjectId && projects[0]?.id) {
      const q = new URLSearchParams(searchParams.toString());
      q.set("projectId", projects[0].id);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    }
  }, [projects, paramProjectId, pathname, router, searchParams]);

  const onProjectChange = (id: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (id) q.set("projectId", id);
    else q.delete("projectId");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  useEffect(() => {
    setPage(1);
  }, [projectId]);

  const { data: defsRes, isLoading } = useApiQuery<
    {
      id: string;
      createdAt: string;
      arabicName: string;
      englishName?: string | null;
      unit?: string | null;
      notes?: string | null;
      project?: { arabicName?: string; serial?: string | null };
    }[]
  >(
    ["extracts-measurement-definitions", projectId, page],
    "/extracts/measurement-definitions",
    { projectId, page, limit: pageSize },
    { enabled: Boolean(projectId) }
  );

  const rows: MeasurementRow[] = (defsRes?.data ?? []).map((d) => ({
    id: d.id,
    createdAt: d.createdAt,
    arabicName: d.arabicName,
    projectLabel: d.project?.arabicName ?? d.project?.serial ?? "—",
    unit: d.unit ?? "—",
    notes: d.notes ?? null,
  }));
  const rowsTotal = defsRes?.pagination?.total ?? defsRes?.meta?.total ?? rows.length;

  return (
    <ExtractsPageChrome title="مقاسه المشروع">
      <div className={`${DASH_PANEL} p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-row-reverse items-center gap-2 flex-1 min-w-[200px]">
            <label htmlFor="maqaysa-project" className="text-sm font-medium text-zinc-800 whitespace-nowrap">
              المشروع
            </label>
            <select
              id="maqaysa-project"
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
              className="flex-1 max-w-md rounded-lg border border-[#D6EAF3] bg-white px-3 py-2 text-right text-sm text-zinc-800"
            >
              {projects.length === 0 ? (
                <option value="">لا توجد مشاريع</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.arabicName ?? p.serial ?? p.id}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <Pagination page={page} pageSize={pageSize} total={rowsTotal} onPageChange={setPage} />
          </div>
        </div>
         
        <div className="grid grid-cols-2 gap-8 mb-6">
            {/* Left Column */}
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 items-center flex-row-reverse">
                <Input placeholder="إدخل القيمة" className="bg-[#F6FBFD] text-right flex-1" />
                <label className="w-32 text-zinc-800 text-right">القيمة</label>
              </div>
            </div>
            {/* Right Column */}
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 items-center flex-row-reverse">
                <Input placeholder="00000000001" className="bg-[#F6FBFD] text-right flex-1" readOnly />
                <label className="w-32 text-zinc-800 text-right">الكود</label>
              </div>
              <div className="flex gap-2 items-center flex-row-reverse">
                <Input placeholder="1" className="bg-[#F6FBFD] text-right flex-1" />
                <label className="w-32 text-zinc-800 text-right">الكمية</label>
              </div>
            </div>
          </div>
          <Button className="bg-white mb-5 text-[#0E78AA] border border-[#D6EAF3] w-40 py-3 rounded-lg hover:bg-[#F6FBFD] transition flex items-center gap-2">
             تحميل الاكسيل
          </Button>
          <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white mb-6">
            <table id="maqaysa-records-table" className="min-w-full text-center border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600">
                  <th className="py-3 px-2 text-sm">التاريخ</th>
                  <th className="py-3 px-2 text-sm">البند الرئيسي</th>
                  <th className="py-3 px-2 text-sm">المشروع</th>
                  <th className="py-3 px-2 text-sm">الوحدة</th>
                  <th className="py-3 px-2 text-sm">البيان</th>
                </tr>
              </thead>
              <tbody>
                {!projectId ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-gray-500">
                      اختر مشروعاً لعرض تعريفات المقايسة
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-gray-500">
                      جاري تحميل البيانات…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-gray-500">
                      لا توجد بنود مقايسة لهذا المشروع
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="py-2 px-2 text-black">
                        {new Date(r.createdAt).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-2 text-black">{cell(r.arabicName)}</td>
                      <td className="py-2 px-2 text-black">{cell(r.projectLabel)}</td>
                      <td className="py-2 px-2 text-black">{cell(r.unit)}</td>
                      <td className="py-2 px-2 text-black">{cell(r.notes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-row-reverse items-center gap-4 mt-6">
            <Button className="bg-[#E6F0F7] text-[#0E78AA] rounded-lg px-6 py-2 font-bold border border-[#D6EAF3]">التالي</Button>
            <Input className="bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg px-4 py-2 w-32 text-right" defaultValue="—" readOnly />
          </div>
        <div className="flex flex-row-reverse gap-4 mt-8 justify-between ">
          <ActionButtons />
          <div className="flex flex-row-reverse gap-4 items-center">
          <CrudButtons
            onPrevious={() =>
              document.getElementById('maqaysa-records-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          />
          <Button className="bg-white text-[#0E78AA] border border-[#D6EAF3] w-40 py-3 rounded-lg hover:bg-[#F6FBFD] transition flex items-center gap-2">
            <span className="text-xl">✖️</span> إلغاء
          </Button>
          </div>
        </div>
      </div>
    </ExtractsPageChrome>
  );
}
