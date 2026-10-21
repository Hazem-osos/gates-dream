'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { CompactFormField, FormSectionCard } from '@/components/ui';
import { SubcontractStatusBadge } from '@/components/subcontracts/SubcontractStatusBadge';
import { formatDateAr, formatEgp, formatPercent, toMoney } from '@/lib/subcontracts/money';
import {
  advancePercentOfContract,
  pricedBoqTotal,
  subcontractDeductionRows,
} from '@/lib/subcontracts/contract-view';
import { SUBCONTRACTOR_STATUS_AR } from '@/lib/subcontracts/vendor-details';
import type { SubcontractDetail } from '@/lib/subcontracts/types';

function yesNo(value: boolean): string {
  return value ? 'نعم' : 'لا';
}

export function SubcontractContractSummary({ subcontract }: { subcontract: SubcontractDetail }) {
  const priced = pricedBoqTotal(subcontract.boqItems);
  const advancePct = advancePercentOfContract(subcontract);
  const deductions = subcontractDeductionRows(subcontract);
  const vendorStopped =
    subcontract.subcontractor.status === 'SUSPENDED' || subcontract.subcontractor.status === 'BLACKLISTED';

  return (
    <div className="space-y-4">
      <FormSectionCard title="عقد مقاول الباطن" subtitle="بيانات التعاقد المحفوظة — الخصومات تُطبَّق على المستخلص" icon={FileText}>
        <CompactFormField label="رقم التعاقد" readOnly value={subcontract.subcontractNumber} />
        <CompactFormField
          label="تاريخ التحرير"
          readOnly
          value={formatDateAr(subcontract.createdAt ?? subcontract.contractDate)}
        />
        <CompactFormField label="تاريخ العقد" readOnly value={formatDateAr(subcontract.contractDate)} />
        <CompactFormField label="حالة العقد">
          <div className="flex h-9 items-center">
            <SubcontractStatusBadge status={subcontract.status} />
          </div>
        </CompactFormField>
        <CompactFormField label="مقاول الباطن" readOnly value={subcontract.subcontractor.nameAr} />
        <CompactFormField
          label="العنوان"
          readOnly
          value={subcontract.subcontractor.address || '—'}
          className="sm:col-span-2"
        />
        <CompactFormField label="المحمول" readOnly value={subcontract.subcontractor.phone || '—'} />
        <CompactFormField label="البريد" readOnly value={subcontract.subcontractor.email || '—'} />
        <CompactFormField
          label="المشروع"
          readOnly
          value={`${subcontract.project.projectCode} — ${subcontract.project.projectName}`}
        />
        <CompactFormField label="نوع العقد" readOnly value="عقد مقاول باطن" />
        <CompactFormField
          label="إيقاف التعامل"
          readOnly
          value={
            vendorStopped
              ? SUBCONTRACTOR_STATUS_AR[subcontract.subcontractor.status ?? ''] ?? 'موقوف'
              : 'لا'
          }
        />
        <CompactFormField label="طريقة السداد" readOnly value="على المستخلص" />
        <CompactFormField label="إجمالي قيمة التعاقد" readOnly value={formatEgp(subcontract.totalContractValue)} />
        <CompactFormField label="قيمة الدفعة المقدمة" readOnly value={formatEgp(subcontract.advancePaymentTotal)} />
        <CompactFormField label="نسبة الدفعة المقدمة" readOnly value={formatPercent(advancePct, 2)} />
        <CompactFormField
          label="صافي قيمة التعاقد لتسعير"
          readOnly
          value={priced > 0 ? formatEgp(priced) : formatEgp(subcontract.totalContractValue)}
        />
        <p className="sm:col-span-2 text-sm">
          <Link href="/subcontracts/directory" className="font-semibold text-[#0E78AA] underline">
            فتح بطاقة المقاول
          </Link>
        </p>
      </FormSectionCard>

      <FormSectionCard title="قائمة الخصومات" subtitle="النسب من العقد — القيمة على المستخلص تُحسب عند الترحيل" bodyClassName="grid-cols-1">
        {deductions.length === 0 ? (
          <p className="text-sm text-slate-600">لا توجد نسب خصم على هذا العقد.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
            <table className="w-full min-w-[780px] text-center text-sm">
              <thead>
                <tr className="bg-[#0E78AA] text-white">
                  <th className="px-3 py-2">الخصم</th>
                  <th className="px-3 py-2">نسبة الخصم من القيمة</th>
                  <th className="px-3 py-2">القيمة</th>
                  <th className="px-3 py-2">ينخصم من المستخلص</th>
                  <th className="px-3 py-2">نسبة الخصم من المستخلص</th>
                  <th className="px-3 py-2">يؤثر في قيمة التعاقد</th>
                  <th className="px-3 py-2">تراكمي</th>
                </tr>
              </thead>
              <tbody>
                {deductions.map((row) => (
                  <tr key={row.name} className="border-t border-slate-100 even:bg-[#F6FBFD]">
                    <td className="px-3 py-2 text-start font-medium text-[#094C6B]">{row.name}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.contractPercent > 0 ? formatPercent(row.contractPercent, 2) : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.contractValue > 0 ? formatEgp(row.contractValue) : '—'}
                    </td>
                    <td className="px-3 py-2">{yesNo(row.onExtract)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.extractPercent > 0 ? formatPercent(row.extractPercent, 2) : '—'}
                    </td>
                    <td className="px-3 py-2">{yesNo(row.affectsContractValue)}</td>
                    <td className="px-3 py-2">{yesNo(row.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          حد أوامر التغيير المسموح {formatPercent(toMoney(subcontract.maxAllowedVariationOrderRate) * 100, 1)}
          {' · '}
          سماحية الهوالك {formatPercent(toMoney(subcontract.standardScrapToleranceRate) * 100, 1)}
        </p>
      </FormSectionCard>
    </div>
  );
}
