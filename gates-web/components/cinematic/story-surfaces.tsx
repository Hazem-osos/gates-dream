import type { MarketingCopy } from '../../lib/marketing/copy';
import { DEMO_COMPANY, demoText, type DemoLocale } from '../../lib/marketing/demo-company';

export type CompanyStoryCopy = MarketingCopy['companyStory'];

const chrome =
  'pointer-events-none overflow-hidden rounded-[22px] border border-[#d4e8f3] bg-white text-[#0b1620] opacity-0';

function SampleMark({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[#eaf6fc] px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.14em] text-[#0b6fa4]">
      {label}
    </span>
  );
}

export function PosSurface({
  copy,
  sample,
  locale,
  surfaceRef,
}: {
  copy: CompanyStoryCopy;
  sample: string;
  locale: DemoLocale;
  surfaceRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} w-[min(34rem,86vw)] px-7 py-7 md:px-9 md:py-8`}
      style={{ boxShadow: '0 36px 90px rgba(7, 27, 43, 0.16)' }}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.2em] text-[#0b6fa4]">{copy.posTitle}</p>
          <p className="mt-2 text-[1.55rem] font-semibold leading-none text-[#071b2b]">{DEMO_COMPANY.saleId}</p>
        </div>
        <SampleMark label={sample} />
      </div>
      <div className="border-t border-[#e4f1f8] pt-5">
        <p className="text-[0.7rem] text-[#4d6472]">{demoText(DEMO_COMPANY.customer, locale)}</p>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[1.05rem] font-semibold text-[#071b2b]">{copy.saleFact}</p>
            <p className="mt-1 text-[0.75rem] text-[#4d6472]">{demoText(DEMO_COMPANY.skuName, locale)}</p>
          </div>
          <p className="text-[1.55rem] font-semibold tabular-nums leading-none text-[#071b2b]">
            {DEMO_COMPANY.amount}
            <span className="ms-1 text-[0.8rem] font-medium text-[#4d6472]">
              {demoText(DEMO_COMPANY.currency, locale)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function WarehouseUpdateCard({
  copy,
  surfaceRef,
  qtyRef,
}: {
  copy: CompanyStoryCopy;
  surfaceRef: (el: HTMLDivElement | null) => void;
  qtyRef: (el: HTMLSpanElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} w-[min(22rem,78vw)] p-6`}
      style={{ boxShadow: '0 28px 70px rgba(7, 27, 43, 0.12)' }}
    >
      <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#0b6fa4]">{copy.warehouseOnHand}</p>
      <p className="mt-2 text-[1.05rem] font-semibold text-[#071b2b]">{DEMO_COMPANY.sku}</p>
      <p className="mt-6 text-[clamp(3rem,7vw,4.2rem)] font-semibold leading-none tabular-nums text-[#071b2b]">
        <span ref={qtyRef}>{DEMO_COMPANY.warehouseAfterAct1}</span>
      </p>
      <p className="mt-3 text-[0.82rem] font-medium text-[#0b6fa4]">{copy.stockUpdated}</p>
    </div>
  );
}

