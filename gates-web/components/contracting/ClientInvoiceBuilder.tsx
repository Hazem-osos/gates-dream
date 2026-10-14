'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { ownerBoqHierarchyHints, withItemCodeHierarchy } from '@/lib/contracting/boq-hierarchy';
import { computeLiveClientBreakdown, previousQtyByBoq, type DraftLine } from '@/lib/contracting/client-invoice-math';
import { remainingAfterCurrent, remainingStatementQty, statementLineAmounts } from '@/lib/contracting/statement-line-math';
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
  readOnly,
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
  readOnly?: boolean;
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
  const rows = useMemo(
    () => withItemCodeHierarchy(boqItems, (item) => item.itemCode, ownerBoqHierarchyHints),
    [boqItems]
  );

  if (!boqItems.length) {
    return (
      <EmptyState
        title="لا توجد بنود مقايسة"
        description="أضف بنود مقايسة المالك من المكتب الفني قبل إنشاء المستخلص."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">بداية الفترة</span>
            <Input
              type="date"
              value={periodStart}
              disabled={readOnly}
              onChange={(e) => onPeriodStart(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">نهاية الفترة</span>
            <Input type="date" value={periodEnd} disabled={readOnly} onChange={(e) => onPeriodEnd(e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          قيم الفترة والتراكمي = الكمية × سعر البيع. المعاينة حتى يحفظ السيرفر المسودة.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
          <table className="w-full min-w-[1280px] text-center text-sm">
            <thead>
              <tr className="bg-[#0E78AA] text-white">
                <th className="px-3 py-2">البند</th>
                <th className="px-3 py-2">الوحدة</th>
                <th className="px-3 py-2">كمية العقد</th>
                <th className="px-3 py-2">سابق</th>
                <th className="px-3 py-2">حالي</th>
                <th className="px-3 py-2">تراكمي</th>
                <th className="px-3 py-2">متبقي</th>
                <th className="px-3 py-2">سعر البيع</th>
                <th className="px-3 py-2">قيمة السابق</th>
                <th className="px-3 py-2">قيمة الفترة</th>
                <th className="px-3 py-2">القيمة التراكمية</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const previous = prevMap.get(item.id) ?? toMoney(item.cumulativeExecutedQty);
                const current = qtyById.get(item.id) ?? 0;
                const contractQty = toMoney(item.contractQuantity);
                const unitPrice = toMoney(item.unitSellingPrice);
                const amounts = statementLineAmounts({
                  previousQty: previous,
                  currentQty: current,
                  unitPrice,
                });
                const available = remainingStatementQty(contractQty, previous);
                const remaining = remainingAfterCurrent(contractQty, previous, current);
                const over = current > available + 1e-9;
                const pad = 8 + item.__depth * 14;
                return (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 ${
                      item.__isParent ? 'bg-[#EEF6FA]' : 'even:bg-[#F6FBFD]/40'
                    }`}
                  >
                    <td className="px-3 py-2 text-start" style={{ paddingInlineStart: pad }}>
                      <p className="font-semibold text-[#094C6B]">{item.itemCode}</p>
                      <p className="text-xs text-slate-500">{item.descriptionAr}</p>
                    </td>
                    <td className="px-3 py-2">{item.unit}</td>
                    <td className="px-3 py-2 tabular-nums">{item.__isParent ? '—' : formatQty(contractQty)}</td>
                    <td className="px-3 py-2 tabular-nums">{item.__isParent ? '—' : formatQty(previous)}</td>
                    <td className="px-3 py-2">
                      {item.__isParent || readOnly ? (
                        <span className="tabular-nums">{item.__isParent ? '—' : formatQty(current)}</span>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          className={over ? 'border-red-400' : undefined}
                          value={current || ''}
                          onChange={(e) => onLineQty(item.id, toMoney(e.target.value))}
                        />
                      )}
                      {over && !item.__isParent ? (
                        <p className="mt-1 text-[11px] text-red-700">تجاوز المتبقي {formatQty(available)}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {item.__isParent ? '—' : formatQty(amounts.cumulativeQty)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{item.__isParent ? '—' : formatQty(remaining)}</td>
                    <td className="px-3 py-2 tabular-nums">{item.__isParent ? '—' : formatEgp(unitPrice)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-500">
                      {item.__isParent ? '—' : formatEgp(amounts.previousAmount)}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-semibold">
                      {item.__isParent ? '—' : formatEgp(amounts.currentAmount)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {item.__isParent ? '—' : formatEgp(amounts.cumulativeAmount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <ClientDeductionsSidebar
        live={live}
        contract={contract}
        penalties={penalties}
        readOnly={readOnly}
        onPenalties={onPenalties}
      />
      <SiteStockClaimList
        siteStock={siteStock}
        claimIds={claimIds}
        installIds={installIds}
        readOnly={readOnly}
        onToggleClaim={onToggleClaim}
        onToggleInstall={onToggleInstall}
      />
    </div>
  );
}

function ClientDeductionsSidebar({
  live,
  contract,
  penalties,
  readOnly,
  onPenalties,
}: {
  live: LiveClientBreakdown;
  contract: ClientContractDetail;
  penalties: string;
  readOnly?: boolean;
  onPenalties: (v: string) => void;
}) {
  const retentionPct = formatPercent(toMoney(contract.retentionRate) * 100);
  const stampsPct = formatPercent(toMoney(contract.engineeringStampsRate) * 100);
  const rows: Array<{ label: string; amount: number; sign: '+' | '-' | '=' }> = [
    { label: 'إجمالي الأعمال الحالية', amount: live.grossCurrentWorks, sign: '+' },
    { label: 'صافي تشوينات معتمدة للفترة', amount: live.materialsOnSiteCurrent, sign: '+' },
    { label: 'خصم تشوينات مركّبة', amount: live.materialsOnSiteDeduction, sign: '-' },
    { label: 'استرداد الدفعة المقدمة', amount: live.advancePaymentRecovery, sign: '-' },
    { label: `تأمين حسن التنفيذ (${retentionPct})`, amount: live.retentionDeduction, sign: '-' },
    { label: `دمغات نقابة المهندسين (${stampsPct})`, amount: live.engineeringStampsDeduction, sign: '-' },
    { label: 'غرامات واستقطاعات أخرى', amount: live.otherClientPenalties, sign: '-' },
    { label: 'صافي المستحق على العميل', amount: live.netPayableByClient, sign: '=' },
  ];

  return (
    <aside className="rounded-2xl border border-[#0E78AA] bg-white p-4 shadow-sm ring-2 ring-[#0E78AA]/20 xl:row-span-2">
      <h3 className="mb-3 text-sm font-bold text-[#0E78AA]">التسوية المالية (معاينة)</h3>
      <label className="mb-3 block text-xs">
        <span className="mb-1 block text-slate-500">غرامات الاستشاري / غرامات أخرى</span>
        <Input
          type="number"
          min="0"
          value={penalties}
          disabled={readOnly}
          onChange={(e) => onPenalties(e.target.value)}
        />
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
  readOnly,
  onToggleClaim,
  onToggleInstall,
}: {
  siteStock: SiteStockMaterial[];
  claimIds: string[];
  installIds: string[];
  readOnly?: boolean;
  onToggleClaim: (id: string) => void;
  onToggleInstall: (id: string) => void;
}) {
  if (!siteStock.length) return null;
  return (
    <div className="rounded-xl border border-[#E6F0F7] bg-white p-3 xl:col-span-2">
      <h3 className="mb-2 text-sm font-bold text-[#094C6B]">تشوينات الفترة</h3>
      <ul className="space-y-2 text-sm">
        {siteStock.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <span>{row.materialDescription}</span>
            <div className="flex gap-3 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  disabled={readOnly || row.status === 'REJECTED'}
                  checked={claimIds.includes(row.id)}
                  onChange={() => onToggleClaim(row.id)}
                />
                مطالبة
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={installIds.includes(row.id)}
                  onChange={() => onToggleInstall(row.id)}
                />
                تركيب / خصم
              </label>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
