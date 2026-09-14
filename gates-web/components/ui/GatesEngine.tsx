import { HERO_MODULES } from '../../data/modules';

type GatesEngineProps = {
  label: string;
  frameRef: (el: HTMLDivElement | null) => void;
  coreRef: (el: HTMLDivElement | null) => void;
  coreLabelRef: (el: HTMLDivElement | null) => void;
  dashboardRef: (el: HTMLDivElement | null) => void;
  tabBarRef: (el: HTMLDivElement | null) => void;
  sidebarWordRef: (el: HTMLSpanElement | null) => void;
  portsRef: (el: HTMLDivElement | null) => void;
  engineLabelRef: (el: HTMLParagraphElement | null) => void;
};

/**
 * GATES ENGINE — the modular ERP core. A tall chassis with connection ports on every
 * edge; business modules physically dock into it. Later in the hero it re-shapes into
 * the browser-like ERP interface frame — same DOM nodes, not a crossfade.
 */
export function GatesEngine({
  label,
  frameRef,
  coreRef,
  coreLabelRef,
  dashboardRef,
  tabBarRef,
  sidebarWordRef,
  portsRef,
  engineLabelRef,
}: GatesEngineProps) {
  const leftPorts = HERO_MODULES.filter((m) => m.side === 'left');
  const rightPorts = HERO_MODULES.filter((m) => m.side === 'right');
  const bottomPorts = HERO_MODULES.filter((m) => m.side === 'bottom');
  const topPorts = HERO_MODULES.filter((m) => m.side === 'top');

  return (
    <div
      ref={frameRef}
      className="gates-engine pointer-events-none absolute left-1/2 top-1/2 z-10 h-[58vh] w-[6.5rem] border-2 border-[var(--gates-blue)] bg-[var(--gates-white)] md:h-[60vh] md:w-[8rem]"
    >
      {/* browser tab bar — hidden until the dashboard transformation */}
      <div
        ref={tabBarRef}
        className="absolute inset-x-0 top-0 z-20 flex h-9 items-center gap-2 border-b border-[var(--gates-blue)]/25 bg-[var(--gates-white)] px-3 opacity-0"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--gates-blue)]/30" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--gates-blue)]/30" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--gates-blue)]/30" />
        <span className="mx-auto max-w-[16rem] truncate font-mono text-[0.6rem] tracking-[0.14em] text-[var(--gates-navy)]/45">
          gates.system / dashboard
        </span>
      </div>

      {/* engine label + coordinates */}
      <p
        ref={engineLabelRef}
        className="absolute left-1/2 top-3 -translate-x-1/2 text-center font-mono text-[0.52rem] tracking-[0.28em] text-[var(--gates-blue)]/55"
      >
        {label}
      </p>

      {/* port ticks — grid markings on every edge, faded out once the dashboard forms */}
      <div ref={portsRef}>
        {leftPorts.map((m) => (
          <span
            key={m.id}
            aria-hidden
            className="absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center border border-[var(--gates-blue)] bg-[var(--gates-white)] font-mono text-[0.42rem] text-[var(--gates-blue)]"
            style={{ top: `${m.edgePosition}%` }}
          >
            {m.index}
          </span>
        ))}
        {rightPorts.map((m) => (
          <span
            key={m.id}
            aria-hidden
            className="absolute -right-[7px] flex h-3.5 w-3.5 items-center justify-center border border-[var(--gates-blue)] bg-[var(--gates-white)] font-mono text-[0.42rem] text-[var(--gates-blue)]"
            style={{ top: `${m.edgePosition}%` }}
          >
            {m.index}
          </span>
        ))}
        {bottomPorts.map((m) => (
          <span
            key={m.id}
            aria-hidden
            className="absolute -bottom-[7px] flex h-3.5 w-3.5 items-center justify-center border border-[var(--gates-blue)] bg-[var(--gates-white)] font-mono text-[0.42rem] text-[var(--gates-blue)]"
            style={{ left: `${m.edgePosition}%` }}
          >
            {m.index}
          </span>
        ))}
        {topPorts.map((m) => (
          <span
            key={m.id}
            aria-hidden
            className="absolute -top-[7px] flex h-3.5 w-3.5 items-center justify-center border border-[var(--gates-blue)] bg-[var(--gates-white)] font-mono text-[0.42rem] text-[var(--gates-blue)]"
            style={{ left: `${m.edgePosition}%` }}
          >
            {m.index}
          </span>
        ))}
      </div>

      {/* CORE — starts as the small processor mark, later grows into the dashboard canvas */}
      <div
        ref={coreRef}
        className="absolute left-1/2 top-1/2 flex h-16 w-16 flex-col items-center justify-center border border-[var(--gates-blue)] bg-[var(--gates-blue)]/[0.06] md:h-20 md:w-20"
      >
        <span className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-[var(--gates-blue)]/40" />
        <span className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-[var(--gates-blue)]/40" />
        <span className="absolute left-0 top-1/2 h-px w-2 -translate-y-1/2 bg-[var(--gates-blue)]/40" />
        <span className="absolute right-0 top-1/2 h-px w-2 -translate-y-1/2 bg-[var(--gates-blue)]/40" />
        <div ref={coreLabelRef} className="px-1 text-center">
          <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[var(--gates-navy)] md:text-[0.66rem]">
            {label}
          </span>
        </div>

        {/* dashboard content — fades in as the core canvas expands into the browser body */}
        <div ref={dashboardRef} className="absolute inset-0 flex flex-col gap-3 p-4 opacity-0 md:p-6">
          <span
            ref={sidebarWordRef}
            className="font-mono text-[0.6rem] tracking-[0.22em] text-[var(--gates-blue)]/70"
          >
            EXECUTIVE DASHBOARD
          </span>
          <div className="grid flex-1 grid-cols-3 gap-2 md:gap-3">
            {['01', '02', '03'].map((n) => (
              <div key={n} className="border border-[var(--gates-blue)]/20 bg-[var(--gates-blue)]/[0.04] p-2 md:p-3">
                <span className="font-mono text-[0.5rem] text-[var(--gates-blue)]/45">{n}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-2 md:gap-2.5">
            {['LEDGER', 'STOCK', 'PIPELINE'].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between border border-[var(--gates-blue)]/15 px-3 py-2"
              >
                <span className="font-mono text-[0.52rem] tracking-[0.14em] text-[var(--gates-navy)]/55">
                  {row}
                </span>
                <span className="h-px w-10 bg-[var(--gates-blue)]/30" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { GatesEngineProps };
