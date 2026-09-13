'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ImageDown, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatMoneyAr } from '@/lib/formatMoney';
import type { AiVisualizationKpi, AiVisualizationPayload } from '@/lib/ai/types';

type RechartsModule = typeof import('recharts');

const DEFAULT_COLORS = ['#0E79AA', '#CB5B53', '#D4A017', '#5B8C5A', '#7C3AED', '#0F766E'];

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

function moneyLabel(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value ?? '—');
  return `${formatMoneyAr(n)} ج.م`;
}

function fileStem(title: string): string {
  return title.replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gates-chart';
}

async function exportExcel(payload: AiVisualizationPayload) {
  const XLSX = await import(/* webpackChunkName: "xlsx" */ 'xlsx');
  const rows = payload.data.map((row) => {
    const next: Record<string, string | number> = { البيان: row.label ?? row.name ?? '' };
    for (const key of payload.dataKeys) {
      next[key.nameAr || key.key] = row[key.key] ?? '';
    }
    return next;
  });
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ البيان: payload.title }]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'البيانات');
  XLSX.writeFile(book, `${fileStem(payload.title)}.xlsx`);
}

async function exportPng(root: HTMLElement, title: string) {
  const svg = root.querySelector('svg');
  if (!svg) return;
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('تعذّر تصدير الصورة'));
    image.src = url;
  });
  const canvas = document.createElement('canvas');
  const width = Math.max(svg.clientWidth || 640, 640);
  const height = Math.max(svg.clientHeight || 280, 280);
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const link = document.createElement('a');
  link.download = `${fileStem(title)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function MetricCards({ items }: { items: AiVisualizationKpi[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.slice(0, 4).map((item) => {
        const change = item.changePercent;
        const up = change != null && change > 0;
        const down = change != null && change < 0;
        return (
          <div
            key={`${item.label}-${item.value}`}
            className="rounded-xl border border-[#D6EAF3] bg-white px-2.5 py-2 shadow-sm"
          >
            <p className="text-[10px] font-medium text-slate-500">{item.label}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-[#094C6B]">{item.value}</p>
            {change != null ? (
              <p
                className={`mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold ${
                  up ? 'text-emerald-600' : down ? 'text-rose-600' : 'text-slate-500'
                }`}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : null}
                {down ? <TrendingDown className="h-3 w-3" /> : null}
                {`${change > 0 ? '+' : ''}${change.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%`}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ChartBody({ payload }: { payload: AiVisualizationPayload }) {
  const R = useRecharts();
  if (payload.chartType === 'METRIC_CARDS') return null;
  if (!R) return <div className="h-56 animate-pulse rounded-xl bg-slate-100" />;

  const {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
  } = R;

  const keys = payload.dataKeys.length
    ? payload.dataKeys
    : Object.keys(payload.data[0] ?? {})
        .filter((key) => key !== 'label' && key !== 'name')
        .map((key, index) => ({
          key,
          nameAr: key,
          color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
        }));

  const tooltip = {
    formatter: (value: number, name: string) => [moneyLabel(value), name],
    labelStyle: { direction: 'rtl' as const },
    contentStyle: { borderRadius: 10, borderColor: '#D6EAF3', fontSize: 12 },
  };

  if (payload.chartType === 'PIE') {
    const valueKey = keys[0]?.key ?? 'value';
    const slices = payload.data.map((row, index) => ({
      name: String(row.label ?? row.name ?? `بند ${index + 1}`),
      value: Number(row[valueKey] ?? 0),
      color: keys[index]?.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    }));
    return (
      <div className="h-56" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => moneyLabel(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const Chart = payload.chartType === 'LINE' ? LineChart : BarChart;
  return (
    <div className="h-56" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={payload.data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(value: number) => formatMoneyAr(value)} width={72} />
          <Tooltip {...tooltip} />
          <Legend />
          {keys.map((key) =>
            payload.chartType === 'LINE' ? (
              <Line
                key={key.key}
                type="monotone"
                dataKey={key.key}
                name={key.nameAr}
                stroke={key.color}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ) : (
              <Bar key={key.key} dataKey={key.key} name={key.nameAr} fill={key.color} radius={[6, 6, 0, 0]} />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

export function AiGenerativeWidget({ data }: { data: AiVisualizationPayload }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'xlsx' | 'png' | null>(null);
  const kpis = data.summaryKpis?.filter((item) => item.label && item.value) ?? [];

  return (
    <div
      ref={rootRef}
      dir="rtl"
      className="mt-2 overflow-hidden rounded-xl border border-[#D6EAF3] bg-[#F8FBFD] text-right shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6F0F7] bg-white px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#094C6B]">{data.title}</p>
          {data.description ? <p className="text-[11px] text-slate-500">{data.description}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy != null}
            onClick={() => {
              setBusy('xlsx');
              void exportExcel(data).finally(() => setBusy(null));
            }}
          >
            <Download className="h-3.5 w-3.5" />
            تصدير Excel
          </Button>
          {data.chartType !== 'METRIC_CARDS' ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy != null}
              onClick={() => {
                if (!rootRef.current) return;
                setBusy('png');
                void exportPng(rootRef.current, data.title).finally(() => setBusy(null));
              }}
            >
              <ImageDown className="h-3.5 w-3.5" />
              صورة
            </Button>
          ) : null}
        </div>
      </div>
      <div className="px-3 py-3">
        <MetricCards items={kpis} />
        <ChartBody payload={data} />
      </div>
    </div>
  );
}
