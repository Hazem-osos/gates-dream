'use client';

import { useEffect, useState } from 'react';
import { formatEgp } from '@/lib/subcontracts/money';

const BRAND = '#0E79AA';
const ACCENT = '#CB5B53';
const SLICE = ['#0E79AA', '#0A5F8A', '#CB5B53', '#D4A017', '#5B8C5A', '#6B7280'];

type RechartsModule = typeof import('recharts');

function useRecharts() {
  const [mod, setMod] = useState<RechartsModule | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import(/* webpackChunkName: "recharts" */ 'recharts').then((loaded) => {
      if (!cancelled) setMod(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return mod;
}

function ChartSkeleton() {
  return <div className="h-full min-h-[16rem] w-full animate-pulse rounded-xl bg-slate-100" role="status" />;
}

export function DualAreaChart({
  data,
  aKey,
  bKey,
  aName,
  bName,
}: {
  data: Array<Record<string, string | number>>;
  aKey: string;
  bKey: string;
  aName: string;
  bName: string;
}) {
  const R = useRecharts();
  if (!R) return <ChartSkeleton />;
  const { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => formatEgp(v)} />
        <Legend />
        <Area type="monotone" dataKey={aKey} name={aName} stroke={BRAND} fill={BRAND} fillOpacity={0.18} />
        <Area type="monotone" dataKey={bKey} name={bName} stroke={ACCENT} fill={ACCENT} fillOpacity={0.12} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  nameKey = 'label',
  valueKey = 'value',
}: {
  data: Array<Record<string, string | number>>;
  nameKey?: string;
  valueKey?: string;
}) {
  const R = useRecharts();
  if (!R) return <ChartSkeleton />;
  const { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } = R;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={58} outerRadius={88} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={SLICE[i % SLICE.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => (typeof v === 'number' && v > 1000 ? formatEgp(v) : v)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const bars = ['#0E79AA', '#059669', '#D97706', '#7C3AED', '#E11D48'];
  return (
    <div className="space-y-3">
      {data.length === 0 ? <p className="text-sm text-slate-500">لا توجد بيانات بعد</p> : null}
      {data.map((row, i) => (
        <div key={row.name}>
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span className="truncate">{row.name}</span>
            <span className="tabular-nums font-semibold" style={{ color: bars[i % bars.length] }}>
              {formatEgp(row.value)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(4, (row.value / max) * 100)}%`,
                backgroundColor: bars[i % bars.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
