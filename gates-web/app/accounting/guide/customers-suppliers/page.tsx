'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilterToolbar, Button } from '@/components/ui';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { MasterGuideTree } from '@/components/accounting/guide/MasterGuideTree';
import { groupAsFolders, type GuideTreeNode } from '@/lib/accounting/buildGuideTree';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { useAppTabs } from '@/app/components/AppTabsContext';
import type { PartyGroupRow } from '@/components/accounting/PartyGroupCardPage';

type PartyKind = 'customers' | 'suppliers';

type PartyRow = {
  id: string;
  serial?: string | null;
  code?: string | null;
  arabicName: string;
  mobile?: string | null;
  phone1?: string | null;
  customerCategoryId?: string | null;
  supplierCategoryId?: string | null;
};

const KIND_FILTERS: { id: PartyKind; label: string }[] = [
  { id: 'customers', label: 'عملاء' },
  { id: 'suppliers', label: 'موردين' },
];

export default function CustomersSuppliersGuidePage() {
  const router = useRouter();
  const tabs = useAppTabs();
  const invalidate = useInvalidateQuery();
  const [partyKind, setPartyKind] = useState<PartyKind>('customers');
  const [search, setSearch] = useState('');
  const [expandToken, setExpandToken] = useState(0);
  const [collapseToken, setCollapseToken] = useState(0);

  const isCustomers = partyKind === 'customers';
  const partiesPath = isCustomers ? '/accounting/customers' : '/accounting/suppliers';
  const groupsPath = isCustomers ? '/accounting/customer-categories' : '/accounting/supplier-categories';
  const noun = isCustomers ? 'عميل' : 'مورد';
  const cardPath = isCustomers ? '/accounting/cards/customer' : '/accounting/cards/supplier';

  const { data: groupsRes, isLoading: groupsLoading } = useApiQuery<PartyGroupRow[]>(
    [isCustomers ? 'customer-categories' : 'supplier-categories', 'guide'],
    groupsPath,
    { limit: 500, isActive: true },
    { staleTime: 15_000 }
  );
  const { data: partiesRes, isLoading: partiesLoading, refetch } = useApiQuery<PartyRow[]>(
    [partyKind, 'guide'],
    partiesPath,
    { limit: 1000, isActive: true },
    { staleTime: 15_000 }
  );

  const groups = groupsRes?.data ?? [];
  const parties = partiesRes?.data ?? [];
  const isLoading = groupsLoading || partiesLoading;

  const categoryIdOf = (row: PartyRow) =>
    isCustomers ? row.customerCategoryId ?? '' : row.supplierCategoryId ?? '';

  const tree = useMemo(() => {
    const leavesIn = (groupId: string): GuideTreeNode[] =>
      parties
        .filter((row) => categoryIdOf(row) === groupId)
        .map((row) => ({
          id: row.id,
          code: row.code || row.serial || '—',
          name: row.arabicName,
          subtitle: row.mobile || row.phone1 || undefined,
          groupKey: groupId || 'ungrouped',
        }));

    const folders = groups.map((group) => ({
      id: `group:${group.id}`,
      code: group.code || group.legacyCode || '—',
      name: group.arabicName,
      groupKey: group.id,
      children: leavesIn(group.id),
    }));

    const ungrouped = leavesIn('');
    if (ungrouped.length) {
      folders.push({
        id: 'group:ungrouped',
        code: '—',
        name: 'بدون مجموعة',
        groupKey: '',
        children: ungrouped,
      });
    }

    return groupAsFolders(folders, { keepEmpty: true });
  }, [groups, parties, isCustomers]);

  const openCard = (href: string) => {
    if (tabs) {
      tabs.openAppTab(href);
      return;
    }
    router.push(href);
  };

  const openCreate = (parent?: GuideTreeNode) => {
    const groupId = parent?.synthetic ? parent.groupKey ?? '' : '';
    const qs = new URLSearchParams();
    if (groupId) qs.set('categoryId', groupId);
    openCard(qs.size ? `${cardPath}?${qs.toString()}` : cardPath);
  };

  const openEdit = (node: GuideTreeNode) => {
    if (node.folder || node.synthetic) return;
    openCard(`${cardPath}?id=${encodeURIComponent(node.id)}`);
  };

  const handleDelete = async (node: GuideTreeNode) => {
    if (node.folder || node.synthetic) return;
    if (!window.confirm(`حذف «${node.name}»؟`)) return;
    try {
      await apiClient.delete(`${partiesPath}/${node.id}`);
      toast.success(`تم حذف ال${noun}`);
      invalidate([partyKind]);
      void refetch();
    } catch (e) {
      toast.error(`تعذّر حذف ال${noun}`, {
        description: e instanceof Error ? e.message : 'حدّث الدليل ثم أعد المحاولة.',
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
          { label: 'العملاء والموردون' },
        ]}
        title="دليل العملاء والموردين"
        showDocumentRef={false}
        statusTone="info"
        statusLabel="دليل"
        hideStandalonePost
        hideBrowseList
        hideActionMenu
        favoriteHref="/accounting/guide/customers-suppliers"
        favoriteLabel="دليل العملاء والموردين"
      />

      <div className="mt-2 flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => openCreate()}>
          + إضافة
        </Button>
        <FilterToolbar
          className="min-w-0 flex-1"
          searchPlaceholder="بحث بالرمز أو الاسم أو الهاتف…"
          onSearchChange={setSearch}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpandToken((t) => t + 1)}>
            ⊞ توسيع الكل
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCollapseToken((t) => t + 1)}>
            ⊟ طي الكل
          </Button>
          <div className="mr-auto flex flex-wrap gap-1">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPartyKind(f.id)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  partyKind === f.id
                    ? 'border-[#0E79AA] bg-[#0E79AA] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <p className="text-slate-600">جاري تحميل الدليل…</p>
        ) : (
          <MasterGuideTree
            nodes={tree}
            search={search}
            expandAllToken={expandToken}
            collapseAllToken={collapseToken}
            childNoun={isCustomers ? 'عملاء' : 'موردين'}
            onAddChild={openCreate}
            canAddChild={(n) => Boolean(n.folder || n.synthetic)}
            onEdit={openEdit}
            onDelete={(n) => void handleDelete(n)}
          />
        )}
      </div>
    </ErpDocumentLayout>
  );
}
