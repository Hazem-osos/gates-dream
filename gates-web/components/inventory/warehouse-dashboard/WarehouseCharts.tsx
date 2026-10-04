'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { formatMoneyAr } from '@/lib/formatMoney';
import { formatWarehouseQty } from '@/lib/inventory/formatWarehouseReport';

export const WAREHOUSE_COLORS = ['#0E78AA', '#0F9B8E', '#E3A008', '#D64550', '#7C6BB5', '#E07A3D', '#3D7A5A', '#94A3B8'];

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

function ChartFrame({ children, tall = false }: { children: ReactNode; tall?: boolean }) {
  return <div className={tall ? 'h-80' : 'h-72'}>{children}</div>;
}

function tipStyle() {
  return {
    borderRadius: 12,
    border: '1px solid #D6EAF3',
    fontSize: 12,
  };
}

export function FlowChart({
  days,
  stacks,
}: {
  days: Array<{ date: string; label: string; inbound: number; outbound: number; stacks: Record<string, number> }>;
  stacks: Array<{ id: string; name: string }>;
}) {
  const R = useRecharts();
  if (!R) return <div className="h-80 animate-pulse rounded-xl bg-[#EAF6FB]" />;
  const { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  const data = days.map((day) => ({ ...day, ...day.stacks }));
  return (
    <ChartFrame tall>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E6EEF4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#4B6472' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#4B6472' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={tipStyle()}
            formatter={(value, name) => [formatWarehouseQty(Number(value)), String(name)]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { date?: string } | undefined;
              return row?.date ?? '';
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {stacks.map((stack, index) => (
            <Bar
              key={stack.id}
              dataKey={stack.id}
              name={stack.name}
              stackId="in"
              fill={WAREHOUSE_COLORS[index % WAREHOUSE_COLORS.length]}
              radius={index === stacks.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              animationDuration={900}
              animationEasing="ease-out"
            />
          ))}
          <Line
            type="monotone"
            dataKey="outbound"
            name="الصادر"
            stroke="#D64550"
            strokeWidth={2.5}
            dot={false}
            animationDuration={1200}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function ValueDonut({
  slices,
  onPick,
}: {
  slices: Array<{ id: string; name: string; stockValue: number }>;
  onPick: (id: string) => void;
}) {
  const R = useRecharts();
  if (!R) return <div className="h-72 animate-pulse rounded-xl bg-[#EAF6FB]" />;
  const { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } = R;
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="stockValue"
            nameKey="name"
            innerRadius={62}
            outerRadius={96}
            paddingAngle={2}
            animationDuration={1000}
            animationBegin={150}
            onClick={(_, index) => {
              const id = slices[index]?.id;
              if (id) onPick(id);
            }}
          >
            {slices.map((slice, index) => (
              <Cell key={slice.id} fill={WAREHOUSE_COLORS[index % WAREHOUSE_COLORS.length]} cursor="pointer" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tipStyle()}
            formatter={(value, name) => [formatMoneyAr(Number(value)), String(name)]}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function MovementBars({
  rows,
}: {
  rows: Array<{ itemId: string; name: string; movement: number }>;
}) {
  const R = useRecharts();
  if (!R) return <div className="h-72 animate-pulse rounded-xl bg-[#EAF6FB]" />;
  const { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 11, fill: '#094C6B' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tipStyle()} formatter={(value) => [formatWarehouseQty(Number(value)), 'الحركة']} />
          <Bar dataKey="movement" fill="#0E78AA" radius={[0, 6, 6, 0]} animationDuration={900} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function CompareBars({
  rows,
  dataKey,
  color,
  asPercent = false,
}: {
  rows: Array<{ name: string; stockValue: number; speed: number | null; deadRatio: number | null }>;
  dataKey: 'stockValue' | 'speed' | 'deadRatio';
  color: string;
  asPercent?: boolean;
}) {
  const R = useRecharts();
  if (!R) return <div className="h-64 animate-pulse rounded-xl bg-[#EAF6FB]" />;
  const { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  const data = rows.map((row) => ({
    name: row.name,
    value: asPercent ? (row[dataKey] ?? 0) * 100 : (row[dataKey] ?? 0),
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4B6472' }} interval={0} angle={-18} textAnchor="end" axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={tipStyle()}
            formatter={(value) => [asPercent ? `${formatMoneyAr(Number(value))}٪` : formatMoneyAr(Number(value)), '']}
          />
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} animationDuration={1000} maxBarSize={42} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
