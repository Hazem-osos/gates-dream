'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateAr, formatEgp } from '@/lib/real-estate/format';
import type { PostDatedCheque } from '@/lib/real-estate/types';
import { PdcStatusBadge } from './StatusBadges';

export function ChequePortfolioTable({
  rows,
  selectedIds,
  onToggle,
}: {
  rows: PostDatedCheque[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  if (!rows.length) {
    return <EmptyState title="لا توجد شيكات في هذا التبويب" />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
      <table className="w-full min-w-[980px] text-center text-sm">
        <thead>
          <tr className="bg-[#0E78AA] text-white">
            <th className="px-2 py-3" />
            <th className="px-3 py-3">رقم الشيك</th>
            <th className="px-3 py-3">البنك</th>
            <th className="px-3 py-3">الساحب</th>
            <th className="px-3 py-3">الاستحقاق</th>
            <th className="px-3 py-3">المبلغ</th>
            <th className="px-3 py-3">العقد / الوحدة</th>
            <th className="px-3 py-3">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className={index % 2 ? 'bg-[#F6FBFD]' : 'bg-white'}>
              <td className="px-2 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(row.id)}
                  onChange={(e) => onToggle(row.id, e.target.checked)}
                  disabled={row.status !== 'UNDER_SAFE_CUSTODY'}
                />
              </td>
              <td className="px-3 py-3 font-semibold" data-cheque-id={row.id}>
                {row.chequeNumber}
              </td>
              <td className="px-3 py-3">{row.bankName}</td>
              <td className="px-3 py-3">{row.drawerName}</td>
              <td className="px-3 py-3">{formatDateAr(row.chequeDate)}</td>
              <td className="px-3 py-3 tabular-nums">{formatEgp(row.amount)}</td>
              <td className="px-3 py-3">
                {row.contract?.contractNumber ?? '—'}
                {row.contract?.unit?.unitCode ? ` / ${row.contract.unit.unitCode}` : ''}
              </td>
              <td className="px-3 py-3">
                <PdcStatusBadge status={row.status} />
                {row.status === 'BOUNCED_RETURNED' ? (
                  <div className="mt-1 text-[11px] font-semibold text-red-700">{row.bouncedReason ?? 'مرتد'}</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
