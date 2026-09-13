import type { HeroModule } from '../../data/modules';
import type { MarketingLocale } from '../../lib/marketing/copy';

type ModuleCardProps = {
  module: HeroModule;
  locale: MarketingLocale;
  cardRef: (el: HTMLDivElement | null) => void;
};

export function ModuleCard({ module, locale, cardRef }: ModuleCardProps) {
  return (
    <div
      ref={cardRef}
      data-module={module.id}
      className="gates-module pointer-events-none absolute left-1/2 top-1/2 z-20 w-[6.75rem] md:w-[9.25rem]"
    >
      <div className="relative border border-[var(--foreground)]/18 bg-[var(--background)] px-2.5 py-2 md:px-3 md:py-2.5">
        <span className="absolute left-1 top-1 h-1 w-1 border-l border-t border-[var(--foreground)]/35" />
        <span className="absolute right-1 top-1 h-1 w-1 border-r border-t border-[var(--foreground)]/35" />
        <span className="absolute bottom-1 left-1 h-1 w-1 border-b border-l border-[var(--foreground)]/35" />
        <span className="absolute bottom-1 right-1 h-1 w-1 border-b border-r border-[var(--foreground)]/35" />
        <p className="font-mono text-[0.52rem] tracking-[0.2em] text-[var(--foreground)]/38">{module.index}</p>
        <p className="mt-0.5 text-[0.58rem] font-medium uppercase tracking-[0.14em] text-[var(--foreground)] md:text-[0.66rem]">
          {module.label[locale]}
        </p>
      </div>
    </div>
  );
}
