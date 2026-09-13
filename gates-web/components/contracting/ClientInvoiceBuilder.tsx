'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { computeLiveClientBreakdown, previousQtyByBoq, type DraftLine } from '@/lib/contracting/client-invoice-math';
import type { ClientContractDetail, LiveClientBreakdown, OwnerBoqItem, SiteStockMaterial } from '@/lib/contracting/types';
import { formatEgp, formatPercent, formatQty, toMoney } from '@/lib/subcontracts/money';

export function ClientInvoiceBuilder({
  contract,
  boqItems,
  siteStock,
  periodStart,
  periodEnd,
  lines,
  claimIds,
  installIds,
  penalties,
  onPeriodStart,
  onPeriodEnd,
  onLineQty,
  onToggleClaim,
  onToggleInstall,
  onPenalties,
}: {
  contract: ClientContractDetail;
  boqItems: OwnerBoqItem[];
  siteStock: SiteStockMaterial[];
  periodStart: string;
  periodEnd: string;
  lines: DraftLine[];
  claimIds: string[];
  installIds: string[];
  penalties: string;
  onPeriodStart: (v: string) => void;
  onPeriodEnd: (v: string) => void;
  onLineQty: (boqItemId: string, qty: number) => void;
  onToggleClaim: (id: string) => void;
  onToggleInstall: (id: string) => void;
  onPenalties: (v: string) => void;
}) {
  const prevMap = useMemo(() => previousQtyByBoq(contract), [contract]);
  const live = useMemo(
    () =>
      computeLiveClientBreakdown({
        contract,
        boqItems,
        lines,
        siteStock,
        claimIds,
        installIds,
        otherClientPenalties: toMoney(penalties),
      }),
    [contract, boqItems, lines, siteStock, claimIds, installIds, penalties]
  );
  const qtyById = new Map(lines.map((row) => [row.projectBOQItemId, row.currentQuantity]));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">بداية الفترة</span>
            <Input type="date" value={periodStart} onChange={(e) => onPeriodStart(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">نهاية الفترة</span>
            <Input type="date" value={periodEnd} onChange={(e) => onPeriodEnd(e.target.value)} />
          </label>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
          <table className="w-full min-w-[860px] text-center text-sm">
            <thead>
              <tr className="bg-[#0E78AA] text-white">
                <th className="px-3 py-2">البند</th>
                <th className="px-3 py-2">كمية العقد</th>
                <th className="px-3 py-2">سابق</th>
                <th className="px-3 py-2">حالي</th>
                <th className="px-3 py-2">تراكمي %</th>
                <th className="px-3 py-2">سعر البيع</th>
                <th className="px-3 py-2">قيمة الفترة</th>
              </tr>
            </thead>
            <tbody>
              {boqItems.map((item) => {
                const previous = prevMap.get(item.id) ?? toMoney(item.cumulativeExecutedQty);
                const current = qtyById.get(item.id) ?? 0;
                const contractQty = toMoney(item.contractQuantity);
                const cumulative = previous + current;
                const pct = contractQty > 0 ? (cumulative / contractQty) * 100 : 0;
                const amount = current * toMoney(item.unitSellingPrice);
                return (
                  <tr key={item.id} className="border-t border-slate-100 even:bg-[#F6FBFD]/40">
                    <td className="px-3 py-2 text-start">
                      <p className="font-semibold text-[#094C6B]">{item.itemCode}</p>
                      <p className="text-xs text-slate-500">{item.descriptionAr}</p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatQty(contractQty)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatQty(previous)}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={current || ''}
                        onChange={(e) => onLineQty(item.id, toMoney(e.target.value))}
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatPercent(pct)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatEgp(item.unitSellingPrice)}</td>
                    <td className="px-3 py-2 tabular-nums font-semibold">{formatEgp(amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <ClientDeductionsSidebar live={live} penalties={penalties} onPenalties={onPenalties} />
      <SiteStockClaimList
        siteStock={siteStock}
        claimIds={claimIds}
        installIds={installIds}
        onToggleClaim={onToggleClaim}
        onToggleInstall={onToggleInstall}
      />
    </div>
  );
}

function ClientDeductionsSidebar({
  live,
  penalties,
  onPenalties,
}: {
  live: LiveClientBreakdown;
  penalties: string;
  onPenalties: (v: string) => void;
}) {
  const rows: Array<{ label: string; amount: number; sign: '+' | '-' | '=' }> = [
    { label: 'إجمالي الأعمال الحالية', amount: live.grossCurrentWorks, sign: '+' },
    { label: 'صافي تشوينات معتمدة للفترة', amount: live.materialsOnSiteCurrent, sign: '+' },
    { label: 'خصم تشوينات مركّبة', amount: live.materialsOnSiteDeduction, sign: '-' },
    { label: 'استرداد الدفعة المقدمة', amount: live.advancePaymentRecovery, sign: '-' },
    { label: 'تأمين حسن التنفيذ (5%)', amount: live.retentionDeduction, sign: '-' },
    { label: 'دمغات نقابة المهندسين (0.5%)', amount: live.engineeringStampsDeduction, sign: '-' },
    { label: 'غرامات واستقطاعات أخرى', amount: live.otherClientPenalties, sign: '-' },
    { label: 'صافي المستحق على العميل', amount: live.netPayableByClient, sign: '=' },
  ];

  return (
    <aside className="rounded-2xl border border-[#0E79AA] bg-white p-4 shadow-sm ring-2 ring-[#0E79AA]/20 xl:row-span-2">
      <h3 className="mb-3 text-sm font-bold text-[#0E79AA]">التسوية المالية الحية</h3>
      <label className="mb-3 block text-xs">
        <span className="mb-1 block text-slate-500">غرامات الاستشاري / غرامات أخرى</span>
        <Input type="number" min="0" value={penalties} onChange={(e) => onPenalties(e.target.value)} />
      </label>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => {
          const isNet = row.sign === '=';
          return (
            <li
              key={row.label}
              className={cn(
                'flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0',
                isNet && 'rounded-xl bg-[#F0F7FB] px-2 pt-2'
              )}
            >
              <span className={cn('text-slate-600', isNet && 'font-bold text-[#094C6B]')}>
                <span className="ml-1 text-xs text-slate-400">{row.sign}</span>
                {row.label}
              </span>
              <span
                className={cn(
                  'shrink-0 tabular-nums font-semibold',
                  isNet ? (live.netPayableByClient < 0 ? 'text-red-600' : 'text-emerald-700') : 'text-[#094C6B]'
                )}
              >
                {formatEgp(row.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function SiteStockClaimList({
  siteStock,
  claimIds,
  installIds,
  onToggleClaim,
  onToggleInstall,
}: {
  siteStock: SiteStockMaterial[];
  claimIds: string[];
  installIds: string[];
  onToggleClaim: (id: string) => void;
  onToggleInstall: (id: string) => void;
}) {
  const stored = siteStock.filter((row) => row.status === 'STORED_ON_SITE');
  if (!stored.length) return null;
  return (
    <div className="rounded-2xl border border-[#D6EAF3] bg-white p-4 xl:col-span-1">
      <h3 className="mb-2 text-sm font-bold text-[#094C6B]">تشوينات الفترة</h3>
      <ul className="space-y-2 text-sm">
        {stored.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F6FBFD] px-3 py-2">
            <span>{row.materialDescription}</span>
            <div className="flex gap-3 text-xs">
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={claimIds.includes(row.id)} onChange={() => onToggleClaim(row.id)} />
                مطالبة
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={installIds.includes(row.id)} onChange={() => onToggleInstall(row.id)} />
                خصم تركيب
              </label>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
