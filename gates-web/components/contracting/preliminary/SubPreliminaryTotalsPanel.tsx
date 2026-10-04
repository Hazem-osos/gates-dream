'use client';

import type { SubPreliminaryCertificate } from '@/lib/contracting/preliminary-types';
import { formatEgp } from '@/lib/subcontracts/money';

export function SubPreliminaryTotalsPanel({ cert }: { cert: SubPreliminaryCertificate }) {
  const preview = cert.status !== 'CONVERTED';
  return (
    <aside className="space-y-3 rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-4 text-sm">
      <h3 className="font-bold text-[#094C6B]">معاينة المستحق</h3>
      <Row label="قيمة الأعمال الحالية" value={formatEgp(cert.grossCurrentAmount)} />
      <Row label="التراكمي" value={formatEgp(cert.grossCumulativeAmount)} />
      <div className="border-t border-slate-200 pt-2">
        <p className="mb-2 text-xs text-slate-600">
          {preview
            ? 'معاينة قبل التحويل — تسوية المواد النهائية عند مستخلص المقاول المالي'
            : 'قيم محفوظة عند التحويل'}
        </p>
        <Row label="استرداد الدفعة المقدمة" value={formatEgp(cert.advancePaymentDeduction)} muted />
        <Row label="تأمين حسن التنفيذ" value={formatEgp(cert.retentionDeduction)} muted />
        <Row label="ضريبة الخصم من المنبع" value={formatEgp(cert.taxWithholdingDeduction)} muted />
        <Row label="تأمينات اجتماعية" value={formatEgp(cert.socialInsuranceDeduction)} muted />
        <Row label="تسوية مواد (معاينة)" value={formatEgp(cert.materialOveruseDeduction)} muted />
        <Row label="غرامات الموقع" value={formatEgp(cert.sitePenaltiesDeduction)} muted />
        <Row label="تنفيذ مباشر" value={formatEgp(cert.directExecutionDeduction)} muted />
        <Row label="خصم السداد المعجل" value={formatEgp(cert.earlyPaymentDiscountDeduction)} muted />
      </div>
      <Row label="صافي المستحق المتوقع" value={formatEgp(cert.netPayablePreview)} strong />
    </aside>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-2 ${muted ? 'text-slate-600' : ''}`}>
      <span>{label}</span>
      <span className={strong ? 'font-bold text-[#0E78AA]' : 'tabular-nums'}>{value}</span>
    </div>
  );
}
