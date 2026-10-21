'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import {
  MfgMetric,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgThClass,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';

type ReportRow = {
  rawItemId: string;
  rawItemName: string;
  rawItemSerial: string;
  warehouseId: string;
  warehouseName: string;
  availableQuantity: number;
  bomId: string;
  bomName: string;
  requiredQuantityPerModel: number;
  theoreticalModelCount: number;
  bomBottleneckModelCount?: number;
  isBottleneck?: boolean;
};

type ReportSummary = {
  rowCount: number;
  distinctRawItems: number;
  distinctBoms: number;
  completeModelRuns?: number;
  bottleneckCount?: number;
};

function fmt(n: number, digits = 3) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function ManufacturingTheoreticalCapabilityResults({
  query,
}: {
  query: Record<string, string>;
}) {
  const { data: response, isLoading, isError } = useApiQuery<ReportRow[]>(
    ['mfg-theoretical-capability', query],
    '/manufacturing/reports/theoretical-capability',
    { ...query, limit: 500 }
  );

  const rows = response?.data ?? [];
  const summary = response?.summary as ReportSummary | undefined;

  if (isLoading) return <p className="text-sm text-slate-500">جاري تحميل التقرير…</p>;
  if (isError) return <p className="text-sm text-rose-600">تعذر تحميل التقرير</p>;

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MfgMetric label="عدد الأسطر" value={summary.rowCount} />
          <MfgMetric label="خامات مختلفة" value={summary.distinctRawItems} />
          <MfgMetric label="نماذج تصنيع" value={summary.distinctBoms} tone="ok" />
          <MfgMetric
            label="أقصى نماذج كاملة"
            value={summary.completeModelRuns ?? 0}
            hint="أضيق خامة في النموذج × المخزن"
            tone="ok"
          />
        </div>
      ) : null}

      <p className="text-xs leading-5 text-slate-500">
        التقرير يجيب: من الرصيد الحالي، كام نموذج كامل نقدر نصنّعه؟ لكل خامة نحسب الرصيد ÷ احتياج النموذج
        الواحد (مع الهالك وبعد قسمة كمية الأساس). العمود «نماذج كاملة للنموذج» هو أضيق خامة — يعني العدد
        الحقيقي اللي يكفي لكل الخامات معاً، مش لكل خامة لوحدها.
      </p>

      <MfgTableCard title="إمكانية التصنيع النظرية" scrollViewport>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            لا توجد بيانات — غيّر مرشح الخامة أو المخزن
          </p>
        ) : (
          <table className={mfgTableClass}>
            <thead className={mfgTheadClass}>
              <tr>
                <th className={mfgThClass}>اسم الخامة</th>
                <th className={mfgThClass}>اسم المخزن</th>
                <th className={mfgThClass}>الرصيد المتاح</th>
                <th className={mfgThClass}>نموذج التصنيع</th>
                <th className={mfgThClass}>كمية الخامة / نموذج</th>
                <th className={mfgThClass}>نماذج من هذه الخامة</th>
                <th className={mfgThClass}>نماذج كاملة للنموذج</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.warehouseId}-${row.rawItemId}-${row.bomId}`} className={mfgTrClass}>
                  <td className={mfgTdClass}>
                    {row.rawItemName}
                    {row.rawItemSerial ? ` (${row.rawItemSerial})` : ''}
                  </td>
                  <td className={mfgTdClass}>{row.warehouseName}</td>
                  <td className={`${mfgTdClass} tabular-nums`}>{fmt(row.availableQuantity)}</td>
                  <td className={mfgTdClass}>{row.bomName}</td>
                  <td className={`${mfgTdClass} tabular-nums`}>
                    {fmt(row.requiredQuantityPerModel)}
                  </td>
                  <td className={`${mfgTdClass} tabular-nums font-semibold text-[#0A3D5E]`}>
                    {row.theoreticalModelCount.toLocaleString('ar-EG')}
                  </td>
                  <td
                    className={`${mfgTdClass} tabular-nums font-semibold ${
                      row.isBottleneck ? 'text-amber-800' : 'text-[#0A3D5E]'
                    }`}
                  >
                    {(row.bomBottleneckModelCount ?? row.theoreticalModelCount).toLocaleString('ar-EG')}
                    {row.isBottleneck ? ' · قيد' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MfgTableCard>
    </div>
  );
}
