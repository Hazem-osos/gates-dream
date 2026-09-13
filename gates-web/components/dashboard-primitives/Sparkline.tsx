'use client';

export function Sparkline({
  data,
  className,
  stroke = '#0E79AA',
}: {
  data: number[];
  className?: string;
  stroke?: string;
}) {
  if (data.length < 2) return <span className="inline-block h-5 w-16 bg-slate-100" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const w = 72;
  const h = 18;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className ?? 'h-[18px] w-[72px]'} aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth="1.4" points={pts} />
    </svg>
  );
}
