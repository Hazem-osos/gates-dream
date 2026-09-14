'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { PageHeader, FilterToolbar, Button } from '@/app/components/ui';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useCoaTreeQuery, useDeleteAccountMutation } from '@/lib/hooks/useChartOfAccounts';
import { useSeedDefaultCoa } from '@/lib/hooks/useSeedDefaultCoa';
import type { CoaHierarchyAccount } from '@/lib/accounting/mapCoaToTreeNodes';
import { AccountTree, type CoaNatureFilter } from '@/components/accounting/chart-of-accounts/AccountTree';
import { CoaEmptyState } from '@/components/accounting/chart-of-accounts/CoaEmptyState';
import { DynamicModalSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { toast } from '@/lib/feedback/toast';

const AccountFormModal = dynamic(
  () =>
    import('@/components/accounting/chart-of-accounts/AccountFormModal').then((m) => ({
      default: m.AccountFormModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل نموذج الحساب…" /> }
);

const AccountLedgerDrawer = dynamic(
  () =>
    import('@/components/accounting/chart-of-accounts/AccountLedgerDrawer').then((m) => ({
      default: m.AccountLedgerDrawer,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل كشف الحساب…" /> }
);

const NATURE_FILTERS: { id: CoaNatureFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'asset', label: 'الأصول' },
  { id: 'liability', label: 'الالتزامات' },
  { id: 'equity', label: 'الملكية' },
  { id: 'revenue', label: 'الإيرادات' },
  { id: 'expense', label: 'المصروفات' },
];

export default function ChartOfAccountsPage() {
  useBackendReachability();
  const { data, isLoading, refetch } = useCoaTreeQuery();
  const deleteMut = useDeleteAccountMutation();
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('general');
  const [natureFilter, setNatureFilter] = useState<CoaNatureFilter>('all');
  const [expandToken, setExpandToken] = useState(0);
  const [collapseToken, setCollapseToken] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editNode, setEditNode] = useState<CoaHierarchyAccount | null>(null);
  const [parentNode, setParentNode] = useState<CoaHierarchyAccount | null>(null);

  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerNode, setLedgerNode] = useState<CoaHierarchyAccount | null>(null);

  const tree = (data?.data ?? []) as CoaHierarchyAccount[];
  const isEmpty = !isLoading && tree.length === 0;

  const seedCoa = useSeedDefaultCoa({
    onSuccess: (res) => {
      toast.success('تم تهيئة شجرة الحسابات', {
        description: res.skipped
          ? 'الشجرة موجودة مسبقاً — تم التحقق من بيانات النظام.'
          : `تم إنشاء ${res.accountsCreated} حساباً (${res.count} إجمالاً).`,
      });
      void refetch();
    },
    onError: (e) => toast.error('تعذر تهيئة الشجرة', { description: e.message }),
  });

  const openCreateRoot = useCallback(() => {
    setModalMode('create');
    setEditNode(null);
    setParentNode(null);
    setModalOpen(true);
  }, []);

  const allowSeed = process.env.NODE_ENV !== 'production';

  const headerActions = useMemo(
    () =>
      isEmpty ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={openCreateRoot}>
            + إضافة حساب رئيسي
          </Button>
          {allowSeed ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => seedCoa.mutate({ industry, force: false })}
              disabled={seedCoa.isPending}
            >
              {seedCoa.isPending ? 'جاري التحديث…' : 'مزامنة الدليل القياسي'}
            </Button>
          ) : null}
        </div>
      ),
    [isEmpty, industry, openCreateRoot, seedCoa, allowSeed]
  );

  const openCreateChild = (parent: CoaHierarchyAccount) => {
    setModalMode('create');
    setEditNode(null);
    setParentNode(parent);
    setModalOpen(true);
  };

  const openEdit = (node: CoaHierarchyAccount) => {
    setModalMode('edit');
    setEditNode(node);
    setParentNode(null);
    setModalOpen(true);
  };

  const confirmDelete = async (node: CoaHierarchyAccount) => {
    const ok = window.confirm(`حذف الحساب ${node.code} — ${node.arabicName ?? node.nameAr}؟`);
    if (!ok) return;
    try {
      await deleteMut.mutateAsync({ id: node.id });
      toast.success('تم حذف الحساب');
    } catch (e) {
      toast.error('تعذّر الحذف', {
        description: e instanceof Error ? e.message : 'تحقق من وجود حسابات فرعية أو حركات.',
      });
    }
  };

  return (
    <div
      className="coa-page min-h-full bg-white text-slate-900"
      dir="rtl"
      style={{ colorScheme: 'light' }}
    >
      <PageHeader
        title="شجرة الحسابات"
        description="دليل حسابات مصري معياري — بحث، تصفية، وكشف حساب"
        favoriteHref="/accounting/chart-of-accounts"
        favoriteLabel="شجرة الحسابات"
        className="[&_h1]:text-xl [&_h1]:font-bold [&_h1]:!text-slate-900 [&_p]:!text-slate-600"
        statusBadge={
          <span className="inline-flex items-center border border-slate-200 bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-medium">
            دليل الحسابات المصري
          </span>
        }
        actions={headerActions}
      />

      {isEmpty ? (
        <div data-tour="coa-tree">
          <CoaEmptyState
            industry={industry}
            onIndustryChange={setIndustry}
            seeding={seedCoa.isPending}
            allowSeed={allowSeed}
            onSeed={allowSeed ? () => seedCoa.mutate({ industry, force: false }) : undefined}
            onCreateRoot={openCreateRoot}
          />
        </div>
      ) : (
        <>
          <div className="mt-2">
            <FilterToolbar searchPlaceholder="بحث بالرمز أو الاسم (مثل: عملاء أو 112)…" onSearchChange={setSearch} />
          </div>

          <div className="mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 text-slate-900">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandToken((t) => t + 1)}>
                ⊞ توسيع الكل
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCollapseToken((t) => t + 1)}>
                ⊟ طي الكل
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={openCreateRoot}>
                + إضافة حساب رئيسي جديد
              </Button>
              <div className="flex flex-wrap gap-1 mr-auto">
                {NATURE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setNatureFilter(f.id)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      natureFilter === f.id
                        ? 'bg-[#0E79AA] text-white border-[#0E79AA]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div data-tour="coa-tree">
            {isLoading ? (
              <p className="text-slate-600">جاري تحميل الشجرة…</p>
            ) : (
              <AccountTree
                nodes={tree}
                search={search}
                natureFilter={natureFilter}
                expandAllToken={expandToken}
                collapseAllToken={collapseToken}
                onAddChild={openCreateChild}
                onEdit={openEdit}
                onDelete={(n) => void confirmDelete(n)}
                onLedger={(n) => {
                  setLedgerNode(n);
                  setLedgerOpen(true);
                }}
              />
            )}
            </div>
          </div>
        </>
      )}

      {modalOpen ? (
        <AccountFormModal
          open
          mode={modalMode}
          initial={editNode}
          parentAccount={parentNode}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            toast.success('تم حفظ الحساب');
            void refetch();
          }}
          onError={(msg) => toast.error(msg)}
        />
      ) : null}

      {ledgerOpen ? (
        <AccountLedgerDrawer
          open
          accountId={ledgerNode?.id ?? null}
          accountLabel={
            ledgerNode ? `${ledgerNode.code} — ${ledgerNode.arabicName ?? ledgerNode.nameAr}` : ''
          }
          onClose={() => setLedgerOpen(false)}
        />
      ) : null}
    </div>
  );
}
