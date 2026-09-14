import type { ReactNode } from 'react';
import type { ConnectedModuleKey } from '../../../data/modules';
import type { MarketingLocale } from '../../../lib/marketing/copy';

type VisualProps = {
  sample: string;
  locale: MarketingLocale;
};

function Chrome({ title, sample, children }: { title: string; sample: string; children: ReactNode }) {
  return (
    <div className="relative flex h-full min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b2233] shadow-[0_28px_80px_rgba(0,0,0,0.28)] md:min-h-0">
      <div className="flex items-center justify-between border-b border-white/8 bg-[#071b2b] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#1499d6]" />
          <span className="text-[0.78rem] font-semibold text-white">{title}</span>
        </div>
        <span className="rounded-full bg-white/8 px-2 py-0.5 text-[0.58rem] text-white/45">{sample}</span>
      </div>
      <div className="min-h-0 flex-1 p-4 md:p-5">{children}</div>
    </div>
  );
}

function AccountingVisual({ sample, locale }: VisualProps) {
  const ar = locale === 'ar';
  const rows = [
    { code: '4100', name: ar ? 'مبيعات' : 'Sales', v: '842,100' },
    { code: '1100', name: ar ? 'نقدية' : 'Cash', v: '1.18M' },
    { code: '1200', name: ar ? 'ذمم' : 'AR', v: '430,200' },
    { code: '2100', name: ar ? 'ذمم دائنة' : 'AP', v: '196,400' },
  ];
  return (
    <Chrome title={ar ? 'لوحة مالية' : 'Financial dashboard'} sample={sample}>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { l: ar ? 'صافي الربح' : 'Net profit', v: '312K' },
          { l: ar ? 'الهامش' : 'Margin', v: '18.4%' },
        ].map((k) => (
          <div key={k.l} className="rounded-xl bg-white/[0.05] px-3 py-3">
            <p className="text-[0.62rem] text-white/40">{k.l}</p>
            <p className="mt-1 text-xl font-semibold text-white">{k.v}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <div key={row.code} className="flex items-center justify-between text-[0.78rem]">
            <span className="font-medium text-[#1499d6]">{row.code}</span>
            <span className="flex-1 px-3 text-white/55">{row.name}</span>
            <span className="tabular-nums font-semibold text-white">{row.v}</span>
          </div>
        ))}
      </div>
      <svg className="mt-4 h-16 w-full" viewBox="0 0 220 44" fill="none" aria-hidden>
        <path d="M0 32 L28 26 L56 28 L84 16 L112 20 L140 10 L168 14 L220 8" stroke="#1499d6" strokeWidth="2.2" />
      </svg>
    </Chrome>
  );
}

function InventoryVisual({ sample, locale }: VisualProps) {
  const ar = locale === 'ar';
  return (
    <Chrome title={ar ? 'خريطة المخزون' : 'Stock map'} sample={sample}>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="flex aspect-square items-center justify-center rounded-md text-[0.52rem] text-white/50"
            style={{
              background: i % 7 === 0 ? 'rgba(20,153,214,0.55)' : i % 4 === 0 ? 'rgba(20,153,214,0.2)' : 'rgba(255,255,255,0.06)',
            }}
          >
            {i % 7 === 0 ? '!' : ''}
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[0.58rem] text-white/40">{ar ? 'المتاح' : 'On hand'}</p>
          <p className="mt-1 text-2xl font-semibold text-white">1,284</p>
        </div>
        <div>
          <p className="text-[0.58rem] text-white/40">{ar ? 'تحت الحد' : 'Below min'}</p>
          <p className="mt-1 text-2xl font-semibold text-[#1499d6]">7</p>
        </div>
        <div>
          <p className="text-[0.58rem] text-white/40">{ar ? 'مستودعات' : 'Warehouses'}</p>
          <p className="mt-1 text-2xl font-semibold text-white">4</p>
        </div>
      </div>
    </Chrome>
  );
}

