'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilterToolbar, Button } from '@/components/ui';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { MasterGuideTree } from '@/components/accounting/guide/MasterGuideTree';
import { DistributionAddDialog } from '@/components/accounting/DistributionAddDialog';
import { DistributionGroupModal } from '@/components/accounting/DistributionGroupModal';
import { staffCardHref, type StaffCardKind } from '@/components/accounting/StaffCardKindDialog';
import { buildParentTree, type GuideTreeNode } from '@/lib/accounting/buildGuideTree';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { useAppTabs } from '@/app/components/AppTabsContext';
import { nextNumericSerial } from '@/lib/masters/nextNumericSerial';

type DelegateRow = {
  id: string;
  serial?: string | null;
  code?: string | null;
  arabicName: string;
  phone1?: string | null;
  mobile?: string | null;
  groupId?: string | null;
  role?: 'DELEGATE' | 'DISTRIBUTOR' | 'DRIVER' | 'GROUP' | string;
};

const PAGE_TITLE = 'دليل المندوبين والتوزيع';

function staffKindFromRole(role?: string): StaffCardKind {
  if (role === 'DISTRIBUTOR') return 'distributor';
  if (role === 'DRIVER') return 'driver';
  return 'delegate';
}

function roleLabel(role?: string) {
  if (role === 'GROUP') return 'مجموعة';
  if (role === 'DISTRIBUTOR') return 'موزع';
  if (role === 'DRIVER') return 'سائق';
  return 'مندوب';
}

export default function RepresentativesGuidePage() {
  const router = useRouter();
  const tabs = useAppTabs();
  const invalidate = useInvalidateQuery();
  const { data, isLoading, refetch } = useApiQuery<DelegateRow[]>(
    ['delegates', 'guide'],
    '/accounting/delegates',
    { limit: 1000, includeGroups: true, isActive: true },
    { staleTime: 15_000 }
  );

  const rows = data?.data ?? [];
  const [search, setSearch] = useState('');
  const [expandToken, setExpandToken] = useState(0);
  const [collapseToken, setCollapseToken] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<'node' | 'person'>('node');
  const [parentGroup, setParentGroup] = useState<GuideTreeNode | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<{ id: string; code: string; arabicName: string } | null>(null);

  const suggestedCode = useMemo(
    () => nextNumericSerial(rows.flatMap((row) => [row.serial, row.code])),
    [rows]
  );

  const tree = useMemo(
    () =>
      buildParentTree(
        rows.map((r) => ({ ...r, parentId: r.groupId ?? null })),
        (item, children) => ({
          id: item.id,
          code: item.code || item.serial || '—',
          name: item.arabicName,
          subtitle: roleLabel(item.role),
          folder: item.role === 'GROUP',
          groupKey: item.role,
          children,
        })
      ),
    [rows]
  );

  const openCard = (href: string) => {
    if (tabs) {
      tabs.openAppTab(href);
      return;
    }
    router.push(href);
  };

  const startAdd = (parent?: GuideTreeNode) => {
    if (parent && parent.groupKey !== 'GROUP' && !parent.folder) {
      toast.error('الفرد لا يُفرَّع منه', { description: 'اختَر مجموعة، أو أنشئ مجموعة جديدة.' });
      return;
    }
    setParentGroup(parent && (parent.folder || parent.groupKey === 'GROUP') ? parent : null);
    setPickerStep('node');
    setPickerOpen(true);
  };

  const openPersonCard = (kind: StaffCardKind) => {
    setPickerOpen(false);
    openCard(staffCardHref(kind, null, { groupId: parentGroup?.id }));
  };

  const openEdit = (node: GuideTreeNode) => {
    if (node.folder || node.groupKey === 'GROUP') {
      setEditGroup({ id: node.id, code: node.code === '—' ? '' : node.code, arabicName: node.name });
      setParentGroup(null);
      setGroupModalOpen(true);
      return;
    }
    openCard(staffCardHref(staffKindFromRole(node.groupKey), node.id));
  };

  const handleDelete = async (node: GuideTreeNode) => {
    if (!window.confirm(`حذف «${node.name}»؟`)) return;
    try {
      await apiClient.delete(`/accounting/delegates/${node.id}`);
      toast.success(node.folder || node.groupKey === 'GROUP' ? 'تم حذف المجموعة' : 'تم حذف الفرد');
      invalidate(['delegates']);
      void refetch();
    } catch (e) {
      toast.error('تعذّر الحذف', {
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
          { label: PAGE_TITLE },
        ]}
        title={PAGE_TITLE}
        showDocumentRef={false}
        statusTone="info"
        statusLabel="دليل"
        hideStandalonePost
        hideBrowseList
        hideActionMenu
        favoriteHref="/accounting/guide/representatives-guide"
        favoriteLabel={PAGE_TITLE}
      />

      <div className="mt-2 flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => startAdd()}>
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
        </div>
        {isLoading && tree.length === 0 ? (
          <p className="text-slate-600">جاري تحميل الدليل…</p>
        ) : (
          <MasterGuideTree
            nodes={tree}
            search={search}
            expandAllToken={expandToken}
            collapseAllToken={collapseToken}
            childNoun="فرع"
            onAddChild={startAdd}
            canAddChild={(n) => Boolean(n.folder || n.groupKey === 'GROUP')}
            onEdit={openEdit}
            onDelete={(n) => void handleDelete(n)}
          />
        )}
      </div>

      <DistributionAddDialog
        open={pickerOpen}
        parentLabel={parentGroup ? `${parentGroup.code} — ${parentGroup.name}` : null}
        step={pickerStep}
        onStepChange={setPickerStep}
        onPickGroup={() => {
          setPickerOpen(false);
          setEditGroup(null);
          setGroupModalOpen(true);
        }}
        onPickPerson={openPersonCard}
        onClose={() => setPickerOpen(false)}
      />

      {groupModalOpen ? (
        <DistributionGroupModal
          open
          parentId={editGroup ? null : parentGroup?.id}
          parentLabel={editGroup ? null : parentGroup ? `${parentGroup.code} — ${parentGroup.name}` : null}
          suggestedCode={suggestedCode}
          initial={editGroup}
          onClose={() => {
            setGroupModalOpen(false);
            setEditGroup(null);
          }}
          onSaved={() => {
            toast.success(editGroup ? 'تم تحديث المجموعة' : 'تم حفظ المجموعة');
            invalidate(['delegates']);
            void refetch();
          }}
          onError={(msg) => toast.error('تعذّر حفظ المجموعة', { description: msg })}
        />
      ) : null}
    </ErpDocumentLayout>
  );
}
