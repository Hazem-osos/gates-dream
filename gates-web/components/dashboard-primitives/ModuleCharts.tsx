'use client';

import { useEffect, useState } from 'react';
import { formatMoneyAr } from '@/lib/formatMoney';

type Slice = { label: string; value: number; color: string };

type RechartsModule = typeof import('recharts');

function useRecharts() {
  const [mod, setMod] = useState<RechartsModule | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import('recharts').then((loaded) => {
      if (!cancelled) setMod(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return mod;
}

/** Pie plus columns for a module home. Zero slices stay out of the pie so it can spin. */
export function ModuleCharts({ segments }: { segments: Slice[] }) {
  const R = useRecharts();
  const rows = segments.filter((seg) => Number.isFinite(seg.value));
  const pieRows = rows.filter((seg) => seg.value > 0);
  if (pieRows.length === 0) {
    return <p className="py-8 text-center text-xs text-slate-500">لا توجد أرقام لهذه الفترة.</p>;
  }
  if (!R) return <div className="h-44 animate-pulse rounded-xl bg-[#EAF6FB]" />;

  const { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  const tip = { borderRadius: 12, border: '1px solid #D6EAF3', fontSize: 12 };

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieRows}
              dataKey="value"
              nameKey="label"
              innerRadius={36}
              outerRadius={62}
              paddingAngle={2}
              animationDuration={900}
              animationBegin={80}
            >
              {pieRows.map((seg) => (
                <Cell key={seg.label} fill={seg.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tip} formatter={(value, name) => [formatMoneyAr(Number(value)), String(name)]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 18 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#4B6472' }}
              interval={0}
              angle={-18}
              textAnchor="end"
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip contentStyle={tip} formatter={(value) => [formatMoneyAr(Number(value)), '']} />
            <Bar dataKey="value" radius={[5, 5, 0, 0]} animationDuration={900} maxBarSize={36}>
              {rows.map((seg) => (
                <Cell key={seg.label} fill={seg.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
