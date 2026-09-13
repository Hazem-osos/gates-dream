type SectionLabelProps = {
  index?: string;
  children: string;
  tone?: 'light' | 'dark';
};

export function SectionLabel({ index, children, tone = 'light' }: SectionLabelProps) {
  return (
    <p
      className={`flex items-center gap-3 text-[0.68rem] font-medium uppercase tracking-[0.28em] ${
        tone === 'dark' ? 'text-[var(--text-inverse)]/55' : 'text-[var(--foreground)]/45'
      }`}
    >
      {index ? <span className="tabular-nums tracking-[0.18em]">{index}</span> : null}
      <span>{children}</span>
    </p>
  );
}
