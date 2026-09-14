import type { MarketingLocale } from '../../lib/marketing/copy';

const NAV = [
  { key: 'dash', en: 'Dashboard', ar: 'لوحة التحكم' },
  { key: 'acc', en: 'Accounting', ar: 'المحاسبة' },
  { key: 'sales', en: 'Sales', ar: 'المبيعات' },
  { key: 'inv', en: 'Inventory', ar: 'المخزون' },
  { key: 'crm', en: 'CRM', ar: 'العلاقات' },
  { key: 'hr', en: 'HR', ar: 'الموارد البشرية' },
  { key: 'mfg', en: 'Manufacturing', ar: 'التصنيع' },
  { key: 'prj', en: 'Projects', ar: 'المشاريع' },
] as const;

const KPIS = [
  { en: 'Revenue', ar: 'الإيرادات', value: '2.41M', delta: '+12.4%', up: true },
  { en: 'Gross Profit', ar: 'إجمالي الربح', value: '812K', delta: '+6.1%', up: true },
  { en: 'Receivables', ar: 'الذمم المدينة', value: '430K', delta: '−3.2%', up: false },
  { en: 'Cash Balance', ar: 'الرصيد النقدي', value: '1.18M', delta: '+8.0%', up: true },
] as const;

const TX = [
  { id: 'INV-1842', party: { en: 'Nile Trading', ar: 'شركة النيل' }, amt: '48,200', type: { en: 'Invoice', ar: 'فاتورة' } },
  { id: 'JE-9021', party: { en: 'Depreciation', ar: 'إهلاك الأصول' }, amt: '6,400', type: { en: 'Journal', ar: 'قيد' } },
  { id: 'PO-441', party: { en: 'Raw materials', ar: 'مواد خام' }, amt: '19,750', type: { en: 'Purchase', ar: 'شراء' } },
  { id: 'POS-77', party: { en: 'Branch 03', ar: 'فرع 03' }, amt: '3,180', type: { en: 'POS', ar: 'نقطة بيع' } },
] as const;

const STOCK = [
  { name: { en: 'Steel coil', ar: 'لفائف صلب' }, qty: 12 },
  { name: { en: 'Packaging', ar: 'مواد تغليف' }, qty: 28 },
  { name: { en: 'Finished A', ar: 'منتج نهائي أ' }, qty: 146 },
] as const;

const BRANCHES = [
  { name: { en: 'HQ', ar: 'المركز' }, w: 88 },
  { name: { en: 'Alexandria', ar: 'الإسكندرية' }, w: 64 },
  { name: { en: 'Jeddah', ar: 'جدة' }, w: 71 },
] as const;

type ProductDashboardProps = {
  locale: MarketingLocale;
  sample: string;
  title: string;
};

