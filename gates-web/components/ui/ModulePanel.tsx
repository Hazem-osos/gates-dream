import type { HeroModuleId } from '../../data/modules';
import type { MarketingLocale } from '../../lib/marketing/copy';

type ModulePanelProps = {
  id: HeroModuleId;
  name: string;
  locale: MarketingLocale;
  cardRef: (el: HTMLDivElement | null) => void;
};

function LayerBody({ id, locale }: { id: HeroModuleId; locale: MarketingLocale }) {
  const ar = locale === 'ar';
  if (id === 'accounting') {
    return (
      <>
        <p className="text-[1.2rem] font-semibold text-[#071b2b]">{ar ? '2.41م' : '2.41M'}</p>
        <p className="text-[0.68rem] text-[#4d6472]">{ar ? 'إيراد هذا الشهر' : 'Revenue this month'}</p>
        <svg viewBox="0 0 140 36" className="mt-2 h-9 w-full" aria-hidden>
          <path d="M2 28 L22 22 L42 24 L64 12 L86 16 L108 7 L138 9" fill="none" stroke="#0b6fa4" strokeWidth="2.2" />
        </svg>
      </>
    );
  }
  if (id === 'inventory') {
    return (
      <>
        <p className="text-[1.2rem] font-semibold text-[#071b2b]">1,284</p>
        <p className="text-[0.68rem] text-[#4d6472]">{ar ? 'وحدة متاحة' : 'Units on hand'}</p>
        <div className="mt-3 flex h-9 items-end gap-1">
          {[46, 78, 32, 90, 58, 70].map((h, i) => (
            <span key={i} className="flex-1 rounded-sm bg-[#1499d6]" style={{ height: `${h}%`, opacity: 0.45 + i * 0.08 }} />
          ))}
        </div>
      </>
    );
  }
  if (id === 'sales') {
    return (
      <>
        <p className="text-[1.2rem] font-semibold text-[#071b2b]">48</p>
        <p className="text-[0.68rem] text-[#4d6472]">{ar ? 'طلبات مفتوحة' : 'Open orders'}</p>
        <div className="mt-3 grid grid-cols-4 gap-1">
          {(ar ? ['عرض', 'طلب', 'فاتورة', 'تحصيل'] : ['Quote', 'Order', 'Bill', 'Paid']).map((s, i) => (
            <span
              key={s}
              className={`rounded-md py-1.5 text-center text-[0.58rem] ${
                i < 2 ? 'bg-[#0b6fa4] text-white' : 'bg-[#eaf6fc] text-[#0b6fa4]'
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </>
    );
  }
  if (id === 'crm') {
    return (
      <>
        <p className="text-[0.92rem] font-semibold text-[#071b2b]">{ar ? 'شركة النيل' : 'Nile Trading'}</p>
        <p className="mt-1 text-[0.68rem] text-[#4d6472]">{ar ? 'آخر تواصل · ساعتان' : 'Last touch · 2h'}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eaf6fc]">
          <div className="h-full w-2/3 rounded-full bg-[#0b6fa4]" />
        </div>
      </>
    );
  }
  if (id === 'hr') {
    return (
      <>
        <p className="text-[1.2rem] font-semibold text-[#071b2b]">148</p>
        <p className="text-[0.68rem] text-[#4d6472]">{ar ? 'موظف · حضور 96%' : 'People · 96% present'}</p>
        <div className="mt-3 flex -space-x-2">
          {['A', 'M', 'S', 'N', '+'].map((ch) => (
            <span key={ch} className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#eaf6fc] text-[0.58rem] text-[#0b6fa4]">
              {ch}
            </span>
          ))}
        </div>
      </>
    );
  }
  if (id === 'manufacturing') {
    return (
      <>
        <p className="text-[0.92rem] font-semibold text-[#071b2b]">WO-204</p>
        <p className="mt-1 text-[0.68rem] text-[#4d6472]">{ar ? 'تشغيل 86%' : 'WIP 86%'}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eaf6fc]">
          <div className="h-full w-[86%] rounded-full bg-[#0b6fa4]" />
        </div>
      </>
    );
  }
  return (
    <>
      <p className="text-[0.92rem] font-semibold text-[#071b2b]">{ar ? 'مجمع النيل' : 'Nile Complex'}</p>
      <p className="mt-1 text-[0.68rem] text-[#4d6472]">{ar ? 'هامش 18%' : '18% margin'}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eaf6fc]">
        <div className="h-full w-[72%] rounded-full bg-[#0b6fa4]" />
      </div>
    </>
  );
}

export function ModulePanel({ id, name, locale, cardRef }: ModulePanelProps) {
  return (
    <div
      ref={cardRef}
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[13.5rem] overflow-hidden rounded-[16px] border border-[#d7eaf4] bg-white shadow-[0_20px_50px_rgba(7,27,43,0.12)] md:w-[16.5rem]"
      style={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between bg-[#071b2b] px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#1499d6]" />
        <p className="text-[0.68rem] font-medium text-white">{name}</p>
        <span className="h-1.5 w-5 rounded-full bg-white/20" />
      </div>
      <div className="px-3.5 py-3">
        <LayerBody id={id} locale={locale} />
      </div>
    </div>
  );
}
