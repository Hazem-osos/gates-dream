'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { LgStatusBadge, LgTypeBadge } from '@/components/contracting/StatusBadges';
import type { ProjectLetterOfGuarantee } from '@/lib/contracting/types';
import { cn } from '@/lib/utils';
import { formatDateAr, formatEgp } from '@/lib/subcontracts/money';

const DAY_MS = 86_400_000;

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / DAY_MS);
}

export function ProjectLgTable({
  items,
  loading,
  onExtend,
  onAmend,
  onRelease,
  onLiquidate,
  onSelect,
  selectedId,
}: {
  items: ProjectLetterOfGuarantee[];
  loading?: boolean;
  onExtend: (lg: ProjectLetterOfGuarantee) => void;
  onAmend: (lg: ProjectLetterOfGuarantee) => void;
  onRelease: (lg: ProjectLetterOfGuarantee) => void;
  onLiquidate: (lg: ProjectLetterOfGuarantee) => void;
  onSelect?: (lg: ProjectLetterOfGuarantee) => void;
  selectedId?: string | null;
}) {
  if (loading) return <TableSkeleton rows={5} columns={8} />;
  if (!items.length) {
    return <EmptyState title="لا توجد خطابات ضمان" description="أصدر خطاب ضمان جديد لتغطية العطاء أو حسن التنفيذ." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
      <table className="w-full min-w-[980px] text-center text-sm">
        <thead>
          <tr className="bg-[#0E78AA] text-white">
            <th className="px-3 py-2">رقم الخطاب</th>
            <th className="px-3 py-2">البنك</th>
            <th className="px-3 py-2">الجهة المستفيدة</th>
            <th className="px-3 py-2">النوع</th>
            <th className="px-3 py-2">الإصدار</th>
            <th className="px-3 py-2">الانتهاء</th>
            <th className="px-3 py-2">القيمة الحالية</th>
            <th className="px-3 py-2">الغطاء النقدي</th>
            <th className="px-3 py-2">الحالة</th>
            <th className="px-3 py-2">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((lg) => {
            const days = daysUntil(lg.expiryDate);
            const expiring = days <= 30 && days >= 0;
            const expired = days < 0;
            const closed = lg.status === 'RELEASED_RETURNED' || lg.status === 'LIQUIDATED_CONFISCATED';
            return (
              <tr
                key={lg.id}
                className={cn(
                  'border-t border-slate-100 even:bg-[#F6FBFD]/40',
                  selectedId === lg.id ? 'bg-[#E8F4FA]' : ''
                )}
              >
                <td className="px-3 py-2 font-semibold text-[#094C6B]">
                  {onSelect ? (
                    <button type="button" className="text-[#0E79AA] underline" onClick={() => onSelect(lg)}>
                      {lg.lgNumber}
                    </button>
                  ) : (
                    lg.lgNumber
                  )}
                </td>
                <td className="px-3 py-2">{lg.bankName}</td>
                <td className="px-3 py-2">{lg.beneficiaryName}</td>
                <td className="px-3 py-2">
                  <LgTypeBadge type={lg.type} />
                </td>
                <td className="px-3 py-2">{formatDateAr(lg.issuanceDate)}</td>
                <td className={cn('px-3 py-2 font-semibold', expiring || expired ? 'text-red-700' : '')}>
                  {formatDateAr(lg.expiryDate)}
                  {expiring ? <span className="mr-1 text-xs">({days} يوم)</span> : null}
                </td>
                <td className="px-3 py-2 tabular-nums">{formatEgp(lg.currentAmount)}</td>
                <td className="px-3 py-2 tabular-nums">{formatEgp(lg.cashMarginAmount)}</td>
                <td className="px-3 py-2">
                  <LgStatusBadge status={lg.status} />
                </td>
                <td className="px-3 py-2">
                  {closed ? (
                    <span className="text-xs text-slate-400">—</span>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-1">
                      <Button size="sm" variant="secondary" onClick={() => onExtend(lg)}>
                        مد
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => onAmend(lg)}>
                        تعديل
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onRelease(lg)}>
                        إفراج
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => onLiquidate(lg)}>
                        مصادرة
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
