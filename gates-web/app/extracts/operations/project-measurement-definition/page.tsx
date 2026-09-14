'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { Pagination } from '@/components/ui/Pagination';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CompactFormField, FormSectionCard } from '@/components/ui';
import { CrudButtons } from '@/components/ui/CrudButtons';
import { useApiQuery } from '@/lib/hooks/useApi';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { printPageContent } from '@/lib/print/printHtml';

type MeasurementRow = {
  id: string;
  arabicName: string;
  englishName?: string | null;
  unit?: string | null;
  createdAt: string;
  project?: { arabicName?: string; code?: string };
};

export default function ProjectMeasurementDefinitionPage() {
  useBackendReachability();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const { data: defsResponse, isLoading } = useApiQuery<MeasurementRow[]>(
    ['measurement-definitions', page],
    '/extracts/measurement-definitions',
    { page, limit: pageSize }
  );
  const tableData = defsResponse?.data ?? [];
  const tableDataTotal = defsResponse?.pagination?.total ?? defsResponse?.meta?.total ?? tableData.length;

  return (
    <ExtractsPageChrome title="تعريف مقايسة المشروع" module="EXTRACTS / BOQ">
      <div className={`${DASH_PANEL} p-5`}>
            {/* Pagination and Navigation */}
            <div className="mb-4 flex justify-between items-center gap-4">
              <div>
                <Pagination page={page} pageSize={pageSize} total={tableDataTotal} onPageChange={setPage} />
              </div>
            </div>

            <FormSectionCard title="البيانات الأساسية" subtitle="كود البند والكمية والقيمة" icon={ClipboardList}>
              <CompactFormField label="الكود" defaultValue="000000000001" readOnly />
              <CompactFormField label="الكمية" defaultValue="1" readOnly />
              <CompactFormField label="القيمة" placeholder="إدخل القيمة" />
            </FormSectionCard>

            {/* Excel Upload Button */}
            <div className="mb-4">
              <Button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2 rounded-md flex items-center gap-2">
                <Image src="/mdi_file.svg" alt="إكسيل" width={16} height={16} className="w-4 h-4" /> تحميل الإكسيل
              </Button>
            </div>

            {/* Data Table */}
            <div className="mb-6">
              <div className="overflow-x-auto border border-[#E6F0F7] rounded-lg">
                <table id="measurement-definitions-table" className="w-full text-center">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="py-4 px-4 text-sm">التاريخ</th>
                      <th className="py-4 px-4 text-sm">البند الرئيسي</th>
                      <th className="py-4 px-4 text-sm">المشروع</th>
                      <th className="py-4 px-4 text-sm">القيمة</th>
                      <th className="py-4 px-4 text-sm">البيان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={5}>
                          <TableSkeleton columns={5} rows={4} />
                        </td>
                      </tr>
                    ) : tableData.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <EmptyState title="لا توجد مقايسات" description="أضف تعريفات مقايسة للمشروع." />
                        </td>
                      </tr>
                    ) : (
                      tableData.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="py-4 px-4 text-sm text-black">
                          {new Date(row.createdAt).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="py-4 px-4 text-sm text-black">{row.arabicName}</td>
                        <td className="py-4 px-4 text-sm text-black">{row.project?.arabicName ?? '—'}</td>
                        <td className="py-4 px-4 text-sm text-black">{row.unit ?? '—'}</td>
                        <td className="py-4 px-4 text-sm text-black">{row.englishName ?? row.arabicName}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Section - Next Button and Action Buttons */}
            <div className="bg-white rounded-2xl p-6 border border-[#E6F0F7] mb-6">
              <div className="flex justify-between items-center">
                {/* Left Side - Next Button and Total */}
                <div className="flex items-center gap-4">
                  <div className="bg-gray-100 px-4 py-2 rounded-lg">
                    <span className="text-gray-700 text-sm">—</span>
                  </div>
                  <Button className="bg-[#0E78AA] text-white px-6 py-2 rounded-lg hover:bg-[#094C6B] transition-colors">
                    التالي
                  </Button>
                </div>

                {/* Right Side - Action Buttons */}
                <div className="flex gap-2 items-center">
                  <CrudButtons
                    onPrevious={() =>
                      document.getElementById('measurement-definitions-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  />
                  <Button className="bg-[#0E78AA] text-white hover:bg-[#094C6B] px-4 py-2 rounded-md flex items-center gap-2 transition-colors">
                    <span className="text-lg">✕</span> إلغاء
                  </Button>
                  <Button type="button" className="bg-[#0E78AA] text-white hover:bg-[#094C6B] px-4 py-2 rounded-md flex items-center gap-2 transition-colors" onClick={() => void printPageContent('تعريف قياس المشروع')}>
                    <span className="text-lg">🖨️</span> طباعة
                  </Button>
                </div>
              </div>
            </div>

              <div className="flex flex-row-reverse border-t border-slate-100 pt-4">
                <ActionButtons />
              </div>
      </div>
    </ExtractsPageChrome>
  );
} 