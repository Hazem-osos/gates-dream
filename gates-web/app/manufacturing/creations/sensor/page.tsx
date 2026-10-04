'use client';

import { useMemo, useState } from 'react';
import { CompactFormField, compactControlClass } from '@/components/ui';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery } from '@/lib/hooks/useApi';
import {
  ManufacturingPageChrome,
  MfgEmptyRow,
  MfgFilterCard,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgThClass,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';

type SensorReadingRow = {
  id: string;
  machineId: string;
  sensorType: string;
  value: number;
  unit: string | null;
  timestamp: string;
};

const SENSOR_TYPE_LABELS: Record<string, string> = {
  temperature: 'درجة الحرارة',
  pressure: 'الضغط',
  humidity: 'الرطوبة',
  vibration: 'الاهتزاز',
  speed: 'السرعة',
};

export default function SensorReadingsPage() {
  useBackendReachability();
  const [machineId, setMachineId] = useState('');
  const [sensorType, setSensorType] = useState('');

  const query = useMemo(() => {
    const q: Record<string, string | number> = { limit: 100 };
    if (machineId.trim()) q.machineId = machineId.trim();
    if (sensorType.trim()) q.sensorType = sensorType.trim();
    return q;
  }, [machineId, sensorType]);

  const { data, isLoading } = useApiQuery<SensorReadingRow[]>(
    ['sensor-readings', query.machineId ?? '', query.sensorType ?? ''],
    '/manufacturing/sensors/readings',
    query,
    { refetchInterval: 15_000 }
  );
  const rows = data?.data ?? [];

  return (
    <ManufacturingPageChrome
      title="قراءات المستشعرات"
      statusLabel="قائمة"
      favoriteHref="/manufacturing/creations/sensor"
      hideSave
    >
      <MfgFilterCard>
        <CompactFormField
          label="معرف الآلة"
          placeholder="تصفية اختيارية"
          value={machineId}
          onChange={(e) => setMachineId(e.target.value)}
        />
        <CompactFormField label="نوع المستشعر">
          <select
            value={sensorType}
            onChange={(e) => setSensorType(e.target.value)}
            className={compactControlClass}
          >
            <option value="">الكل</option>
            {Object.entries(SENSOR_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </CompactFormField>
      </MfgFilterCard>

      <MfgTableCard title={`القراءات (${rows.length})`}>
        <table className={mfgTableClass}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={mfgThClass}>الوقت</th>
              <th className={mfgThClass}>الآلة</th>
              <th className={mfgThClass}>النوع</th>
              <th className={`${mfgThClass} text-left`}>القيمة</th>
              <th className={mfgThClass}>الوحدة</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <MfgEmptyRow colSpan={5}>جاري التحميل…</MfgEmptyRow>
            ) : rows.length === 0 ? (
              <MfgEmptyRow colSpan={5}>لا توجد قراءات مسجّلة</MfgEmptyRow>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={mfgTrClass}>
                  <td className={mfgTdClass}>
                    {row.timestamp
                      ? new Date(row.timestamp).toLocaleString('ar-EG')
                      : '—'}
                  </td>
                  <td className={`${mfgTdClass} font-mono`}>{row.machineId}</td>
                  <td className={mfgTdClass}>
                    {SENSOR_TYPE_LABELS[row.sensorType] ?? row.sensorType}
                  </td>
                  <td className={`${mfgTdClass} text-left tabular-nums font-semibold`}>
                    {Number(row.value).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                  </td>
                  <td className={mfgTdClass}>{row.unit || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </MfgTableCard>
    </ManufacturingPageChrome>
  );
}
