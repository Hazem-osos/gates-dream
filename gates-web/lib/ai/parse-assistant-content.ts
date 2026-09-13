import { formatMoneyAr } from '@/lib/formatMoney';
import type {
  AiChartType,
  AiContentBlock,
  AiInlineActionCard,
  AiKpiItem,
  AiTableBlock,
  AiVisualizationDataKey,
  AiVisualizationPayload,
} from './types';

const KPI_LABELS: Record<string, string> = {
  totalsales: 'إجمالي المبيعات',
  sales: 'إجمالي المبيعات',
  netsales: 'صافي المبيعات',
  netprofit: 'صافي الربح',
  profit: 'صافي الربح',
  grossprofit: 'إجمالي الربح',
  totalinvoices: 'عدد الفواتير',
  invoicecount: 'عدد الفواتير',
  overdue: 'المتأخرات',
  overdueamount: 'المتأخرات',
  receivables: 'الذمم المدينة',
  payables: 'الذمم الدائنة',
  cash: 'النقدية',
  cashbalance: 'رصيد النقدية',
  bankbalance: 'رصيد البنوك',
  inventory: 'المخزون',
  inventoryvalue: 'قيمة المخزون',
  quantity: 'الكمية',
  totalquantity: 'إجمالي الكمية',
  taxamount: 'الضريبة',
  total: 'الإجمالي',
};

const MONEY_HINT = /sales|profit|amount|balance|cash|receivable|payable|tax|total|مخزون|مبيعات|ربح|رصيد|ذمم/i;

