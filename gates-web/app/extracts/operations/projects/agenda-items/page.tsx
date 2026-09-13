"use client";

import Image from 'next/image';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import React, { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CrudButtons } from '@/components/ui/CrudButtons';
import { ActionButtons } from "@/components/ui/ActionButtons";
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/Pagination";
import { useApiQuery } from "@/lib/hooks/useApi";

function fmt(v: unknown) {
  if (v == null || v === '') return '—';
  return String(v);
}

export default function AgendaItemsPage() {
  useBackendReachability();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramProjectId = searchParams.get("projectId") ?? "";

  const [activeTab, setActiveTab] = useState(0);
  const [showTotalView, setShowTotalView] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const tabs = ["تشطيبات", "أعمال فوق الأرض", "أعمال تحت الأرض", "تجهيزات"];

  const { data: projectsResponse } = useApiQuery<{ id: string; arabicName?: string; serial?: string }[]>(
    ['projects'],
    '/extracts/projects',
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

  const { data: workRes, isLoading: workLoading } = useApiQuery<
    {
      id: string;
      arabicName: string;
      itemNumber: string;
      unit?: string | null;
      quantity?: unknown;
      totalPrice?: unknown;
      itemGroupName?: string | null;
    }[]
  >(
    ['extracts-work-items', projectId, 'agenda-items', page],
    '/extracts/work-items',
    { projectId, page, limit: pageSize },
    { enabled: Boolean(projectId) }
  );
  const workItems = workRes?.data ?? [];
  const workItemsTotal = workRes?.pagination?.total ?? workRes?.meta?.total ?? workItems.length;

  const totalQty = useMemo(() => {
    let t = 0;
    for (const w of workItems) {
      const qv = w.quantity != null ? Number(w.quantity) : NaN;
      if (!Number.isNaN(qv)) t += qv;
    }
    return t;
  }, [workItems]);

  const selectedProjectLabel =
    projects.find((p) => p.id === projectId)?.arabicName ??
    projects.find((p) => p.id === projectId)?.serial ??
    '';

  return (
    <ExtractsPageChrome title="عرض بنود الأعمال">
      <div className={`${DASH_PANEL} p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-row-reverse items-center gap-2 flex-1 min-w-[200px]">
            <label htmlFor="agenda-project" className="text-sm font-medium text-zinc-800 whitespace-nowrap">
              المشروع
            </label>
            <select
              id="agenda-project"
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
          <div className="mb-4 flex justify-end">
            <Pagination page={page} pageSize={pageSize} total={workItemsTotal} onPageChange={setPage} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-6">
            {/* Row 1 */}
            <div className="flex gap-2 items-center flex-row-reverse">
              <Input placeholder="" className="bg-[#F6FBFD] text-right flex-1" />
              <label className="w-32 text-zinc-800 text-right">الكود</label>
            </div>
            <div className="flex gap-2 items-center flex-row-reverse">
              <Input placeholder="" className="bg-[#F6FBFD] text-right flex-1" />
              <label className="w-32 text-zinc-800 text-right">الإسم العربي</label>
            </div>

            {/* Row 2 */}
            <div className="flex gap-2 items-center flex-row-reverse">
              <Input placeholder="إدخل الإسم الإنجليزي" className="bg-[#F6FBFD] text-right flex-1" />
              <label className="w-32 text-zinc-800 text-right">الإسم الإنجليزي</label>
            </div>
            

            {/* Row 3 */}
            <div className="flex gap-2 items-center flex-row-reverse">
              <Input placeholder="إدخل الموازنة الكلية بالأرقام" className="bg-[#F6FBFD] text-right flex-1" />
              <label className="w-32 text-zinc-800 text-right">الموازنة الكلية</label>
            </div>
            <div className="flex gap-2 items-center flex-row-reverse">
              <Input value={selectedProjectLabel || '—'} className="bg-[#F6FBFD] text-right flex-1" readOnly />
              <label className="w-32 text-zinc-800 text-right">الإسم العربي</label>
            </div>

            {/* Row 4 */}
            <div className="flex gap-2 items-center flex-row-reverse">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Input defaultValue="000000000002" className="bg-[#F6FBFD] text-right pr-10" readOnly />
                  <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" />
                </div>
                <div className="relative flex-1">
                  <Input defaultValue="" className="bg-[#F6FBFD] text-right pr-10" readOnly />
                  <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" />
                </div>
              </div>
              <label className="w-32 text-zinc-800 text-right">البند العام</label>
            </div>
          </div>

          {!showTotalView ? (
            <>
              {/* Tabs */}
              <div className="flex justify-center mb-6">
                <div className="flex flex-row-reverse gap-4 bg-white rounded-full shadow-lg px-4 py-2 border border-[#E6F0F7]">
                  {tabs.map((tab, idx) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(idx)}
                      className={`px-6 py-2 text-sm font-bold rounded-full focus:outline-none transition-all duration-200
                        ${activeTab === idx
                          ? 'text-[#0E78AA] border-b-2 border-[#0E78AA]'
                          : 'text-gray-400 hover:text-[#0E78AA]'}
                      `}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons Above Table */}
              <div className="flex justify-between items-center mb-4">
                <Button className="bg-gradient-to-r from-[#0E78AA] to-[#3EC6E0] text-white px-6 py-3 rounded-full hover:from-[#0E68AA] hover:to-[#2EB6D0] transition-all duration-200 shadow-lg flex items-center gap-2 font-bold">
                  <Image src="/mdi_file.svg" alt="Excel" width={20} height={20} className="w-5 h-5" />
                  تحميل الإكسيل
                </Button>
                <Button 
                  className="bg-gradient-to-r from-[#0E78AA] to-[#3EC6E0] text-white px-6 py-3 rounded-full hover:from-[#0E68AA] hover:to-[#2EB6D0] transition-all duration-200 shadow-lg flex items-center gap-2 font-bold"
                  onClick={() => setShowTotalView(true)}
                >
                  إجمالي بنود الأعمال
                  <span className="text-xl">☰</span>
                </Button>
              </div>

              {/* Regular Table */}
              <div className="overflow-x-auto border border-[#E6F0F7] rounded-lg">
                <table id="agenda-items-table" className="min-w-full text-center border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="py-3 px-2 text-sm">البند العام</th>
                      <th className="py-3 px-2 text-sm">موازنة قيمة</th>
                      <th className="py-3 px-2 text-sm">موازنة كمية</th>
                      <th className="py-3 px-2 text-sm">إجمالي</th>
                      <th className="py-3 px-2 text-sm">فئة العميل</th>
                      <th className="py-3 px-2 text-sm">الكمية</th>
                      <th className="py-3 px-2 text-sm">الوحدة</th>
                      <th className="py-3 px-2 text-sm">الكود</th>
                      <th className="py-3 px-2 text-sm">إسم البند</th>
                      <th className="py-3 px-2 text-sm">م</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!projectId ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-gray-500">
                          اختر مشروعاً لعرض بنود الأعمال
                        </td>
                      </tr>
                    ) : workLoading ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-gray-500">
                          جاري تحميل بنود الأعمال…
                        </td>
                      </tr>
                    ) : workItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-gray-500">
                          لا توجد بنود مسجّلة لهذا المشروع
                        </td>
                      </tr>
                    ) : (
                      workItems.map((w, idx) => (
                        <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="py-2 px-2 text-black">—</td>
                          <td className="py-2 px-2 text-black">—</td>
                          <td className="py-2 px-2 text-black">—</td>
                          <td className="py-2 px-2 text-black">{fmt(w.totalPrice)}</td>
                          <td className="py-2 px-2 text-black">—</td>
                          <td className="py-2 px-2 text-black">{fmt(w.quantity)}</td>
                          <td className="py-2 px-2 text-black">{fmt(w.unit)}</td>
                          <td className="py-2 px-2 text-black">{fmt(w.itemNumber)}</td>
                          <td className="py-2 px-2 text-black">{fmt(w.arabicName)}</td>
                          <td className="py-2 px-2 text-black">{idx + 1}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary Section */}
              <div className="flex justify-start gap-4 items-center mt-6">
                <div className="flex gap-4 items-center">
                  <div className="flex gap-2 items-center">
                    <label className="text-zinc-800 text-right">إجمالي الكمية</label>
                    <Input
                      value={workItems.length ? String(totalQty) : '—'}
                      className="bg-[#F6FBFD] text-right w-32"
                      readOnly
                    />
                    
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="flex gap-2 items-center">
                    <label className="text-zinc-800 text-right">إجمالي القيمة</label>
                    <Input
                      value={
                        workItems.length
                          ? String(
                              workItems.reduce((acc, w) => {
                                const v = w.totalPrice != null ? Number(w.totalPrice) : NaN;
                                return acc + (Number.isNaN(v) ? 0 : v);
                              }, 0)
                            )
                          : '—'
                      }
                      className="bg-[#F6FBFD] text-right w-32"
                      readOnly
                    />
                   
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Action Buttons Above Tables */}
              <div className="flex justify-between items-center mb-4">
                <Button className="bg-gray-300 text-gray-700 px-6 py-3 rounded-full hover:bg-gray-400 transition-all duration-200 shadow-lg flex items-center gap-2 font-bold">
                  <span className="text-xl">⤓</span>
                  تحميل الإكسيل
                </Button>
                <Button 
                  className="bg-gradient-to-r from-[#0E78AA] to-[#3EC6E0] text-white px-6 py-3 rounded-full hover:from-[#0E68AA] hover:to-[#2EB6D0] transition-all duration-200 shadow-lg flex items-center gap-2 font-bold"
                  onClick={() => setShowTotalView(false)}
                >
                  إجمالي بنود الأعمال
                  <span className="text-xl">☰</span>
                </Button>
              </div>

              {/* Two Tables Side by Side */}
              <div className="flex gap-6">
                {/* Left Table */}
                <div className="w-1/2">
                  <div className="bg-slate-50/80 p-3 rounded-t-lg text-sm font-semibold text-slate-900 text-center">
                    إجمالي بنود الأعمال
                  </div>
                  <div className="border border-[#E6F0F7] rounded-b-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50/80 text-slate-600">
                          <th className="py-3 px-2 text-sm border-b border-slate-100">القيمة</th>
                          <th className="py-3 px-2 text-sm border-b border-slate-100">الكمية</th>
                          <th className="py-3 px-2 text-sm border-b border-slate-100">إسم البند</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!projectId || workLoading ? (
                          <tr>
                            <td colSpan={3} className="py-6 text-center text-gray-500 text-sm">
                              {!projectId ? 'اختر مشروعاً' : 'جاري التحميل…'}
                            </td>
                          </tr>
                        ) : workItems.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-6 text-center text-gray-500 text-sm">
                              لا توجد بنود
                            </td>
                          </tr>
                        ) : (
                          workItems.map((w) => (
                            <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                              <td className="py-2 px-2">
                                <Input
                                  value={fmt(w.totalPrice)}
                                  className="bg-gray-100 text-gray-600 text-center text-sm"
                                  readOnly
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  value={fmt(w.quantity)}
                                  className="bg-gray-100 text-gray-600 text-center text-sm"
                                  readOnly
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  value={fmt(w.arabicName)}
                                  className="bg-gray-100 text-gray-600 text-center text-sm"
                                  readOnly
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Table */}
                <div className="w-1/2">
                  <div className="bg-slate-50/80 p-3 rounded-t-lg text-sm font-semibold text-slate-900 text-center">
                    <span>إجمالي بنود الأعمال</span>
              
                  </div>
                  <div className="border border-[#E6F0F7] rounded-b-lg overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50/80 text-slate-600">
                          <th className="py-3 px-2 text-sm border-b border-slate-100">م</th>
                          <th className="py-3 px-2 text-sm border-b border-slate-100">إسم البند</th>
                          <th className="py-3 px-2 text-sm border-b border-slate-100">الكود</th>
                          <th className="py-3 px-2 text-sm border-b border-slate-100">الوحدة</th>
                          <th className="py-3 px-2 text-sm border-b border-slate-100">الكمية</th>
                          <th className="py-3 px-2 text-sm border-b border-slate-100">فئة العميل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!projectId || workLoading ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-gray-500 text-sm">
                              {!projectId ? 'اختر مشروعاً' : 'جاري التحميل…'}
                            </td>
                          </tr>
                        ) : workItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-gray-500 text-sm">
                              لا توجد بنود
                            </td>
                          </tr>
                        ) : (
                          workItems.map((w, idx) => (
                            <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                              <td className="py-2 px-2 text-black">{idx + 1}</td>
                              <td className="py-2 px-2">
                                <Input
                                  value={fmt(w.arabicName)}
                                  className="bg-gray-100 text-gray-600 text-center text-sm"
                                  readOnly
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  value={fmt(w.itemNumber)}
                                  className="bg-gray-100 text-gray-600 text-center text-sm"
                                  readOnly
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  value={fmt(w.unit)}
                                  className="bg-gray-100 text-gray-600 text-center text-sm"
                                  readOnly
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  value={fmt(w.quantity)}
                                  className="bg-gray-100 text-gray-600 text-center text-sm"
                                  readOnly
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  value={fmt(w.itemGroupName)}
                                  className="bg-gray-100 text-gray-600 text-center text-sm"
                                  readOnly
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        <div className="flex justify-between items-center">
         
          <div className="flex flex-row-reverse gap-4 items-center">
            <CrudButtons
              onPrevious={() =>
                document.getElementById('agenda-items-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            />
            <Button className="bg-white text-[#0E78AA] border border-[#D6EAF3] w-32 py-3 rounded-lg hover:bg-[#F6FBFD] transition flex items-center gap-2">
              <span className="text-xl">✖️</span> إلغاء
            </Button>
          </div>
           <ActionButtons />
        </div>
      </div>
    </ExtractsPageChrome>
  );
}
