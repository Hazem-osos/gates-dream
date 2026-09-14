import type { MarketingCopy } from '../../lib/marketing/copy';

export type OpeningCopy = MarketingCopy['opening'];

const chrome =
  'pointer-events-none overflow-hidden rounded-[22px] border border-[#d4e8f3] bg-white text-[#0b1620]';

function SampleMark({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[#eaf6fc] px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.14em] text-[#0b6fa4]">
      {label}
    </span>
  );
}

export function SalesOrderObject({
  copy,
  cardRef,
}: {
  copy: OpeningCopy;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={cardRef}
      className={`${chrome} relative w-[min(34rem,86vw)] origin-center px-8 py-8 md:px-10 md:py-10`}
      style={{
        boxShadow: '0 36px 90px rgba(7, 27, 43, 0.16), 0 8px 22px rgba(11, 111, 164, 0.08)',
      }}
    >
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.2em] text-[#0b6fa4]">{copy.invoiceTitle}</p>
          <p className="mt-2 text-[1.7rem] font-semibold leading-none text-[#071b2b]">{copy.invoiceNo}</p>
        </div>
        <SampleMark label={copy.sample} />
      </div>
      <div className="border-t border-[#e4f1f8] pt-5">
        <p className="text-[0.7rem] text-[#4d6472]">{copy.customer}</p>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[1.05rem] font-semibold text-[#071b2b]">{copy.item}</p>
            <p className="mt-1 text-[0.75rem] text-[#4d6472]">{copy.qty}</p>
          </div>
          <p className="text-[1.55rem] font-semibold tabular-nums leading-none text-[#071b2b]">
            {copy.amount}
            <span className="ms-1 text-[0.8rem] font-medium text-[#4d6472]">{copy.currency}</span>
          </p>
        </div>
      </div>
      <div className="mt-8 h-px bg-[#e4f1f8]" />
      <div className="mt-5 flex justify-between text-[0.72rem] text-[#4d6472]">
        <span>Cairo · HQ</span>
        <span>14 Sep 2026</span>
      </div>
    </div>
  );
}

export function SalesSurface({
  copy,
  surfaceRef,
  amountRef,
  statusRef,
  dockRef,
}: {
  copy: OpeningCopy;
  surfaceRef: (el: HTMLDivElement | null) => void;
  amountRef: (el: HTMLDivElement | null) => void;
  statusRef: (el: HTMLDivElement | null) => void;
  dockRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} absolute left-1/2 top-1/2 w-[min(52rem,92vw)] -translate-x-1/2 -translate-y-1/2`}
      style={{ boxShadow: '0 40px 110px rgba(7, 27, 43, 0.14)' }}
    >
      <div className="flex h-12 items-center justify-between border-b border-[#e4f1f8] bg-[#f7fbfd] px-5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1499d6]" />
          <span className="text-[0.78rem] font-semibold tracking-[0.16em] text-[#071b2b]">{copy.modules.sales}</span>
        </div>
        <SampleMark label={copy.sample} />
      </div>
      <div className="grid gap-6 px-6 py-6 md:grid-cols-[1.15fr_0.85fr] md:px-8 md:py-8">
        <div
          ref={dockRef}
          className="min-h-[14rem] rounded-[16px] border border-dashed border-[#cfe4f0] bg-[#f4fafd]"
        />
        <div className="flex flex-col justify-end">
          <div ref={amountRef}>
            <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#0b6fa4]">{copy.sale}</p>
            <p className="mt-2 text-[clamp(2.4rem,5vw,3.6rem)] font-semibold leading-none tabular-nums text-[#071b2b]">
              {copy.amount}
              <span className="ms-2 text-[1rem] font-medium text-[#4d6472]">{copy.currency}</span>
            </p>
          </div>
          <div
            ref={statusRef}
            className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-[#0b6fa4] px-3.5 py-1.5 text-[0.7rem] font-semibold tracking-[0.14em] text-white"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {copy.confirmed}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InventorySurface({
  copy,
  surfaceRef,
  stockRef,
  noteRef,
}: {
  copy: OpeningCopy;
  surfaceRef: (el: HTMLDivElement | null) => void;
  stockRef: (el: HTMLSpanElement | null) => void;
  noteRef: (el: HTMLParagraphElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} w-[min(24rem,78vw)] p-6 md:p-7`}
      style={{ boxShadow: '0 28px 70px rgba(7, 27, 43, 0.12)' }}
    >
      <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#0b6fa4]">{copy.modules.inventory}</p>
      <p className="mt-3 text-[1.15rem] font-semibold text-[#071b2b]">{copy.item}</p>
      <p className="mt-1 text-[0.75rem] text-[#4d6472]">{copy.warehouse}</p>
      <p className="mt-8 text-[0.68rem] text-[#4d6472]">{copy.stockLabel}</p>
      <p className="mt-1 text-[clamp(3.4rem,8vw,4.6rem)] font-semibold leading-none tabular-nums text-[#071b2b]">
        <span ref={stockRef}>124</span>
      </p>
      <p ref={noteRef} className="mt-4 text-[0.82rem] font-medium text-[#0b6fa4]">
        {copy.stockUpdated}
      </p>
    </div>
  );
}

