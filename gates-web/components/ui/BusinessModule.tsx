import type { HeroModuleSide } from '../../data/modules';

type BusinessModuleProps = {
  number: string;
  name: string;
  side: HeroModuleSide;
  cardRef: (el: HTMLDivElement | null) => void;
  frameRef: (el: HTMLDivElement | null) => void;
  nameRef: (el: HTMLSpanElement | null) => void;
};

/** Which edge of this block carries the connection port — always the edge facing the Gates Engine. */
const PORT_EDGE: Record<HeroModuleSide, HeroModuleSide> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

const PORT_POSITION: Record<HeroModuleSide, string> = {
  right: 'right-[-3px] top-1/2 -translate-y-1/2 h-3.5 w-1.5',
  left: 'left-[-3px] top-1/2 -translate-y-1/2 h-3.5 w-1.5',
  bottom: 'bottom-[-3px] left-1/2 -translate-x-1/2 h-1.5 w-3.5',
  top: 'top-[-3px] left-1/2 -translate-x-1/2 h-1.5 w-3.5',
};

/**
 * Physical ERP module block. Travels a straight mechanical rail toward the Gates Engine
 * and docks — connection port aligned to the matching engine port on `side`.
 */
export function BusinessModule({ number, name, side, cardRef, frameRef, nameRef }: BusinessModuleProps) {
  const portEdge = PORT_EDGE[side];

  return (
    <div
      ref={cardRef}
      data-module={number}
      data-side={side}
      className="gates-module pointer-events-none absolute left-1/2 top-1/2 z-20 w-[clamp(8.5rem,17vw,14.5rem)]"
    >
      <div
        ref={frameRef}
        className="relative border-[1.5px] border-[var(--gates-blue)] bg-[var(--gates-white)] px-3 py-3 shadow-[0_10px_24px_-12px_rgba(4,16,28,0.35)] md:px-4 md:py-3.5"
      >
        {/* corner ticks — technical frame */}
        <span className="absolute left-1 top-1 h-2 w-2 border-l border-t border-[var(--gates-blue)]/50" />
        <span className="absolute right-1 top-1 h-2 w-2 border-r border-t border-[var(--gates-blue)]/50" />
        <span className="absolute bottom-1 left-1 h-2 w-2 border-b border-l border-[var(--gates-blue)]/50" />
        <span className="absolute bottom-1 right-1 h-2 w-2 border-b border-r border-[var(--gates-blue)]/50" />

        {/* connection port — aligns with the matching Gates Engine port */}
        <span className={`absolute bg-[var(--gates-blue)] ${PORT_POSITION[portEdge]}`} aria-hidden />

        <p className="font-mono text-[0.6rem] tracking-[0.22em] text-[var(--gates-blue)]/60">{number}</p>
        <span
          ref={nameRef}
          className="mt-1 block text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--gates-navy)] md:text-[0.86rem]"
        >
          {name}
        </span>

        {/* inner UI markings — subtle data rows */}
        <div className="mt-2.5 flex flex-col gap-1">
          <span className="h-px w-full bg-[var(--gates-blue)]/18" />
          <span className="h-px w-2/3 bg-[var(--gates-blue)]/18" />
        </div>
      </div>
    </div>
  );
}