function SalesVisual({ sample, locale }: VisualProps) {
  const ar = locale === 'ar';
  const stages = [
    { en: 'Quote', ar: 'عرض', n: 18 },
    { en: 'Order', ar: 'طلب', n: 11 },
    { en: 'Invoice', ar: 'فاتورة', n: 9 },
    { en: 'Paid', ar: 'محصّل', n: 6 },
  ];
  return (
    <Chrome title={ar ? 'خط الأنابيب' : 'Pipeline'} sample={sample}>
      <div className="space-y-3.5">
        {stages.map((s) => (
          <div key={s.en}>
            <div className="mb-1.5 flex justify-between text-[0.72rem] text-white/70">
              <span>{ar ? s.ar : s.en}</span>
              <span className="font-semibold text-white">{s.n}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-[#1499d6]" style={{ width: `${28 + s.n * 4}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Chrome>
  );
}

function CrmVisual({ sample, locale }: VisualProps) {
  const ar = locale === 'ar';
  const events = [
    { t: ar ? 'اتصال' : 'Call', d: ar ? 'منذ ساعتين' : '2h ago' },
    { t: ar ? 'عرض سعر' : 'Quote sent', d: ar ? 'أمس' : 'Yesterday' },
    { t: ar ? 'زيارة فرع' : 'Branch visit', d: ar ? '3 أيام' : '3 days' },
    { t: ar ? 'فاتورة' : 'Invoice', d: ar ? 'أسبوع' : '1 week' },
  ];
  return (
    <Chrome title={ar ? 'مسار العميل' : 'Customer timeline'} sample={sample}>
      <p className="text-base font-semibold text-white">{ar ? 'شركة النيل للتجارة' : 'Nile Trading'}</p>
      <p className="mt-1 text-[0.68rem] text-white/40">{ar ? 'حساب رئيسي · القاهرة' : 'Key account · Cairo'}</p>
      <div className="mt-5 space-y-3">
        {events.map((e, i) => (
          <div key={e.t} className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${i === 0 ? 'bg-[#1499d6]' : 'bg-white/25'}`} />
            <span className="flex-1 text-[0.82rem] text-white/85">{e.t}</span>
            <span className="text-[0.62rem] text-white/35">{e.d}</span>
          </div>
        ))}
      </div>
    </Chrome>
  );
}

function HrVisual({ sample, locale }: VisualProps) {
  const ar = locale === 'ar';
  return (
    <Chrome title={ar ? 'القوى العاملة' : 'Workforce'} sample={sample}>
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { l: ar ? 'موظفون' : 'Headcount', v: '148' },
          { l: ar ? 'حضور' : 'Present', v: '96%' },
          { l: ar ? 'رواتب' : 'Payroll', v: '412K' },
        ].map((k) => (
          <div key={k.l} className="rounded-xl bg-white/[0.05] px-2 py-3.5 text-center">
            <p className="text-xl font-semibold text-white">{k.v}</p>
            <p className="mt-1 text-[0.58rem] text-white/40">{k.l}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-end gap-1.5">
        {[42, 64, 50, 80, 58, 90, 72, 84].map((h, i) => (
          <span key={i} className="flex-1 rounded-sm bg-[#1499d6]" style={{ height: `${h}px`, opacity: 0.45 + i * 0.06 }} />
        ))}
      </div>
    </Chrome>
  );
}

function ManufacturingVisual({ sample, locale }: VisualProps) {
  const ar = locale === 'ar';
  const nodes = [
    { en: 'Materials', ar: 'مواد' },
    { en: 'WIP', ar: 'تشغيل' },
    { en: 'Finished', ar: 'تام' },
  ];
  return (
    <Chrome title={ar ? 'تدفق الإنتاج' : 'Production flow'} sample={sample}>
      <div className="flex items-center gap-2">
        {nodes.map((n, i) => (
          <div key={n.en} className="flex flex-1 items-center gap-2">
            <div className="flex-1 rounded-xl bg-white/[0.06] py-5 text-center text-[0.78rem] font-medium text-white">
              {ar ? n.ar : n.en}
            </div>
            {i < 2 ? <span className="h-px w-5 bg-[#1499d6]" /> : null}
          </div>
        ))}
      </div>
      <p className="mt-5 text-[0.78rem] text-white/55">{ar ? 'أمر شغل WO-204 · 86% مكتمل' : 'Work order WO-204 · 86% complete'}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
        <div className="h-full w-[86%] rounded-full bg-[#1499d6]" />
      </div>
    </Chrome>
  );
}

function ProjectsVisual({ sample, locale }: VisualProps) {
  const ar = locale === 'ar';
  const rows = [
    { n: ar ? 'مجمع النيل' : 'Nile Complex', m: 18, p: 72 },
    { n: ar ? 'توسعة جدة' : 'Jeddah Expand', m: 9, p: 48 },
    { n: ar ? 'خط إنتاج 2' : 'Line 02', m: 4, p: 86 },
  ];
  return (
    <Chrome title={ar ? 'ربحية المشاريع' : 'Project profitability'} sample={sample}>
      <div className="space-y-5">
        {rows.map((r) => (
          <div key={r.n}>
            <div className="mb-1.5 flex justify-between text-[0.78rem]">
              <span className="font-medium text-white">{r.n}</span>
              <span className="text-[#1499d6]">{r.m}% {ar ? 'هامش' : 'margin'}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-[#1499d6]" style={{ width: `${r.p}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Chrome>
  );
}

const VISUALS: Record<ConnectedModuleKey, (props: VisualProps) => ReactNode> = {
  accounting: AccountingVisual,
  inventory: InventoryVisual,
  sales: SalesVisual,
  crm: CrmVisual,
  hr: HrVisual,
  manufacturing: ManufacturingVisual,
  projects: ProjectsVisual,
};

export function ModuleVisual({
  moduleKey,
  sample,
  locale,
  panelRef,
}: {
  moduleKey: ConnectedModuleKey;
  sample: string;
  locale: MarketingLocale;
  panelRef: (el: HTMLDivElement | null) => void;
}) {
  const Visual = VISUALS[moduleKey];
  return (
    <div ref={panelRef} className="absolute inset-0">
      <Visual sample={sample} locale={locale} />
    </div>
  );
}
