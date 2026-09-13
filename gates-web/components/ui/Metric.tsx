type MetricProps = {
  value: string;
  label: string;
};

/** Placeholder statistic cell. Animate only when a later phase wires verified numbers. */
export function Metric({ value, label }: MetricProps) {
  return (
    <div className="border-t border-[var(--border)] py-8">
      <p className="font-editorial text-[clamp(2.5rem,6vw,5rem)] leading-none tracking-tight">{value}</p>
      <p className="mt-3 text-sm text-[var(--muted)]">{label}</p>
    </div>
  );
}
