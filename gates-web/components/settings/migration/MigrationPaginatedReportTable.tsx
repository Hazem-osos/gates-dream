'use client';

export type MigrationReportColumn = {
  key: string;
  label: string;
  minWidth?: number;
};

type Props = {
  title: string;
  columns: MigrationReportColumn[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
};

function cellText(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

export default function MigrationPaginatedReportTable({
  title,
  columns,
  rows,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  loading,
}: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#0A3D5E]">
          {title}{' '}
          <span className="font-normal text-slate-500">
            ({from}–{to} من {total})
          </span>
        </p>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className="rounded border px-3 py-1 disabled:opacity-40"
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            السابق
          </button>
          <span className="text-slate-600">
            صفحة {page} / {totalPages}
          </span>
          <button
            type="button"
            className="rounded border px-3 py-1 disabled:opacity-40"
            disabled={loading || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            التالي ({pageSize} صف)
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        <table className="min-w-max w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-right dark:bg-slate-900">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold dark:border-slate-700"
                  style={{ minWidth: col.minWidth ?? 120 }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
                  جاري التحميل…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
                  لا توجد صفوف
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx} className="odd:bg-white even:bg-slate-50/80 dark:odd:bg-slate-950 dark:even:bg-slate-900/40">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="border-b border-slate-100 px-3 py-2 align-top text-slate-700 dark:border-slate-800 dark:text-slate-300"
                      style={{ minWidth: col.minWidth ?? 120, maxWidth: col.minWidth ? col.minWidth * 2 : 360 }}
                    >
                      <span className="block whitespace-pre-wrap break-words">{cellText(row[col.key])}</span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const MIGRATION_REPORT_PAGE_SIZE = 1000;

export const FIELD_COVERAGE_COLUMNS: MigrationReportColumn[] = [
  { key: 'sourceTable', label: 'جدول المصدر', minWidth: 140 },
  { key: 'sourceColumn', label: 'عمود المصدر', minWidth: 140 },
  { key: 'targetDestination', label: 'الوجهة', minWidth: 200 },
  { key: 'transformation', label: 'التحويل', minWidth: 220 },
  { key: 'importerFunction', label: 'المستورد / المرحلة', minWidth: 160 },
  { key: 'preservationMode', label: 'وضع الحفظ', minWidth: 120 },
  { key: 'testReference', label: 'مرجع الاختبار', minWidth: 160 },
  { key: 'notes', label: 'ملاحظات', minWidth: 240 },
];

export const JOB_ISSUE_COLUMNS: MigrationReportColumn[] = [
  { key: 'severity', label: 'الخطورة', minWidth: 90 },
  { key: 'category', label: 'التصنيف', minWidth: 160 },
  { key: 'stage', label: 'المرحلة', minWidth: 120 },
  { key: 'sourceEntity', label: 'كيان المصدر', minWidth: 140 },
  { key: 'sourceKey', label: 'مفتاح المصدر', minWidth: 200 },
  { key: 'description', label: 'الوصف', minWidth: 320 },
  { key: 'createdAt', label: 'التاريخ', minWidth: 160 },
];

export const SCHEMA_TABLE_COLUMNS: MigrationReportColumn[] = [
  { key: 'table', label: 'الجدول', minWidth: 160 },
  { key: 'moduleId', label: 'الوحدة', minWidth: 120 },
  { key: 'columnCount', label: 'عدد الأعمدة', minWidth: 100 },
  { key: 'mappedCount', label: 'mapped', minWidth: 90 },
  { key: 'metadataCount', label: 'metadata', minWidth: 90 },
  { key: 'unsupportedCount', label: 'unsupported', minWidth: 100 },
  { key: 'hasImporter', label: 'مستورد', minWidth: 80 },
  { key: 'stage', label: 'المرحلة', minWidth: 140 },
  { key: 'targetModels', label: 'نماذج الهدف', minWidth: 200 },
];
