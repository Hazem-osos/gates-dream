import type { ReactNode } from 'react';
import type { MarketingCopy } from '../../lib/marketing/copy';

export type ProductJourneyCopy = MarketingCopy['productJourney'];

const chrome =
  'overflow-hidden rounded-[22px] border border-[#d4e8f3] bg-white text-[#0b1620]';

function SampleMark({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[#eaf6fc] px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.14em] text-[#0b6fa4]">
      {label}
    </span>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#e4f1f8] bg-[#f7fbfd] px-3 py-3 md:px-4">
      <p className="text-[0.68rem] text-[#4d6472]">{label}</p>
      <p className="mt-1 text-[1.05rem] font-semibold tabular-nums leading-none text-[#071b2b] md:text-[1.2rem]">
        {value}
      </p>
    </div>
  );
}

export function ExecutiveDashboard({
  copy,
  dashRef,
  salesRef,
  inventoryRef,
  accountingRef,
}: {
  copy: ProductJourneyCopy;
  dashRef: (el: HTMLDivElement | null) => void;
  salesRef: (el: HTMLDivElement | null) => void;
  inventoryRef: (el: HTMLDivElement | null) => void;
  accountingRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={dashRef}
      className={`${chrome} pointer-events-none flex h-[min(78vh,44rem)] w-[min(86vw,72rem)] flex-col`}
      style={{ boxShadow: '0 40px 110px rgba(7, 27, 43, 0.14)' }}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#e4f1f8] bg-[#f7fbfd] px-5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1499d6]" />
          <span className="text-[0.78rem] font-semibold tracking-[0.2em] text-[#0b6fa4]">GATES</span>
        </div>
        <SampleMark label={copy.sample} />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-[#fbfefe] p-4 md:p-6">
        <p className="text-[clamp(1.4rem,2.4vw,2rem)] font-semibold leading-none text-[#071b2b]">{copy.greeting}</p>
        <p className="mt-2 text-[0.85rem] text-[#4d6472]">{copy.greetingSub}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <Kpi label={copy.sales} value={copy.salesValue} />
          <Kpi label={copy.profit} value={copy.profitValue} />
          <Kpi label={copy.receivables} value={copy.receivablesValue} />
          <Kpi label={copy.cash} value={copy.cashValue} />
        </div>

        <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-12">
          <div
            ref={salesRef}
            className="rounded-[16px] border border-[#d7eaf4] bg-white p-4 md:col-span-5"
          >
            <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-[#0b6fa4]">{copy.sales}</p>
            <p className="mt-3 text-[0.72rem] text-[#4d6472]">{copy.ordersToday}</p>
            <p className="text-[1.8rem] font-semibold tabular-nums text-[#071b2b]">{copy.ordersValue}</p>
            <p className="mt-3 text-[0.72rem] text-[#4d6472]">{copy.topCustomers}</p>
            <div className="mt-2 space-y-1.5 text-[0.8rem] text-[#071b2b]">
              <div className="flex justify-between">
                <span>{copy.customerA}</span>
                <span className="tabular-nums">84,250</span>
              </div>
              <div className="flex justify-between">
                <span>{copy.customerB}</span>
                <span className="tabular-nums">61,400</span>
              </div>
            </div>
            <svg viewBox="0 0 180 44" className="mt-4 h-11 w-full" aria-hidden>
              <path d="M2 34 L28 28 L54 30 L80 18 L108 22 L138 10 L178 14" fill="none" stroke="#0b6fa4" strokeWidth="2.2" />
            </svg>
          </div>

          <div
            ref={inventoryRef}
            className="rounded-[16px] border border-[#d7eaf4] bg-white p-4 md:col-span-4"
          >
            <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-[#0b6fa4]">{copy.warehouseStock}</p>
            <p className="mt-3 text-[1.8rem] font-semibold tabular-nums text-[#071b2b]">{copy.stockValue}</p>
            <p className="mt-3 text-[0.75rem] text-[#0b6fa4]">{copy.alert}</p>
            <p className="mt-4 text-[0.72rem] text-[#4d6472]">{copy.fastMoving}</p>
            <div className="mt-2 flex h-10 items-end gap-1">
              {[62, 88, 44, 96, 70, 58].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm bg-[#1499d6]"
                  style={{ height: `${h}%`, opacity: 0.4 + i * 0.08 }}
                />
              ))}
            </div>
            <p className="mt-3 text-[0.72rem] text-[#4d6472]">{copy.movement}</p>
          </div>

          <div
            ref={accountingRef}
            className="rounded-[16px] border border-[#d7eaf4] bg-white p-4 md:col-span-3"
          >
            <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-[#0b6fa4]">{copy.cashPosition}</p>
            <p className="mt-3 text-[1.35rem] font-semibold tabular-nums text-[#071b2b]">{copy.cashValue}</p>
            <p className="mt-4 text-[0.72rem] text-[#4d6472]">{copy.payables}</p>
            <p className="text-[1.05rem] font-semibold tabular-nums text-[#071b2b]">{copy.payablesValue}</p>
            <p className="mt-4 text-[0.72rem] text-[#4d6472]">{copy.journalActivity}</p>
            <p className="mt-1 text-[0.8rem] font-medium text-[#071b2b]">JE-9022</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="rounded-[14px] border border-[#e4f1f8] bg-white px-4 py-3">
            <p className="text-[0.68rem] text-[#4d6472]">{copy.chart}</p>
            <svg viewBox="0 0 220 36" className="mt-2 h-8 w-full" aria-hidden>
              <path d="M2 28 L30 22 L58 24 L90 14 L120 18 L160 8 L218 12" fill="none" stroke="#0b6fa4" strokeWidth="2" />
              <path d="M2 20 L30 24 L58 18 L90 22 L120 16 L160 20 L218 18" fill="none" stroke="#7eb6d4" strokeWidth="2" />
            </svg>
          </div>
          <div className="rounded-[14px] border border-[#e4f1f8] bg-white px-4 py-3">
            <p className="text-[0.68rem] text-[#4d6472]">{copy.branches}</p>
            <p className="mt-2 text-[0.8rem] font-medium text-[#0b6fa4]">{copy.insight}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LocationPlatform({
  label,
  platformRef,
  children,
  wide,
}: {
  label: string;
  platformRef: (el: HTMLDivElement | null) => void;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div ref={platformRef} className="pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
      <div
        className={`${wide ? 'w-[min(22rem,70vw)]' : 'w-[11.5rem]'} relative`}
        style={{ transform: 'rotateX(62deg) rotateZ(-14deg)' }}
      >
        <div className="h-3 rounded-full bg-[#0b6fa4]/20" />
        <div className="mt-1 h-[4.6rem] rounded-[18px] border border-[#cfe4f0] bg-gradient-to-br from-white to-[#eaf6fc] shadow-[0_18px_40px_rgba(7,27,43,0.1)]">
          {children}
        </div>
      </div>
      <p className="mt-3 text-center text-[0.68rem] font-semibold tracking-[0.14em] text-[#071b2b]">{label}</p>
    </div>
  );
}