export function JournalUpdateCard({
  copy,
  locale,
  surfaceRef,
}: {
  copy: CompanyStoryCopy;
  locale: DemoLocale;
  surfaceRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} w-[min(24rem,80vw)] p-6`}
      style={{ boxShadow: '0 28px 70px rgba(7, 27, 43, 0.12)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#0b6fa4]">{copy.journal}</p>
          <p className="mt-1 text-[1.05rem] font-semibold text-[#071b2b]">{DEMO_COMPANY.journalId}</p>
        </div>
        <span className="rounded-full bg-[#0b6fa4] px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.12em] text-white">
          {copy.posted}
        </span>
      </div>
      <div className="mt-5 space-y-2 text-[0.82rem]">
        <div className="flex justify-between text-[#071b2b]">
          <span>{copy.receivable}</span>
          <span className="tabular-nums font-semibold">+{DEMO_COMPANY.amount}</span>
        </div>
        <div className="flex justify-between text-[#4d6472]">
          <span>{copy.revenue}</span>
          <span className="tabular-nums">+{DEMO_COMPANY.amount}</span>
        </div>
      </div>
      <p className="mt-4 text-[0.72rem] text-[#4d6472]">{demoText(DEMO_COMPANY.currency, locale)}</p>
    </div>
  );
}

export function CustomerUpdateCard({
  copy,
  locale,
  surfaceRef,
}: {
  copy: CompanyStoryCopy;
  locale: DemoLocale;
  surfaceRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} w-[min(22rem,78vw)] p-6`}
      style={{ boxShadow: '0 28px 70px rgba(7, 27, 43, 0.12)' }}
    >
      <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#0b6fa4]">{demoText(DEMO_COMPANY.customer, locale)}</p>
      <p className="mt-5 text-[1.7rem] font-semibold tabular-nums leading-none text-[#071b2b]">
        +{DEMO_COMPANY.amount}
      </p>
      <p className="mt-3 text-[0.82rem] font-medium text-[#0b6fa4]">{copy.customerBalance}</p>
    </div>
  );
}

export function StockWarningCard({
  copy,
  surfaceRef,
}: {
  copy: CompanyStoryCopy;
  surfaceRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} w-[min(22rem,78vw)] border-[#f0d4c4] p-6`}
      style={{ boxShadow: '0 28px 70px rgba(7, 27, 43, 0.12)' }}
    >
      <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#0b6fa4]">{copy.warningSku}</p>
      <p className="mt-5 text-[clamp(3rem,7vw,4.2rem)] font-semibold leading-none tabular-nums text-[#071b2b]">
        {DEMO_COMPANY.retailShelf}
        <span className="ms-2 text-[1rem] font-medium text-[#4d6472]">{copy.shelfLeft}</span>
      </p>
      <p className="mt-3 text-[0.85rem] text-[#0b6fa4]">
        {copy.reorder} {DEMO_COMPANY.reorderPoint}
      </p>
    </div>
  );
}

export function BriefingCard({
  copy,
  sample,
  surfaceRef,
}: {
  copy: CompanyStoryCopy;
  sample: string;
  surfaceRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} w-[min(32rem,88vw)] p-6 md:p-7`}
      style={{ boxShadow: '0 32px 80px rgba(7, 27, 43, 0.14)' }}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[1.15rem] font-semibold leading-snug text-[#071b2b]">{copy.briefingTitle}</p>
        <SampleMark label={sample} />
      </div>
      <ol className="space-y-2.5 text-[0.9rem] text-[#071b2b]">
        <li className="rounded-[14px] bg-[#f7fbfd] px-3.5 py-2.5">{copy.brief1}</li>
        <li className="rounded-[14px] bg-[#f7fbfd] px-3.5 py-2.5">{copy.brief2}</li>
        <li className="rounded-[14px] bg-[#f7fbfd] px-3.5 py-2.5">{copy.brief3}</li>
      </ol>
    </div>
  );
}

export function ProbeTile({
  label,
  tileRef,
  checkRef,
}: {
  label: string;
  tileRef: (el: HTMLDivElement | null) => void;
  checkRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={tileRef}
      className={`${chrome} relative flex h-[4.8rem] w-[9.4rem] items-end p-3 md:h-[5.4rem] md:w-[11rem]`}
      style={{ boxShadow: '0 16px 36px rgba(7, 27, 43, 0.1)' }}
    >
      <p className="text-[0.72rem] font-semibold tracking-[0.14em] text-[#071b2b]">{label}</p>
      <div
        ref={checkRef}
        className="absolute end-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#0b6fa4] text-[0.62rem] font-semibold text-white opacity-0"
      >
        ✓
      </div>
    </div>
  );
}

export function AnswerCard({
  copy,
  surfaceRef,
}: {
  copy: CompanyStoryCopy;
  surfaceRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} w-[min(34rem,88vw)] p-6 md:p-7`}
      style={{ boxShadow: '0 32px 80px rgba(7, 27, 43, 0.14)' }}
    >
      <div className="space-y-3 text-[0.92rem] text-[#071b2b]">
        <p>{copy.answerSales}</p>
        <p>{copy.answerStock}</p>
        <p>{copy.answerSupplier}</p>
      </div>
      <p className="mt-5 text-[1rem] font-semibold text-[#0b6fa4]">{copy.recommend}</p>
    </div>
  );
}

