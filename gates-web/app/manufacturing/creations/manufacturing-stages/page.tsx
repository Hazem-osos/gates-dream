'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery } from '@/lib/hooks/useApi';
import {
  CommandCenter,
  DataGridDense,
  DASH_NUM,
  HUD_BTN_GHOST,
} from '@/components/dashboard-primitives';

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

  const { data, isLoading, isFetching, refetch } = useApiQuery<BomRow[]>(
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
    <CommandCenter
      title="مراحل التصنيع — قوائم المواد"
      module="MFG / BOM"
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F2', label: 'نموذج جديد', href: '/manufacturing/creations/manufacturing-model' },
        { key: 'F8', label: 'التشغيل', href: '/manufacturing' },
      ]}
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="رقم الصنف التام"
            className={`${HUD_BTN_GHOST} w-40 px-3 text-right`}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="إسم قائمة المواد"
            className={`${HUD_BTN_GHOST} w-44 px-3 text-right`}
          />
        </div>
      }
    >
      <DataGridDense
        title={`قوائم المواد (${total})`}
        loading={isLoading}
        rows={rows}
        empty="لا توجد قوائم مواد"
        emptyActionHref="/manufacturing/creations/manufacturing-model"
        emptyActionLabel="إنشاء BOM"
        onRowOpen={() => router.push('/manufacturing/creations/manufacturing-model')}
        columns={[
          {
            id: 'code',
            header: 'الرقم',
            cell: (r) => <span className={DASH_NUM}>{r.finishedItem?.serial ?? r.id.slice(0, 8)}</span>,
          },
          {
            id: 'name',
            header: 'المرحلة / BOM',
            cell: (r) =>
              r.finishedItem?.arabicName ? `${r.name} — ${r.finishedItem.arabicName}` : r.name,
          },
          {
            id: 'lines',
            header: 'بنود المواد',
            numeric: true,
            cell: (r) => String(r._count?.lines ?? 0),
          },
        ]}
      />
    </CommandCenter>
  );
}
