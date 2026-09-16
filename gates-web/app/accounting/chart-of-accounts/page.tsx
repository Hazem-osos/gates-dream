'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { FilterToolbar, Button } from '@/app/components/ui';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useCoaTreeQuery, useDeleteAccountMutation } from '@/lib/hooks/useChartOfAccounts';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { useSeedDefaultCoa } from '@/lib/hooks/useSeedDefaultCoa';
import { isSystemCashPostingAccount, type CoaHierarchyAccount } from '@/lib/accounting/mapCoaToTreeNodes';
import { AccountTree, type CoaNatureFilter } from '@/components/accounting/chart-of-accounts/AccountTree';
import { CoaEmptyState } from '@/components/accounting/chart-of-accounts/CoaEmptyState';
import { ChildAccountKindDialog } from '@/components/accounting/chart-of-accounts/ChildAccountKindDialog';
import { DynamicModalSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { toast } from '@/lib/feedback/toast';
import { NumberingModeControl } from '@/components/accounting/NumberingModeControl';

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
  { id: 'revenue', label: 'الإيرادات' },
  { id: 'expense', label: 'المصروفات' },
];

function findParentAccount(
  nodes: CoaHierarchyAccount[],
  childId: string
): CoaHierarchyAccount | null {
  for (const node of nodes) {
    if (node.children?.some((child) => child.id === childId)) return node;
    if (node.children?.length) {
      const found = findParentAccount(node.children, childId);
      if (found) return found;
    }
  }
  return null;
}

export default function ChartOfAccountsPage() {
  useBackendReachability();
  const { data, isLoading, refetch } = useCoaTreeQuery();
  const { data: settingsRes } = useAccountingSettingsQuery();
  const coaAutoNumbering = settingsRes?.data?.general?.coaAutoNumbering !== false;
  const accountRecordCount = settingsRes?.data?.general?.numberingRecordCounts?.accounts ?? 0;
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
  const [createKind, setCreateKind] = useState<'HEADER' | 'POSTING'>('HEADER');
  const [kindPickerParent, setKindPickerParent] = useState<CoaHierarchyAccount | null>(null);

  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerNode, setLedgerNode] = useState<CoaHierarchyAccount | null>(null);
  const [revealAccountId, setRevealAccountId] = useState<string | null>(null);

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
    setCreateKind('HEADER');
    setModalOpen(true);
  }, []);

  const allowSeed = isEmpty;

  const openCreateChild = (parent: CoaHierarchyAccount) => {
    const isHeader = parent.accountKind === 'HEADER' || parent.type === 'HEADER' || parent.isParent;
    if (!isHeader || isSystemCashPostingAccount(parent)) {
      toast.error('حساب الحركة لا يُفرَّع منه', {
        description: 'اختَر حساباً رئيسياً أو رئيسياً فرعياً، أو أنشئ الحركة تحت مجموعة أعلى.',
      });
      return;
    }
    setKindPickerParent(parent);
  };

  const openEdit = (node: CoaHierarchyAccount) => {
    setModalMode('edit');
    setEditNode(node);
    setParentNode(findParentAccount(tree, node.id));
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
    <ErpDocumentLayout className="coa-page">
      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[
          { href: '/accounting', label: 'المحاسبة' },
          { label: 'الدليل' },
          { label: 'دليل الحسابات' },
        ]}
        title="دليل الحسابات"
        showDocumentRef={false}
        statusTone="info"
        statusLabel="دليل"
        hideStandalonePost
        hideBrowseList
        hideActionMenu
        favoriteHref="/accounting/chart-of-accounts"
        favoriteLabel="دليل الحسابات"
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
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={openCreateRoot}>
              + إضافة حساب رئيسي
            </Button>
            <NumberingModeControl
              kind="accounts"
              auto={coaAutoNumbering}
              recordCount={accountRecordCount}
              settingKey="coaAutoNumbering"
            />
            <FilterToolbar
              className="min-w-0 flex-1"
              searchPlaceholder="بحث بالرمز أو الاسم (مثل: عملاء أو 112)…"
              onSearchChange={setSearch}
            />
          </div>

          <div className="mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 text-slate-900">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandToken((t) => t + 1)}>
                ⊞ توسيع الكل
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCollapseToken((t) => t + 1)}>
                ⊟ طي الكل
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
            {isLoading && tree.length === 0 ? (
              <p className="text-slate-600">جاري تحميل الشجرة…</p>
            ) : (
              <AccountTree
                nodes={tree}
                search={search}
                natureFilter={natureFilter}
                expandAllToken={expandToken}
                collapseAllToken={collapseToken}
                revealAccountId={revealAccountId}
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
          createKind={createKind}
          lockAsRoot={modalMode === 'create' && !parentNode}
          onClose={() => setModalOpen(false)}
          onSaved={(accountId) => {
            toast.success('تم حفظ الحساب');
            if (accountId) setRevealAccountId(accountId);
            void refetch();
          }}
          onError={(msg) => toast.error('تعذّر حفظ الحساب', { description: msg })}
        />
      ) : null}

      <ChildAccountKindDialog
        open={Boolean(kindPickerParent)}
        parentLabel={
          kindPickerParent
            ? `${kindPickerParent.code} — ${kindPickerParent.arabicName ?? kindPickerParent.nameAr}`
            : ''
        }
        onClose={() => setKindPickerParent(null)}
        onPick={(kind) => {
          if (!kindPickerParent) return;
          setModalMode('create');
          setEditNode(null);
          setParentNode(kindPickerParent);
          setCreateKind(kind);
          setKindPickerParent(null);
          setModalOpen(true);
        }}
      />

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
    </ErpDocumentLayout>
  );
}
