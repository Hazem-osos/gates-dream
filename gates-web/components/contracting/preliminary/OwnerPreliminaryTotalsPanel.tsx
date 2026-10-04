'use client';

import type { OwnerPreliminaryCertificate } from '@/lib/contracting/preliminary-types';
import { formatEgp } from '@/lib/subcontracts/money';

export function OwnerPreliminaryTotalsPanel({ cert }: { cert: OwnerPreliminaryCertificate }) {
  const preview = cert.status !== 'CONVERTED';
  return (
    <aside className="space-y-3 rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-4 text-sm">
      <h3 className="font-bold text-[#094C6B]">ملخص المستخلص</h3>
      <Row label="قيمة الأعمال الحالية" value={formatEgp(cert.grossCurrentWorks)} />
      <Row label="القيمة التراكمية" value={formatEgp(cert.cumulativeGrossWorks)} />
      <div className="border-t border-slate-200 pt-2">
        <p className="mb-2 text-xs text-slate-600">
          {preview ? 'معاينة الاستقطاعات قبل التحويل المالي — للعرض فقط' : 'القيم المعتمدة عند التحويل'}
        </p>
        <Row label="تشوينات / مواد بالموقع" value={formatEgp(cert.materialsOnSiteDeduction)} muted />
        <Row label="استرداد الدفعة المقدمة" value={formatEgp(cert.advancePaymentRecovery)} muted />
        <Row label="تأمين حسن التنفيذ" value={formatEgp(cert.retentionDeduction)} muted />
        <Row label="دمغات هندسية" value={formatEgp(cert.engineeringStampsDeduction)} muted />
        <Row label="غرامات أخرى" value={formatEgp(cert.otherClientPenalties)} muted />
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
