import { z } from 'zod';
import type { VisualizationPayload } from '../dto/visualization.dto';
import { BaseAiTool } from './base-ai-tool';
import type { SecurityContext } from './types';

const PALETTE = ['#0E79AA', '#CB5B53', '#D4A017', '#5B8C5A', '#7C3AED', '#0F766E'];

const dataKeySchema = z.object({
  key: z.string().min(1).max(40),
  nameAr: z.string().min(1).max(80),
  color: z.string().max(20).optional(),
});

const kpiSchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(80),
  changePercent: z.number().optional(),
});

const paramsSchema = z.object({
  chartType: z.enum(['BAR', 'LINE', 'PIE', 'METRIC_CARDS']),
  title: z.string().min(1).max(160),
  description: z.string().max(400).optional(),
  data: z.array(z.record(z.unknown())).max(24).optional(),
  dataKeys: z.array(dataKeySchema).max(6).optional(),
  summaryKpis: z.array(kpiSchema).max(6).optional(),
});

type Params = z.infer<typeof paramsSchema>;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/,/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function sanitizeColor(color: string | undefined, index: number): string {
  if (color && HEX.test(color.trim())) return color.trim();
  return PALETTE[index % PALETTE.length];
}

function rowLabel(row: Record<string, unknown>, index: number): string {
  const raw = row.label ?? row.name ?? row.period ?? row.الربع ?? row.الشهر;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'number') return String(raw);
  return `بند ${index + 1}`;
}

/**
 * Sanitizes a chart payload for the chat UI. Does not query the ledger —
 * numbers must already come from prior read tools in the same turn.
 */
export class RenderDataVisualizationTool extends BaseAiTool<
  Params,
  { isVisualization: true; visualizationPayload: VisualizationPayload; instruction: string }
> {
  readonly name = 'render_data_visualization';
  readonly description =
    'Render an interactive chat widget (BAR / LINE / PIE / METRIC_CARDS) from figures already returned by read tools. Never invent numbers. For comparisons, trends, performance, or multi-period summaries, call this instead of printing large text tables. Echo the returned JSON so the UI can draw the chart.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';

  protected async run(params: Params, _context: SecurityContext) {
    const rows = (params.data ?? [])
      .map((raw, index) => {
        const source = raw as Record<string, unknown>;
        const next: Record<string, string | number> = { label: rowLabel(source, index) };
        for (const [key, value] of Object.entries(source)) {
          if (key === 'label' || key === 'name' || key === 'period') continue;
          const numeric = asFiniteNumber(value);
          if (numeric != null) next[key] = numeric;
          else if (typeof value === 'string' && value.trim()) next[key] = value.trim();
        }
        return next;
      })
      .filter((row) => Object.keys(row).length > 1 || params.chartType === 'METRIC_CARDS');

    const inferredKeys = rows[0]
      ? Object.keys(rows[0]).filter((key) => key !== 'label' && typeof rows[0][key] === 'number')
      : [];
    const provided = params.dataKeys?.length
      ? params.dataKeys
      : inferredKeys.map((key) => ({ key, nameAr: key, color: undefined }));

    const dataKeys = provided.slice(0, 6).map((item, index) => ({
      key: item.key,
      nameAr: item.nameAr || item.key,
      color: sanitizeColor(item.color, index),
    }));

    if (params.chartType !== 'METRIC_CARDS' && !rows.length) {
      throw new Error('لا توجد نقاط بيانات صالحة للرسم. مرّر أرقاماً من أدوات القراءة أولاً.');
    }
    if (params.chartType !== 'METRIC_CARDS' && !dataKeys.length) {
      throw new Error('حدد dataKeys أو مرّر صفوفاً فيها حقول رقمية.');
    }

    const visualizationPayload: VisualizationPayload = {
      chartType: params.chartType,
      title: params.title.trim(),
      description: params.description?.trim() || undefined,
      data: rows,
      dataKeys,
      summaryKpis: params.summaryKpis?.map((kpi) => ({
        label: kpi.label.trim(),
        value: kpi.value.trim(),
        changePercent: typeof kpi.changePercent === 'number' ? kpi.changePercent : undefined,
      })),
    };

    return {
      isVisualization: true as const,
      visualizationPayload,
      instruction:
        'Echo this JSON (isVisualization + visualizationPayload) in a fenced json block. Write a short Arabic caption only — do not repeat the same numbers as a markdown table.',
    };
  }
}
