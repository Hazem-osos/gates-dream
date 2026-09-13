import type { ReactNode } from 'react';
import type { ConnectedModuleKey } from '../../../data/modules';
import type { MarketingLocale } from '../../../lib/marketing/copy';

type VisualProps = {
  sample: string;
  locale: MarketingLocale;
};

function Frame({ title, sample, children }: { title: string; sample: string; children: ReactNode }) {
  return (
    <div className="relative h-full min-h-[16rem] border border-white/12 bg-white/[0.02] p-4 md:min-h-0 md:p-6">
      <div className="mb-4 flex items-center justify-between font-mono text-[0.58rem] tracking-[0.22em] text-white/35">
        <span>{title}</span>
        <span>{sample}</span>
      </div>
      {children}
    </div>
  );
}

function AccountingVisual({ sample }: VisualProps) {
  return (
    <Frame title="LEDGER" sample={sample}>
      <div className="space-y-2">
        {['1100', '1200', '2100', '4100'].map((code, i) => (
          <div key={code} data-viz-row className="flex items-center gap-3 border-b border-white/8 py-2">
            <span className="w-10 font-mono text-[0.62rem] text-white/35">{code}</span>
            <span className="h-px flex-1 bg-white/15" />
            <span className="font-mono text-[0.62rem] text-white/50">{['84.2', '12.6', '41.0', '96.4'][i]}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="border border-white/10 px-3 py-3">
          <p className="font-mono text-[0.55rem] tracking-[0.18em] text-white/30">CASH</p>
          <p className="mt-1 text-lg text-white/80">● ● ● ● ○</p>
        </div>
        <div className="border border-white/10 px-3 py-3">
          <p className="font-mono text-[0.55rem] tracking-[0.18em] text-white/30">BALANCE</p>
          <p className="mt-1 text-lg text-white/80">— —</p>
        </div>
      </div>
      <svg className="mt-5 h-14 w-full text-white/40" viewBox="0 0 200 40" fill="none" aria-hidden>
        <path d="M0 28 L28 22 L56 26 L84 14 L112 18 L140 8 L168 12 L200 6" stroke="currentColor" strokeWidth="1" />
      </svg>
    </Frame>
  );
}

function InventoryVisual({ sample }: VisualProps) {
  return (
    <Frame title="WAREHOUSE" sample={sample}>
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            data-viz-block
            className="aspect-square border border-white/15"
            style={{ opacity: i % 5 === 0 ? 0.25 : 0.7 }}
          />
        ))}
      </div>
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.55rem] tracking-[0.18em] text-white/30">ON HAND</p>
          <p className="mt-1 font-mono text-2xl text-white/80">1,284</p>
        </div>
        <svg className="h-10 flex-1 text-white/35" viewBox="0 0 160 32" fill="none" aria-hidden>
          <path d="M0 16 H160" stroke="currentColor" strokeWidth="0.6" />
          <path d="M20 16 L44 8 L72 22 L108 10 L140 18" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    </Frame>
  );
}

function SalesVisual({ sample }: VisualProps) {
  const stages = ['QUOTE', 'ORDER', 'INVOICE', 'PAID'];
  return (
    <Frame title="PIPELINE" sample={sample}>
      <div className="flex flex-col gap-4">
        {stages.map((stage, i) => (
          <div key={stage} data-viz-stage className="flex items-center gap-3">
            <span className="w-16 font-mono text-[0.58rem] tracking-[0.16em] text-white/40">{stage}</span>
            <span className="relative h-px flex-1 bg-white/15">
              <span
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--accent)]"
                style={{ insetInlineStart: `${18 + i * 18}%` }}
              />
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function CrmVisual({ sample }: VisualProps) {
  return (
    <Frame title="RELATIONS" sample={sample}>
      <div className="space-y-3">
        {['A / HEAD OFFICE', 'B / BRANCH', 'C / KEY ACCOUNT'].map((row) => (
          <div key={row} className="flex items-center justify-between border border-white/10 px-3 py-3">
            <span className="font-mono text-[0.62rem] tracking-[0.14em] text-white/55">{row}</span>
            <span className="h-px w-12 bg-white/20" />
          </div>
        ))}
      </div>
    </Frame>
  );
}

function HrVisual({ sample }: VisualProps) {
  return (
    <Frame title="STRUCTURE" sample={sample}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-24 border border-white/20" />
        <span className="h-6 w-px bg-white/20" />
        <div className="grid w-full grid-cols-3 gap-2">
          <div className="h-10 border border-white/15" />
          <div className="h-10 border border-white/15" />
          <div className="h-10 border border-white/15" />
        </div>
        <div className="hidden w-full grid-cols-4 gap-2 md:grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 border border-white/10" />
          ))}
        </div>
      </div>
    </Frame>
  );
}

function ManufacturingVisual({ sample }: VisualProps) {
  return (
    <Frame title="FLOW" sample={sample}>
      <div className="flex items-center justify-between gap-2">
        {['MAT', 'WIP', 'FG'].map((node, i) => (
          <div key={node} className="flex flex-1 items-center gap-2">
            <div data-viz-node className="flex h-16 flex-1 items-center justify-center border border-white/15 font-mono text-[0.62rem] tracking-[0.18em] text-white/50">
              {node}
            </div>
            {i < 2 ? <span className="hidden h-px w-6 bg-white/25 md:block" /> : null}
          </div>
        ))}
      </div>
      <svg className="mt-6 h-8 w-full text-[var(--accent)]" viewBox="0 0 200 16" aria-hidden>
        <circle data-viz-pulse r="2" cx="8" cy="8" fill="currentColor" />
      </svg>
    </Frame>
  );
}

function ProjectsVisual({ sample }: VisualProps) {
  return (
    <Frame title="TIMELINE" sample={sample}>
      <div className="space-y-4">
        {[72, 48, 86].map((w, i) => (
          <div key={i}>
            <div className="mb-1 h-px w-full bg-white/10" />
            <div className="h-3 border border-white/15" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </Frame>
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
