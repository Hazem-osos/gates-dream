'use client';

import Link from 'next/link';
import { useApiQuery } from '@/lib/hooks/useApi';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';

type ExtractRow = {
  id: string;
  extractNumber: string;
  extractType: string;
  status: string;
  extractDate: string;
  currentExecutedAmount: number | string;
  netPayableAmount: number | string;
  project?: { projectCode?: string; projectName?: string };
};

export default function ContractingExtractsListPage() {
  const { data, isLoading } = useApiQuery<ExtractRow[]>(
    ['contract-extracts'],
    '/contracting/extracts',
    {}
  );
  const rows = data?.data ?? [];

  return (
    <div className="min-h-screen bg-[#E3F6FC] p-6" dir="rtl">
      <div className="w-full max-w-none">
        <OuterCard>
          <InnerCard>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[#0E78AA]">مستخلصات العقود</h1>
                <div className="h-1 bg-sky-700 rounded w-full mt-2" />
              </div>
              <Link
                href="/contracting/extracts/new"
                className="px-4 py-2 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B]"
              >
                مستخلص جديد
              </Link>
            </div>

            {isLoading ? (
              <TableSkeleton columns={6} rows={8} />
            ) : rows.length === 0 ? (
              <EmptyState
                title="لا توجد مستخلصات"
                description="أنشئ مستخلص عميل أو مقاول باطن من زر «مستخلص جديد»."
              />
            ) : (
              <div className="overflow-x-auto border border-[#E6F0F7] rounded-xl">
                <table className="w-full text-center text-sm">
                  <thead>
                    <tr className="bg-[#0E78AA] text-white">
                      <th className="py-3 px-3">رقم المستخلص</th>
                      <th className="py-3 px-3">المشروع</th>
                      <th className="py-3 px-3">النوع</th>
                      <th className="py-3 px-3">التاريخ</th>
                      <th className="py-3 px-3">أعمال الفترة</th>
                      <th className="py-3 px-3">الصافي</th>
                      <th className="py-3 px-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} className={i % 2 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                        <td className="py-3 px-3">
                          <Link href={`/contracting/extracts/${r.id}`} className="text-[#0E78AA] underline">
                            {r.extractNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-3">
                          {r.project?.projectCode} — {r.project?.projectName}
                        </td>
                        <td className="py-3 px-3">
                          {r.extractType === 'CLIENT' ? 'عميل' : 'مقاول باطن'}
                        </td>
                        <td className="py-3 px-3">
                          {new Date(r.extractDate).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="py-3 px-3">{Number(r.currentExecutedAmount).toLocaleString('ar-EG')}</td>
                        <td className="py-3 px-3">{Number(r.netPayableAmount).toLocaleString('ar-EG')}</td>
                        <td className="py-3 px-3">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </InnerCard>
        </OuterCard>
      </div>
    </div>
  );
}
