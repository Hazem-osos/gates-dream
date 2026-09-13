'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { ChequePortfolioTable } from '@/components/real-estate/ChequePortfolioTable';
import { RealEstatePageShell, ReCard, ReMetric } from '@/components/real-estate/RealEstatePageShell';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp } from '@/lib/real-estate/format';
import type { BankAccountOption, ChequePortfolio, PostDatedCheque, UnitContractListItem } from '@/lib/real-estate/types';
import { lazyNamedModal } from '@/components/ui/lazyModal';

const BatchChequeModal = lazyNamedModal(
  () => import('@/components/real-estate/PdcActionModals'),
  'BatchChequeModal',
  'جاري تحميل شيكات الدفعة…'
);
const DepositChequesModal = lazyNamedModal(
  () => import('@/components/real-estate/PdcActionModals'),
  'DepositChequesModal',
  'جاري تحميل إيداع الشيكات…'
);
const ClearChequeModal = lazyNamedModal(
  () => import('@/components/real-estate/PdcActionModals'),
  'ClearChequeModal',
  'جاري تحميل تحصيل الشيك…'
);
const BounceChequeModal = lazyNamedModal(
  () => import('@/components/real-estate/PdcActionModals'),
  'BounceChequeModal',
  'جاري تحميل ارتداد الشيك…'
);
const ReplaceChequeModal = lazyNamedModal(
  () => import('@/components/real-estate/PdcActionModals'),
  'ReplaceChequeModal',
  'جاري تحميل استبدال الشيك…'
);

type Tab = 'ALL' | 'CUSTODY' | 'DUE_7' | 'COLLECTION' | 'BOUNCED';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'ALL', label: 'الكل' },
  { id: 'CUSTODY', label: 'تحت الحفظ' },
  { id: 'DUE_7', label: 'تستحق خلال 7 أيام' },
  { id: 'COLLECTION', label: 'برسم التحصيل' },
  { id: 'BOUNCED', label: 'مرتدة' },
];

export default function ChequePortfolioPage() {
  const invalidate = useInvalidateQuery();
  const [tab, setTab] = useState<Tab>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [active, setActive] = useState<PostDatedCheque | null>(null);
  const [action, setAction] = useState<'clear' | 'bounce' | 'replace' | null>(null);

  const { data, isLoading, isError } = useApiQuery<ChequePortfolio>(
    queryKeys.realEstate.cheques(),
    '/real-estate/cheques',
    undefined,
    { staleTime: staleTimes.transactionalMs, refetchOnWindowFocus: true }
  );
  const contractsQ = useApiQuery<UnitContractListItem[]>(queryKeys.realEstate.contracts(), '/real-estate/contracts', { limit: 200 });
  const banksQ = useApiQuery<BankAccountOption[]>(['bank-accounts-re'], '/accounting/bank-accounts', { isActive: true });

  const portfolio = data?.data;
  const stats = portfolio?.stats;
  const cheques = useMemo(() => portfolio?.cheques ?? [], [portfolio?.cheques]);
  const refresh = () => {
    invalidate(queryKeys.realEstate.cheques());
    invalidate(queryKeys.realEstate.contracts());
    setSelected([]);
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    return cheques.filter((row) => {
      if (tab === 'CUSTODY') return row.status === 'UNDER_SAFE_CUSTODY';
      if (tab === 'COLLECTION') return row.status === 'DEPOSITED_UNDER_COLLECTION';
      if (tab === 'BOUNCED') return row.status === 'BOUNCED_RETURNED';
      if (tab === 'DUE_7') {
        const due = new Date(row.chequeDate).getTime();
        return row.status === 'UNDER_SAFE_CUSTODY' && due >= now && due <= now + 7 * 86400000;
      }
      return true;
    });
  }, [cheques, tab]);

  const selectedCheque = active ?? cheques.find((row) => selected.length === 1 && row.id === selected[0]) ?? null;

  return (
    <RealEstatePageShell>
      <PageHeader
        title="محفظة الشيكات الآجلة"
        breadcrumbs={[{ label: 'العقاري', href: '/real-estate' }, { label: 'الشيكات' }]}
        actions={<Button onClick={() => setBatchOpen(true)}>تسجيل دفعة شيكات</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ReMetric label="تحت الحفظ بالخزينة" value={`${stats?.inCustodyCount ?? 0} / ${formatEgp(stats?.inCustodyValue ?? 0)}`} />
        <ReMetric label="برسم التحصيل في البنك" value={`${stats?.underCollectionCount ?? 0} / ${formatEgp(stats?.underCollectionValue ?? 0)}`} />
        <ReMetric label="محصّل" value={formatEgp(stats?.clearedValue ?? 0)} tone="success" />
        <ReMetric
          label="شيكات مرتدة"
          value={`${stats?.bouncedCount ?? 0} / ${formatEgp(stats?.bouncedValue ?? 0)}`}
          tone="danger"
        />
      </div>

      <ReCard>
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                tab === item.id ? 'bg-[#0E79AA] text-white' : 'bg-[#F0F7FB] text-[#094C6B]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={!selected.length} onClick={() => setDepositOpen(true)}>
            إيداع في البنك
          </Button>
          <Button size="sm" variant="secondary" disabled={selected.length !== 1} onClick={() => { setActive(selectedCheque); setAction('clear'); }}>
            تحصيل
          </Button>
          <Button size="sm" variant="danger" disabled={selected.length !== 1} onClick={() => { setActive(selectedCheque); setAction('bounce'); }}>
            ارتداد
          </Button>
          <Button size="sm" variant="secondary" disabled={selected.length !== 1} onClick={() => { setActive(selectedCheque); setAction('replace'); }}>
            استبدال
          </Button>
        </div>

        {isLoading ? (
          <TableSkeleton columns={7} rows={8} />
        ) : isError ? (
          <EmptyState title="تعذر تحميل المحفظة" />
        ) : (
          <ChequePortfolioTable
            rows={filtered}
            selectedIds={selected}
            onToggle={(id, checked) =>
              setSelected((prev) => (checked ? [...prev, id] : prev.filter((row) => row !== id)))
            }
          />
        )}
      </ReCard>

      {batchOpen ? (
        <BatchChequeModal
          open
          contracts={contractsQ.data?.data ?? []}
          installments={[]}
          onClose={() => setBatchOpen(false)}
          onSaved={refresh}
        />
      ) : null}
      {depositOpen ? (
        <DepositChequesModal
          open
          chequeIds={selected}
          banks={banksQ.data?.data ?? []}
          onClose={() => setDepositOpen(false)}
          onSaved={refresh}
        />
      ) : null}
      {action === 'clear' ? (
        <ClearChequeModal open cheque={active} onClose={() => setAction(null)} onSaved={refresh} />
      ) : null}
      {action === 'bounce' ? (
        <BounceChequeModal open cheque={active} onClose={() => setAction(null)} onSaved={refresh} />
      ) : null}
      {action === 'replace' ? (
        <ReplaceChequeModal open cheque={active} onClose={() => setAction(null)} onSaved={refresh} />
      ) : null}
    </RealEstatePageShell>
  );
}
