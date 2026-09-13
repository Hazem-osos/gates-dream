type BrowserFrameProps = {
  title: string;
  note: string;
  sampleLabel: string;
  frameRef?: (el: HTMLDivElement | null) => void;
};

export function BrowserFrame({ title, note, sampleLabel, frameRef }: BrowserFrameProps) {
  return (
    <div
      ref={frameRef}
      className="gates-browser pointer-events-none absolute inset-x-[4%] top-[18%] z-30 mx-auto w-[min(92%,56rem)] overflow-hidden border border-white/12 bg-[#0C0C0C] opacity-0 md:inset-x-auto"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
        <span className="mx-auto max-w-[16rem] truncate font-mono text-[0.62rem] tracking-[0.14em] text-white/40">
          gates.system / {title.toLowerCase().replace(/\s+/g, '-')}
        </span>
      </div>
      <div className="relative grid gap-3 p-4 md:grid-cols-12 md:p-6">
        <div className="md:col-span-8">
          <p className="font-mono text-[0.58rem] tracking-[0.22em] text-white/30">{sampleLabel}</p>
          <p className="mt-2 text-lg text-[#F5F5F1] md:text-2xl">{title}</p>
          <p className="mt-1 text-xs text-white/40">{note}</p>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {['01', '02', '03'].map((n) => (
              <div key={n} className="h-16 border border-white/10 bg-white/[0.03] md:h-24">
                <span className="block p-2 font-mono text-[0.55rem] text-white/25">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-rows-4 gap-2 md:col-span-4">
          {['LEDGER', 'CASH', 'STOCK', 'OPS'].map((row) => (
            <div key={row} className="flex items-center justify-between border border-white/10 px-3 py-2">
              <span className="font-mono text-[0.58rem] tracking-[0.16em] text-white/35">{row}</span>
              <span className="h-px w-10 bg-white/15" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
