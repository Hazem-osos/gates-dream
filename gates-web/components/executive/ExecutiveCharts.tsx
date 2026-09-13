'use client';

import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/hooks/useExecutiveDashboard';

const BRAND = '#0E79AA';
const ACCENT = '#CB5B53';

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

function ChartSkeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} role="status" />;
}

export function MiniSparkline({ data, color = BRAND }: { data: number[]; color?: string }) {
  const R = useRecharts();
  if (!R) return <ChartSkeleton className="mt-2 h-10 w-full" />;

  const { Area, AreaChart, ResponsiveContainer } = R;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="mt-2 h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} fill={`url(#spark-${color})`} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashFlowAreaChart({
  data,
}: {
  data: { name: string; inflow: number; expense: number }[];
}) {
  const R = useRecharts();
  if (!R) return <ChartSkeleton className="h-full w-full" />;

  const { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => formatMoney(v)} />
        <Legend />
        <Area type="monotone" dataKey="inflow" name="تدفقات / إيراد" stroke={BRAND} fill={BRAND} fillOpacity={0.2} />
        <Area type="monotone" dataKey="expense" name="مصروف تشغيلي" stroke={ACCENT} fill={ACCENT} fillOpacity={0.15} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TopProfitBarChart({ items }: { items: { name: string; grossProfit: number }[] }) {
  const R = useRecharts();
  if (!R) return <ChartSkeleton className="h-full w-full" />;

  const { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={items.map((p) => ({
          name: p.name.length > 12 ? `${p.name.slice(0, 12)}…` : p.name,
          profit: p.grossProfit,
        }))}
        layout="vertical"
        margin={{ left: 8, right: 16 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v: number) => formatMoney(v)} />
        <Bar dataKey="profit" name="مجمل الربح" fill={BRAND} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
