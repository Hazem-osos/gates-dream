'use client';

import { Input } from '@/components/ui/input';
import type { PreliminaryCertificateStatus, SubPreliminaryLine } from '@/lib/contracting/preliminary-types';
import { formatEgp, formatQty, toMoney } from '@/lib/subcontracts/money';

export function SubPreliminaryBoqTable({
  lines,
  status,
  requestedByBoq,
  approvedByBoq,
  onRequestedChange,
  onApprovedChange,
}: {
  lines: SubPreliminaryLine[];
  status: PreliminaryCertificateStatus;
  requestedByBoq: Record<string, number>;
  approvedByBoq: Record<string, number>;
  onRequestedChange?: (boqId: string, qty: number) => void;
  onApprovedChange?: (boqId: string, qty: number) => void;
}) {
  const draft = status === 'DRAFT';
  const review = status === 'SUBMITTED' || status === 'UNDER_REVIEW';
  const frozen = status === 'APPROVED' || status === 'CONVERTED' || status === 'REJECTED' || status === 'CANCELLED';

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
      <table className="w-full min-w-[1100px] text-center text-sm">
        <thead>
          <tr className="bg-[#0E78AA] text-white">
            <th className="px-2 py-2">البند</th>
            <th className="px-2 py-2">الوحدة</th>
            <th className="px-2 py-2">كمية التعاقد</th>
            <th className="px-2 py-2">السابق</th>
            <th className="px-2 py-2 bg-[#095f88]">المطلوب الحالي</th>
            <th className="px-2 py-2 bg-[#084a6b]">المعتمد الحالي</th>
            <th className="px-2 py-2">التراكمي</th>
            <th className="px-2 py-2">المتبقي</th>
            <th className="px-2 py-2">السعر</th>
            <th className="px-2 py-2">قيمة الحالي</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const requested =
              draft && requestedByBoq[line.subcontractBOQItemId] != null
                ? requestedByBoq[line.subcontractBOQItemId]
                : toMoney(line.requestedCurrentQuantity);
            const approvedRaw =
              review && approvedByBoq[line.subcontractBOQItemId] != null
                ? approvedByBoq[line.subcontractBOQItemId]
                : line.approvedCurrentQuantity != null
                  ? toMoney(line.approvedCurrentQuantity)
                  : requested;
            const approved =
              frozen && line.approvedCurrentQuantity != null ? toMoney(line.approvedCurrentQuantity) : approvedRaw;
            const cumulative = frozen
              ? toMoney(line.cumulativeApprovedQuantity)
              : toMoney(line.previousCertifiedQuantity) + (review || frozen ? approved : requested);
            const remaining = Math.max(0, toMoney(line.contractQuantitySnapshot) - cumulative);
            const currentAmount = frozen
              ? toMoney(line.currentAmount)
              : (review ? approved : requested) * toMoney(line.unitRateSnapshot);

            return (
              <tr key={line.subcontractBOQItemId} className="border-t border-slate-100 even:bg-[#F6FBFD]/50">
                <td className="px-2 py-2 text-start">
                  <p className="font-semibold text-[#094C6B]">{line.itemCodeSnapshot}</p>
                  <p className="text-xs text-slate-500">{line.descriptionArSnapshot}</p>
                </td>
                <td className="px-2 py-2">{line.unitSnapshot}</td>
                <td className="px-2 py-2 tabular-nums">{formatQty(line.contractQuantitySnapshot)}</td>
                <td className="px-2 py-2 tabular-nums">{formatQty(line.previousCertifiedQuantity)}</td>
                <td className="px-2 py-2 bg-amber-50/80">
                  {draft && onRequestedChange ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      className="mx-auto max-w-[7rem] border-amber-200"
                      value={requested || ''}
                      onChange={(e) => onRequestedChange(line.subcontractBOQItemId, toMoney(e.target.value))}
                    />
                  ) : (
                    <span className="font-medium text-amber-900 tabular-nums">{formatQty(requested)}</span>
                  )}
                </td>
                <td className="px-2 py-2 bg-emerald-50/80">
                  {review && onApprovedChange ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      className="mx-auto max-w-[7rem] border-emerald-200"
                      value={approved || ''}
                      onChange={(e) => onApprovedChange(line.subcontractBOQItemId, toMoney(e.target.value))}
                    />
                  ) : (
                    <span className="font-medium text-emerald-900 tabular-nums">
                      {line.approvedCurrentQuantity != null || review ? formatQty(approved) : '—'}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 tabular-nums">{formatQty(cumulative)}</td>
                <td className="px-2 py-2 tabular-nums">{formatQty(remaining)}</td>
                <td className="px-2 py-2 tabular-nums">{formatEgp(line.unitRateSnapshot)}</td>
                <td className="px-2 py-2 tabular-nums font-semibold">{formatEgp(currentAmount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
