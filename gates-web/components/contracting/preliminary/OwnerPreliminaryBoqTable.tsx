'use client';

import { Input } from '@/components/ui/input';
import type { OwnerPreliminaryLine } from '@/lib/contracting/preliminary-types';
import type { PreliminaryCertificateStatus } from '@/lib/contracting/preliminary-types';
import { formatEgp, formatQty, toMoney } from '@/lib/subcontracts/money';

export type OwnerLineEdit = {
  projectBOQItemId: string;
  requestedCurrentQuantity: number;
  approvedCurrentQuantity?: number;
};

export function OwnerPreliminaryBoqTable({
  lines,
  status,
  requestedByBoq,
  approvedByBoq,
  onRequestedChange,
  onApprovedChange,
}: {
  lines: OwnerPreliminaryLine[];
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
      <table className="w-full min-w-[1200px] text-center text-sm">
        <thead>
          <tr className="bg-[#0E78AA] text-white">
            <th className="px-2 py-2">كود البند</th>
            <th className="px-2 py-2 min-w-[160px]">وصف البند</th>
            <th className="px-2 py-2">الوحدة</th>
            <th className="px-2 py-2">كمية العقد</th>
            <th className="px-2 py-2">أوامر معتمدة</th>
            <th className="px-2 py-2">الكمية الفعّالة</th>
            <th className="px-2 py-2">السابق</th>
            <th className="px-2 py-2 bg-[#095f88]">المطلوب الحالي</th>
            <th className="px-2 py-2 bg-[#084a6b]">المعتمد الحالي</th>
            <th className="px-2 py-2">الإجمالي المعتمد</th>
            <th className="px-2 py-2">المتبقي</th>
            <th className="px-2 py-2">السعر</th>
            <th className="px-2 py-2">قيمة الحالي</th>
            <th className="px-2 py-2">القيمة التراكمية</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const requested =
              draft && requestedByBoq[line.projectBOQItemId] != null
                ? requestedByBoq[line.projectBOQItemId]
                : toMoney(line.requestedCurrentQuantity);
            const approvedRaw =
              review && approvedByBoq[line.projectBOQItemId] != null
                ? approvedByBoq[line.projectBOQItemId]
                : line.approvedCurrentQuantity != null
                  ? toMoney(line.approvedCurrentQuantity)
                  : requested;
            const approved = frozen && line.approvedCurrentQuantity != null ? toMoney(line.approvedCurrentQuantity) : approvedRaw;
            const displayCumulative = frozen
              ? toMoney(line.cumulativeApprovedQuantity)
              : toMoney(line.previousCertifiedQuantity) + (review || frozen ? approved : requested);
            const displayRemaining = Math.max(0, toMoney(line.contractQuantitySnapshot) - displayCumulative);
            const currentAmount = frozen
              ? toMoney(line.currentAmount)
              : (review ? approved : requested) * toMoney(line.unitRateSnapshot);
            const cumulativeAmount = frozen
              ? toMoney(line.cumulativeAmount)
              : displayCumulative * toMoney(line.unitRateSnapshot);

            return (
              <tr key={line.projectBOQItemId} className="border-t border-slate-100 even:bg-[#F6FBFD]/50">
                <td className="px-2 py-2 font-semibold text-[#094C6B]">{line.itemCodeSnapshot}</td>
                <td className="px-2 py-2 text-start text-xs">{line.descriptionArSnapshot}</td>
                <td className="px-2 py-2">{line.unitSnapshot}</td>
                <td className="px-2 py-2 tabular-nums">
                  {formatQty(line.originalContractQuantity ?? line.contractQuantitySnapshot)}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {line.approvedVariationQuantityDelta != null
                    ? formatQty(line.approvedVariationQuantityDelta)
                    : '—'}
                </td>
                <td className="px-2 py-2 tabular-nums font-medium">
                  {formatQty(line.contractQuantitySnapshot)}
                </td>
                <td className="px-2 py-2 tabular-nums">{formatQty(line.previousCertifiedQuantity)}</td>
                <td className="px-2 py-2 bg-amber-50/80">
                  {draft && onRequestedChange ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      className="mx-auto max-w-[7rem] border-amber-200"
                      value={requested || ''}
                      onChange={(e) => onRequestedChange(line.projectBOQItemId, toMoney(e.target.value))}
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
                      onChange={(e) => onApprovedChange(line.projectBOQItemId, toMoney(e.target.value))}
                    />
                  ) : (
                    <span className="font-medium text-emerald-900 tabular-nums">
                      {line.approvedCurrentQuantity != null || review ? formatQty(approved) : '—'}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 tabular-nums">{formatQty(displayCumulative)}</td>
                <td className="px-2 py-2 tabular-nums">{formatQty(displayRemaining)}</td>
                <td className="px-2 py-2 tabular-nums">{formatEgp(line.unitRateSnapshot)}</td>
                <td className="px-2 py-2 tabular-nums font-semibold">{formatEgp(currentAmount)}</td>
                <td className="px-2 py-2 tabular-nums">{formatEgp(cumulativeAmount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!lines.length ? (
        <p className="p-6 text-center text-sm text-slate-500">أضف بنود BOQ للمستخلص.</p>
      ) : null}
    </div>
  );
}
