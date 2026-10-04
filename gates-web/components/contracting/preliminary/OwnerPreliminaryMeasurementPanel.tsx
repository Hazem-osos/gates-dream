'use client';

import { useQueries } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { MeasurementSheet, OwnerBoqItem } from '@/lib/contracting/types';
import type { OwnerPreliminaryCertificate, OwnerPreliminaryMeasurementLink } from '@/lib/contracting/preliminary-types';
import { formatDateAr, formatQty, toMoney } from '@/lib/subcontracts/money';
import { SheetStatusBadge } from '@/components/contracting/StatusBadges';

type SheetRow = MeasurementSheet & { clientInvoiceId?: string | null };

export function OwnerPreliminaryMeasurementPanel({
  contractId,
  certificateId,
  boqItems,
  lineBoqIds,
  linked,
  selectedIds,
  editable,
  onToggle,
}: {
  contractId: string;
  certificateId?: string;
  boqItems: OwnerBoqItem[];
  lineBoqIds: string[];
  linked: OwnerPreliminaryMeasurementLink[];
  selectedIds: string[];
  editable: boolean;
  onToggle: (sheetId: string, netQty: number, on: boolean) => void;
}) {
  const boqForLines = boqItems.filter((b) => lineBoqIds.includes(b.id));

  const sheetQueries = useQueries({
    queries: boqForLines.map((item) => ({
      queryKey: ['boq-measurements', item.id],
      queryFn: async () => {
        const res = await apiClient.get<SheetRow[]>(
          `/contracting/technical-office/boq/${item.id}/measurements`
        );
        return { boqItem: item, sheets: res.data ?? [] };
      },
      enabled: lineBoqIds.length > 0,
    })),
  });

  const consumedElsewhereQuery = useQueries({
    queries: [
      {
        queryKey: ['owner-prelim-consumed-sheets', contractId],
        queryFn: async () => {
          const listRes = await apiClient.get<OwnerPreliminaryCertificate[]>(
            `/contracting/client-billing/contracts/${contractId}/preliminary-certificates`
          );
          const list = listRes.data ?? [];
          const consumed = new Map<string, string>();
          for (const row of list) {
            if (row.id === certificateId) continue;
            const detail = await apiClient.get<OwnerPreliminaryCertificate>(
              `/contracting/client-billing/contracts/${contractId}/preliminary-certificates/${row.id}`
            );
            for (const m of detail.data?.measurements ?? []) {
              consumed.set(m.executiveMeasurementSheetId, row.certificateNumber);
            }
          }
          return consumed;
        },
        enabled: Boolean(contractId),
        staleTime: 30_000,
      },
    ],
  });

  const consumedMap = consumedElsewhereQuery[0]?.data ?? new Map<string, string>();
  const loading = sheetQueries.some((q) => q.isLoading);

  if (!lineBoqIds.length) {
    return (
      <p className="text-sm text-slate-600">أضف بنود BOQ أولاً لربط دفاتر الحصر المعتمدة.</p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        اختر دفاتر حصر معتمدة من الاستشاري (CONSULTANT_APPROVED) فقط. الدفاتر المستخدمة أو المرتبطة بمستخلص مالي
        غير متاحة.
      </p>
      {loading ? <p className="text-sm text-slate-500">جاري تحميل دفاتر الحصر…</p> : null}
      {sheetQueries.map((q) => {
        const pack = q.data;
        if (!pack) return null;
        const { boqItem, sheets } = pack;
        const approved = sheets.filter((s) => s.status === 'CONSULTANT_APPROVED');
        if (!approved.length && !sheets.length) return null;
        return (
          <div key={boqItem.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 font-semibold text-[#094C6B]">
              {boqItem.itemCode} — {boqItem.descriptionAr}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-center text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-1">اختيار</th>
                    <th className="px-2 py-1">رقم الدفتر</th>
                    <th className="px-2 py-1">التاريخ</th>
                    <th className="px-2 py-1">الكمية المنفذة</th>
                    <th className="px-2 py-1">الحالة</th>
                    <th className="px-2 py-1">ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map((sheet) => {
                    const net = toMoney(sheet.netExecutedQty);
                    const linkedHere = linked.some((l) => l.executiveMeasurementSheetId === sheet.id);
                    const selected = selectedIds.includes(sheet.id) || linkedHere;
                    const onFinancial = Boolean(sheet.clientInvoiceId);
                    const onOtherPrelim = consumedMap.has(sheet.id);
                    const notApproved = sheet.status !== 'CONSULTANT_APPROVED';
                    const disabled =
                      !editable ||
                      notApproved ||
                      onFinancial ||
                      (onOtherPrelim && !linkedHere);
                    let reason = '—';
                    if (notApproved) reason = 'غير معتمد من الاستشاري';
                    else if (onFinancial) reason = 'مرتبط بمستخلص مالي';
                    else if (onOtherPrelim) reason = `مستخدم في ${consumedMap.get(sheet.id)}`;
                    else if (linkedHere) reason = 'مربوط بهذا المستخلص';

                    return (
                      <tr key={sheet.id} className="border-t border-slate-100">
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={disabled}
                            onChange={(e) => onToggle(sheet.id, net, e.target.checked)}
                            aria-label={`ربط دفتر ${sheet.sheetNumber}`}
                          />
                        </td>
                        <td className="px-2 py-1 font-medium">{sheet.sheetNumber}</td>
                        <td className="px-2 py-1">{formatDateAr(sheet.measurementDate)}</td>
                        <td className="px-2 py-1 tabular-nums">{formatQty(net)}</td>
                        <td className="px-2 py-1">
                          <SheetStatusBadge status={sheet.status} />
                        </td>
                        <td className="px-2 py-1 text-xs text-slate-600">{reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