export function AccountingSurface({
  copy,
  surfaceRef,
  revenueRef,
  receivableRef,
  ledgerRef,
}: {
  copy: OpeningCopy;
  surfaceRef: (el: HTMLDivElement | null) => void;
  revenueRef: (el: HTMLDivElement | null) => void;
  receivableRef: (el: HTMLDivElement | null) => void;
  ledgerRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} w-[min(26rem,80vw)] p-6 md:p-7`}
      style={{ boxShadow: '0 28px 70px rgba(7, 27, 43, 0.12)' }}
    >
      <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#0b6fa4]">{copy.modules.accounting}</p>
      <div ref={revenueRef} className="mt-6">
        <p className="text-[0.72rem] text-[#4d6472]">{copy.revenue}</p>
        <p className="mt-1 text-[1.8rem] font-semibold tabular-nums text-[#071b2b]">+{copy.amount}</p>
      </div>
      <div ref={receivableRef} className="mt-4">
        <p className="text-[0.72rem] text-[#4d6472]">{copy.receivable}</p>
        <p className="mt-1 text-[1.8rem] font-semibold tabular-nums text-[#071b2b]">+{copy.amount}</p>
      </div>
      <div
        ref={ledgerRef}
        className="mt-6 rounded-[14px] border border-[#d7eaf4] bg-[#f7fbfd] px-4 py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] tracking-[0.12em] text-[#4d6472]">{copy.journal}</p>
            <p className="mt-1 text-[0.95rem] font-semibold text-[#071b2b]">JE-9022</p>
          </div>
          <span className="rounded-full bg-[#0b6fa4] px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.12em] text-white">
            {copy.posted}
          </span>
        </div>
        <div className="mt-3 space-y-1.5 text-[0.72rem] text-[#4d6472]">
          <div className="flex justify-between">
            <span>1121 · {copy.receivable}</span>
            <span className="tabular-nums">{copy.amount}</span>
          </div>
          <div className="flex justify-between">
            <span>4110 · {copy.revenue}</span>
            <span className="tabular-nums">{copy.amount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModuleTile({
  label,
  tileRef,
}: {
  label: string;
  tileRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={tileRef}
      className={`${chrome} flex h-[7.2rem] w-[11.4rem] items-end p-4 md:h-[8.2rem] md:w-[13.2rem]`}
      style={{ boxShadow: '0 18px 40px rgba(7, 27, 43, 0.1)' }}
    >
      <p className="text-[0.78rem] font-semibold tracking-[0.16em] text-[#071b2b]">{label}</p>
    </div>
  );
}