export function DraftActionCard({
  copy,
  sample,
  locale,
  surfaceRef,
  notSavedRef,
  confirmRef,
  createdRef,
}: {
  copy: CompanyStoryCopy;
  sample: string;
  locale: DemoLocale;
  surfaceRef: (el: HTMLDivElement | null) => void;
  notSavedRef: (el: HTMLParagraphElement | null) => void;
  confirmRef: (el: HTMLDivElement | null) => void;
  createdRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} w-[min(34rem,88vw)] p-6 md:p-7`}
      style={{ boxShadow: '0 32px 80px rgba(7, 27, 43, 0.14)' }}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#0b6fa4]">{copy.draftDoc}</p>
          <p className="mt-1 text-[1.15rem] font-semibold text-[#071b2b]">{DEMO_COMPANY.draftId}</p>
        </div>
        <SampleMark label={sample} />
      </div>
      <div className="space-y-2 text-[0.88rem] text-[#071b2b]">
        <div className="flex justify-between">
          <span className="text-[#4d6472]">{demoText(DEMO_COMPANY.supplier, locale)}</span>
          <span>{DEMO_COMPANY.sku} × {DEMO_COMPANY.restockQty}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#4d6472]">{copy.draftAction}</span>
          <span className="tabular-nums font-semibold">
            {DEMO_COMPANY.draftTotal} {demoText(DEMO_COMPANY.currency, locale)}
          </span>
        </div>
      </div>
      <p ref={notSavedRef} className="mt-5 text-[0.85rem] font-medium text-[#0b6fa4] opacity-0">
        {copy.notSaved}
      </p>
      <div
        ref={confirmRef}
        className="mt-4 inline-flex rounded-full bg-[#0b6fa4] px-4 py-2 text-[0.72rem] font-semibold tracking-[0.12em] text-white opacity-0"
      >
        {copy.confirmDraft}
      </div>
      <div
        ref={createdRef}
        className="mt-4 text-[0.85rem] font-semibold text-[#071b2b] opacity-0"
      >
        {copy.draftCreated}
      </div>
    </div>
  );
}

export function PurchaseEffectCard({
  copy,
  locale,
  surfaceRef,
  qtyRef,
}: {
  copy: CompanyStoryCopy;
  locale: DemoLocale;
  surfaceRef: (el: HTMLDivElement | null) => void;
  qtyRef: (el: HTMLSpanElement | null) => void;
}) {
  return (
    <div
      ref={surfaceRef}
      className={`${chrome} w-[min(26rem,84vw)] p-6`}
      style={{ boxShadow: '0 28px 70px rgba(7, 27, 43, 0.12)' }}
    >
      <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#0b6fa4]">{copy.expectedStock}</p>
      <p className="mt-4 text-[clamp(2.8rem,6vw,3.8rem)] font-semibold leading-none tabular-nums text-[#071b2b]">
        <span ref={qtyRef}>{DEMO_COMPANY.retailShelf}</span>
      </p>
      <div className="mt-5 space-y-1.5 text-[0.82rem] text-[#071b2b]">
        <p>{copy.supplierUpdated}</p>
        <p>
          {copy.payables} +{DEMO_COMPANY.draftTotal} {demoText(DEMO_COMPANY.currency, locale)}
        </p>
        <p>{copy.cashForecast}</p>
      </div>
    </div>
  );
}