export function ProductDashboard({ locale, sample, title }: ProductDashboardProps) {
  const ar = locale === 'ar';

  return (
    <div dir="ltr" className="flex h-full min-h-[22rem] w-full flex-col overflow-hidden rounded-[16px] border border-[#d7eaf4] bg-white text-[#0b1620] shadow-[0_28px_80px_rgba(7,27,43,0.18)]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#d7eaf4] bg-white px-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1499d6]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#d7eaf4]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#d7eaf4]" />
          <p className="ms-2 text-[0.78rem] font-semibold text-[#071b2b]">{title}</p>
        </div>
        <p className="rounded-full bg-[#eaf6fc] px-2.5 py-1 text-[0.62rem] font-medium text-[#0b6fa4]">{sample}</p>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[11rem] shrink-0 flex-col bg-[#071b2b] py-4 text-white md:flex">
          <p className="px-4 pb-4 text-[0.72rem] font-semibold tracking-[0.22em] text-[#1499d6]">GATES</p>
          <nav className="flex flex-1 flex-col gap-0.5 px-2">
            {NAV.map((item, i) => (
              <span
                key={item.key}
                className={`rounded-lg px-3 py-2 text-[0.78rem] ${
                  i === 0 ? 'bg-[#0b6fa4] text-white' : 'text-white/60'
                }`}
              >
                {ar ? item.ar : item.en}
              </span>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[#f7fbfd]">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[#d7eaf4] bg-white px-4">
            <div className="flex h-8 flex-1 items-center rounded-lg border border-[#d7eaf4] bg-[#f7fbfd] px-3 text-[0.72rem] text-[#4d6472]">
              {ar ? 'بحث في النظام…' : 'Search the platform…'}
            </div>
            <span className="hidden h-8 items-center rounded-lg border border-[#d7eaf4] px-3 text-[0.68rem] text-[#4d6472] sm:inline-flex">
              {ar ? 'هذا الشهر' : 'This month'}
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#eaf6fc] text-[0.68rem] font-semibold text-[#0b6fa4]">
              3
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#071b2b] text-[0.62rem] font-semibold text-white">
              AM
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-3 md:p-4">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {KPIS.map((kpi) => (
                <div key={kpi.en} className="rounded-2xl border border-[#d7eaf4] bg-white px-3 py-3 shadow-[0_12px_32px_rgba(7,27,43,0.05)]">
                  <p className="text-[0.68rem] text-[#4d6472]">{ar ? kpi.ar : kpi.en}</p>
                  <div className="mt-1.5 flex items-end justify-between gap-2">
                    <p className="text-[1.35rem] font-semibold tracking-tight md:text-[1.55rem]">{kpi.value}</p>
                    <p className={`text-[0.68rem] font-medium ${kpi.up ? 'text-[#0b6fa4]' : 'text-[#b45353]'}`}>{kpi.delta}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2.5 grid min-h-0 grid-cols-1 gap-2.5 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-[#d7eaf4] bg-white p-3.5 shadow-[0_12px_32px_rgba(7,27,43,0.05)]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[0.78rem] font-semibold">{ar ? 'الإيرادات مقابل المصروفات' : 'Revenue vs Expenses'}</p>
                  <span className="text-[0.62rem] text-[#4d6472]">{ar ? 'آخر 8 أشهر' : 'Last 8 months'}</span>
                </div>
                <svg viewBox="0 0 320 132" className="h-[7rem] w-full md:h-[9rem]" aria-hidden>
                  <defs>
                    <linearGradient id="gates-rev-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#1499d6" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#1499d6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[28, 56, 84, 112].map((y) => (
                    <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="#eaf6fc" strokeWidth="1" />
                  ))}
                  <path d="M0 100 L40 86 L80 90 L120 64 L160 70 L200 44 L240 50 L280 30 L320 36 V132 H0 Z" fill="url(#gates-rev-fill)" />
                  <path d="M0 100 L40 86 L80 90 L120 64 L160 70 L200 44 L240 50 L280 30 L320 36" fill="none" stroke="#0b6fa4" strokeWidth="2.4" />
                  <path d="M0 114 L40 108 L80 110 L120 98 L160 102 L200 90 L240 94 L280 82 L320 84" fill="none" stroke="#7aa8c4" strokeWidth="1.8" />
                </svg>
                <div className="mt-2 flex gap-4 text-[0.62rem] text-[#4d6472]">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-1.5 w-3 rounded-full bg-[#0b6fa4]" />
                    {ar ? 'إيراد' : 'Revenue'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-1.5 w-3 rounded-full bg-[#7aa8c4]" />
                    {ar ? 'مصروف' : 'Expense'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-[#d7eaf4] bg-white p-3.5">
                  <p className="text-[0.72rem] font-semibold">{ar ? 'تنبيه المخزون' : 'Low stock'}</p>
                  <div className="mt-3 space-y-2.5">
                    {STOCK.map((row) => (
                      <div key={row.name.en} className="flex items-center justify-between text-[0.7rem]">
                        <span className="truncate text-[#4d6472]">{ar ? row.name.ar : row.name.en}</span>
                        <span className={row.qty < 40 ? 'font-semibold text-[#0b6fa4]' : 'text-[#071b2b]'}>{row.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#d7eaf4] bg-white p-3.5">
                  <p className="text-[0.72rem] font-semibold">{ar ? 'التدفق النقدي' : 'Cash flow'}</p>
                  <p className="mt-2 text-[1.45rem] font-semibold tracking-tight">+186K</p>
                  <div className="mt-3 flex h-12 items-end gap-1">
                    {[32, 48, 28, 64, 44, 72, 58, 80].map((h, i) => (
                      <span key={i} className="flex-1 rounded-sm bg-[#1499d6]" style={{ height: `${h}%`, opacity: 0.45 + i * 0.06 }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2.5 hidden grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-2.5 md:grid">
              <div className="rounded-2xl border border-[#d7eaf4] bg-white p-3.5">
                <p className="mb-3 text-[0.72rem] font-semibold">{ar ? 'آخر الحركات' : 'Recent transactions'}</p>
                <div className="mb-2 grid grid-cols-[5.6rem_1fr_auto] gap-2 text-[0.62rem] text-[#4d6472]">
                  <span>{ar ? 'رقم' : 'ID'}</span>
                  <span>{ar ? 'الجهة' : 'Party'}</span>
                  <span>{ar ? 'المبلغ' : 'Amount'}</span>
                </div>
                <div className="space-y-2">
                  {TX.map((row) => (
                    <div key={row.id} className="grid grid-cols-[5.6rem_1fr_auto] items-center gap-2 text-[0.72rem]">
                      <span className="font-medium text-[#0b6fa4]">{row.id}</span>
                      <span className="truncate text-[#4d6472]">{ar ? row.party.ar : row.party.en}</span>
                      <span className="tabular-nums font-semibold">{row.amt}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[#d7eaf4] bg-white p-3.5">
                <p className="mb-3 text-[0.72rem] font-semibold">{ar ? 'أداء الفروع' : 'Branch performance'}</p>
                <div className="space-y-3">
                  {BRANCHES.map((b) => (
                    <div key={b.name.en}>
                      <div className="mb-1 flex justify-between text-[0.68rem] text-[#4d6472]">
                        <span>{ar ? b.name.ar : b.name.en}</span>
                        <span>{b.w}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#eaf6fc]">
                        <div className="h-full rounded-full bg-[#0b6fa4]" style={{ width: `${b.w}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