function normalizeKey(key: string): string {
  return key.replace(/[_\s-]+/g, '').toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function lookNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && /^-?\d[\d,.]*(?:\.\d+)?$/.test(value.trim())) {
    const n = Number(value.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatCell(key: string, value: unknown): string {
  if (value == null) return '—';
  const numeric = lookNumeric(value);
  if (numeric != null && MONEY_HINT.test(key)) {
    return `${formatMoneyAr(numeric)} EGP`;
  }
  if (numeric != null) return numeric.toLocaleString('ar-EG');
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function kpiLabel(key: string): string {
  return KPI_LABELS[normalizeKey(key)] ?? key;
}

function objectToKpis(record: Record<string, unknown>): AiKpiItem[] | null {
  const entries = Object.entries(record).filter(([, value]) => {
    if (value == null) return false;
    if (typeof value === 'object') return false;
    return true;
  });
  if (entries.length < 2 || entries.length > 8) return null;
  const numericCount = entries.filter(([, value]) => lookNumeric(value) != null).length;
  if (numericCount < Math.max(2, Math.ceil(entries.length * 0.5))) return null;
  return entries.map(([key, value]) => ({
    label: kpiLabel(key),
    value: formatCell(key, value),
  }));
}

function arrayToTable(rows: unknown[]): AiTableBlock | null {
  const objects = rows.filter(isPlainObject);
  if (!objects.length || objects.length !== rows.length) return null;
  const columns = Array.from(
    objects.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  ).slice(0, 8);
  if (!columns.length) return null;
  return { columns, rows: objects };
}

function asActionId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const candidate = record.actionId ?? record.id;
  const type = record.actionType ?? (record.summaryDisplay as { actionType?: string } | undefined)?.actionType;
  if (typeof candidate === 'string' && candidate.length > 8 && typeof type === 'string') {
    return candidate;
  }
  if (typeof candidate === 'string' && record.confirmationRequired === true) return candidate;
  return null;
}

function asInlineActionCard(value: unknown): AiInlineActionCard | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const nested = record.actionCard && typeof record.actionCard === 'object'
    ? (record.actionCard as Record<string, unknown>)
    : record;
  const actionType = String(nested.actionType ?? record.actionType ?? '');
  const isCard =
    record.isActionCard === true ||
    actionType.startsWith('DRAFT_') ||
    Boolean(nested.draftPayload && nested.titleAr);
  if (!isCard || !actionType) return null;
  const titleAr = String(nested.titleAr ?? record.titleAr ?? 'مسودة حركة');
  return {
    actionId: typeof record.actionId === 'string' ? record.actionId : undefined,
    actionType,
    titleAr,
    summary: (nested.summary as AiInlineActionCard['summary']) ?? undefined,
    draftPayload: (nested.draftPayload as Record<string, unknown>) ?? undefined,
    previewLines: Array.isArray(nested.previewLines)
      ? (nested.previewLines as AiInlineActionCard['previewLines'])
      : undefined,
  };
}

const CHART_TYPES = new Set(['BAR', 'LINE', 'PIE', 'METRIC_CARDS']);

function asVisualization(value: unknown): AiVisualizationPayload | null {
  if (!isPlainObject(value)) return null;
  const nested = isPlainObject(value.visualizationPayload) ? value.visualizationPayload : value;
  const chartType = String(nested.chartType ?? '');
  const isViz =
    value.isVisualization === true ||
    CHART_TYPES.has(chartType) &&
      Array.isArray(nested.data) &&
      typeof nested.title === 'string';
  if (!isViz || !CHART_TYPES.has(chartType) || typeof nested.title !== 'string') return null;
  const data = (Array.isArray(nested.data) ? nested.data : [])
    .filter(isPlainObject)
    .map((row) => {
      const next: Record<string, string | number> = {};
      for (const [key, cell] of Object.entries(row)) {
        if (typeof cell === 'number' && Number.isFinite(cell)) next[key] = cell;
        else if (typeof cell === 'string') next[key] = cell;
      }
      return next;
    });
  const dataKeys = (Array.isArray(nested.dataKeys) ? nested.dataKeys : [])
    .filter(isPlainObject)
    .map((item, index) => ({
      key: String(item.key ?? ''),
      nameAr: String(item.nameAr ?? item.key ?? ''),
      color: typeof item.color === 'string' ? item.color : ['#0E79AA', '#CB5B53', '#D4A017', '#5B8C5A'][index % 4],
    }))
    .filter((item): item is AiVisualizationDataKey => Boolean(item.key));
  return {
    chartType: chartType as AiChartType,
    title: nested.title,
    description: typeof nested.description === 'string' ? nested.description : undefined,
    data,
    dataKeys,
    summaryKpis: Array.isArray(nested.summaryKpis)
      ? nested.summaryKpis.filter(isPlainObject).map((kpi) => ({
          label: String(kpi.label ?? ''),
          value: String(kpi.value ?? ''),
          changePercent: typeof kpi.changePercent === 'number' ? kpi.changePercent : undefined,
        }))
      : undefined,
  };
}

function parseJsonBlock(raw: string): AiContentBlock | null {
  try {
    const parsed = JSON.parse(raw);
    const visualization = asVisualization(parsed);
    if (visualization) return { type: 'visualization', payload: visualization };
    const inlineCard = asInlineActionCard(parsed);
    const actionId = asActionId(parsed);
    if (inlineCard) {
      return actionId
        ? { type: 'action', actionId, card: inlineCard }
        : { type: 'actionCard', card: inlineCard };
    }
    if (actionId) return { type: 'action', actionId };
    if (Array.isArray(parsed)) {
      const table = arrayToTable(parsed);
      return table ? { type: 'table', table } : null;
    }
    if (isPlainObject(parsed)) {
      if (Array.isArray(parsed.data)) {
        const table = arrayToTable(parsed.data);
        if (table) return { type: 'table', table };
      }
      if (isPlainObject(parsed.summary)) {
        const kpis = objectToKpis(parsed.summary);
        if (kpis) return { type: 'kpis', items: kpis };
      }
      const kpis = objectToKpis(parsed);
      if (kpis) return { type: 'kpis', items: kpis };
      const nestedTables = Object.values(parsed).find((value) => Array.isArray(value));
      if (Array.isArray(nestedTables)) {
        const table = arrayToTable(nestedTables);
        if (table) return { type: 'table', table };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function parseMarkdownTable(text: string): AiTableBlock | null {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'));
  if (lines.length < 2) return null;
  const split = (line: string) =>
    line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
  const columns = split(lines[0]);
  const divider = lines[1];
  if (!/^\|?\s*:?-{3,}/.test(divider)) return null;
  const rows = lines.slice(2).map((line) => {
    const cells = split(line);
    const row: Record<string, unknown> = {};
    columns.forEach((col, index) => {
      row[col] = cells[index] ?? '';
    });
    return row;
  });
  if (!rows.length) return null;
  return { columns, rows };
}

/**
 * Split assistant text into markdown, KPI badges, and compact tables.
 */
export function parseAssistantContent(content: string): AiContentBlock[] {
  const source = content ?? '';
  if (!source.trim()) return [{ type: 'markdown', text: '' }];

  const blocks: AiContentBlock[] = [];
  const fence = /```(?:json|JSON)?\s*([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(source))) {
    const before = source.slice(lastIndex, match.index);
    if (before.trim()) pushText(before, blocks);
    const jsonBlock = parseJsonBlock(match[1].trim());
    if (jsonBlock) blocks.push(jsonBlock);
    else if (match[1].trim()) blocks.push({ type: 'markdown', text: `\`\`\`\n${match[1].trim()}\n\`\`\`` });
    lastIndex = match.index + match[0].length;
  }

  const rest = source.slice(lastIndex);
  if (rest.trim()) pushText(rest, blocks);
  return blocks.length ? blocks : [{ type: 'markdown', text: source }];
}

function pushText(text: string, blocks: AiContentBlock[]) {
  const table = parseMarkdownTable(text);
  if (table) {
    const withoutTable = text
      .split('\n')
      .filter((line) => !(line.trim().startsWith('|') && line.trim().endsWith('|')))
      .join('\n')
      .trim();
    if (withoutTable) blocks.push({ type: 'markdown', text: withoutTable });
    blocks.push({ type: 'table', table });
    return;
  }
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const jsonBlock = parseJsonBlock(trimmed);
    if (jsonBlock) {
      blocks.push(jsonBlock);
      return;
    }
  }
  blocks.push({ type: 'markdown', text });
}
