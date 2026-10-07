import type { AppTableColumn } from '@/app/components/ui/AppTable';
import { formatEgp } from '@/lib/subcontracts/money';

export type ReportRow = Record<string, unknown>;

const LABELS: Record<string, string> = {
  projectCode: 'كود المشروع',
  projectName: 'المشروع',
  client: 'العميل',
  contractNumber: 'رقم العقد',
  certificateNumber: 'رقم المستخلص',
  periodEnd: 'نهاية الفترة',
  status: 'الحالة',
  grossWorks: 'إجمالي الأعمال',
  netPayable: 'صافي المستحق',
  collected: 'المحصّل',
  remaining: 'المتبقي',
  financePosted: 'مرحّل مالياً',
  reversed: 'معكوس',
  subcontractorName: 'المقاول',
  subcontractNumber: 'رقم العقد',
  certifiedRevenue: 'إيراد معتمد',
  outstanding: 'متبقي',
  revisedContractValue: 'قيمة العقد',
  financialCertified: 'المعتمد مالياً',
  remainingContractValue: 'متبقي العقد',
  certifiedPercent: 'نسبة الاعتماد',
  collectionPercent: 'نسبة التحصيل',
};

function cellValue(key: string, v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (typeof v === 'number') {
    if (key.toLowerCase().includes('percent')) return `${v.toLocaleString('ar-EG')}%`;
    return formatEgp(v);
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return v.slice(0, 10);
  }
  return String(v);
}

export function buildContractingReportColumns(rows: ReportRow[]): AppTableColumn<ReportRow>[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]).filter((k) => k !== 'id' && k !== 'projectId').slice(0, 14);
  return keys.map((key) => ({
    id: key,
    header: LABELS[key] ?? key,
    sortValue: (row) => {
      const v = row[key];
      if (typeof v === 'number') return v;
      if (typeof v === 'boolean') return v ? 1 : 0;
      return String(v ?? '');
    },
    cell: (row) => cellValue(key, row[key]),
    numeric: typeof rows[0][key] === 'number',
    align: typeof rows[0][key] === 'number' ? ('end' as const) : undefined,
  }));
}

export function extractContractingReportRows(data: unknown): ReportRow[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.items)) return d.items as ReportRow[];
  if (Array.isArray(data)) return data as ReportRow[];
  return [];
}
