'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompactFormField } from '@/components/ui';
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

type BomRow = {
  id: string;
  name: string;
  finishedItem?: { arabicName?: string; serial?: string };
  _count?: { lines: number };
};

export default function ManufacturingStagesPage() {
  useBackendReachability();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [serial, setSerial] = useState('');
  const [name, setName] = useState('');
  const pageSize = 12;

  const { data, isLoading } = useApiQuery<BomRow[]>(
    ['manufacturing-boms', page],
    '/manufacturing/boms',
    { page, limit: pageSize }
  );
  const boms = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.pagination?.total ?? data?.meta?.total ?? boms.length;

  useEffect(() => {
    setPage(1);
  }, [serial, name]);

  const rows = useMemo(
    () =>
      boms.filter((row) => {
        const code = row.finishedItem?.serial ?? '';
        if (serial && !code.includes(serial) && !row.id.includes(serial)) return false;
        if (name && !(row.name ?? '').includes(name)) return false;
        return true;
      }),
    [boms, serial, name]
  );

  return (
    <ManufacturingPageChrome
      title="مراحل التصنيع"
      statusLabel="قائمة"
      favoriteHref="/manufacturing/creations/manufacturing-stages"
      hideSave
    >
      <MfgFilterCard>
        <CompactFormField
          label="رقم الصنف التام"
          placeholder="ابحث بالرقم"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />
        <CompactFormField
          label="إسم قائمة المواد"
          placeholder="ابحث بالاسم"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </MfgFilterCard>

      <MfgTableCard title={`قوائم المواد (${total})`}>
        <table className={mfgTableClass}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={mfgThClass}>الرقم</th>
              <th className={mfgThClass}>المرحلة / BOM</th>
              <th className={`${mfgThClass} text-left`}>بنود المواد</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <MfgEmptyRow colSpan={3}>جاري التحميل…</MfgEmptyRow>
            ) : rows.length === 0 ? (
              <MfgEmptyRow colSpan={3}>لا توجد قوائم مواد</MfgEmptyRow>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`${mfgTrClass} cursor-pointer`}
                  onClick={() => router.push('/manufacturing/creations/manufacturing-model')}
                >
                  <td className={`${mfgTdClass} font-mono font-semibold`}>
                    {row.finishedItem?.serial ?? row.id.slice(0, 8)}
                  </td>
                  <td className={mfgTdClass}>
                    {row.finishedItem?.arabicName ? `${row.name} — ${row.finishedItem.arabicName}` : row.name}
                  </td>
                  <td className={`${mfgTdClass} text-left tabular-nums`}>{row._count?.lines ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </MfgTableCard>
    </ManufacturingPageChrome>
  );
}
