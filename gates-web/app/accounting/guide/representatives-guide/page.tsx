'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilterToolbar, Button } from '@/components/ui';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { MasterGuideTree } from '@/components/accounting/guide/MasterGuideTree';
import { DistributionAddDialog, type DistributionFolderRole } from '@/components/accounting/DistributionAddDialog';
import { DistributionGroupModal } from '@/components/accounting/DistributionGroupModal';
import { staffCardHref, type StaffCardKind } from '@/components/accounting/StaffCardKindDialog';
import {
  buildParentTree,
  groupAsFolders,
  sortGuideNodes,
  type GuideTreeNode,
} from '@/lib/accounting/buildGuideTree';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import { useAppTabs } from '@/app/components/AppTabsContext';

type DelegateRow = {
  id: string;
  serial?: string | null;
  code?: string | null;
  arabicName: string;
  phone1?: string | null;
  mobile?: string | null;
  groupId?: string | null;
  role?: string;
};

const PAGE_TITLE = 'دليل المندوبين والتوزيع';

function isGroupRole(role?: string) {
  return Boolean(role && role.startsWith('GROUP'));
}

function folderRoleOf(role?: string): DistributionFolderRole {
  if (role === 'DRIVER' || role === 'GROUP_DRIVER') return 'DRIVER';
  if (role === 'DISTRIBUTOR' || role === 'GROUP_DISTRIBUTOR') return 'DISTRIBUTOR';
  return 'DELEGATE';
}

function staffKindFromRole(role?: string): StaffCardKind {
  const folder = folderRoleOf(role);
  if (folder === 'DISTRIBUTOR') return 'distributor';
  if (folder === 'DRIVER') return 'driver';
  return 'delegate';
}

function roleLabel(role?: string) {
  if (isGroupRole(role)) return 'مجموعة';
  if (role === 'DISTRIBUTOR') return 'موزع';
  if (role === 'DRIVER') return 'سائق';
  return 'مندوب';
}

const ROLE_TONES: Record<DistributionFolderRole, number> = {
  DRIVER: 2,
  DISTRIBUTOR: 4,
  DELEGATE: 0,
};

const ROLE_FOLDERS: Array<{
  id: string;
  role: DistributionFolderRole;
  code: string;
  name: string;
}> = [
  { id: 'role:DRIVER', role: 'DRIVER', code: 'DRV', name: 'سائق' },
  { id: 'role:DISTRIBUTOR', role: 'DISTRIBUTOR', code: 'DST', name: 'موزع' },
  { id: 'role:DELEGATE', role: 'DELEGATE', code: 'DEL', name: 'مندوب' },
];

function withTone(node: GuideTreeNode, toneIndex: number): GuideTreeNode {
  return {
    ...node,
    toneIndex,
    children: node.children?.map((child) => withTone(child, toneIndex)),
  };
}

function personNode(row: DelegateRow): GuideTreeNode {
  return {
    id: row.id,
    code: row.code || row.serial || '—',
    name: row.arabicName,
    subtitle: row.mobile || row.phone1 || undefined,
    groupKey: folderRoleOf(row.role),
    toneIndex: ROLE_TONES[folderRoleOf(row.role)],
  };
}

function attachPeopleToGroups(groupNodes: GuideTreeNode[], people: DelegateRow[]) {
  const index = new Map<string, GuideTreeNode>();
  const walk = (nodes: GuideTreeNode[]) => {
    for (const node of nodes) {
      index.set(node.id, node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(groupNodes);

  const loose: GuideTreeNode[] = [];
  for (const person of people) {
    const node = personNode(person);
    const parent = person.groupId ? index.get(person.groupId) : undefined;
    if (parent) {
      parent.children = [...(parent.children ?? []), node];
    } else {
      loose.push(node);
    }
  }
  return { folders: groupNodes, loose };
}

function roleFolderNode(role: DistributionFolderRole): GuideTreeNode {
  const folder = ROLE_FOLDERS.find((item) => item.role === role)!;
  return {
    id: folder.id,
    code: folder.code,
    name: folder.name,
    folder: true,
    synthetic: true,
    groupKey: folder.role,
    toneIndex: ROLE_TONES[folder.role],
  };
}

function realParentId(node?: GuideTreeNode | null) {
  if (!node || node.synthetic || node.id.startsWith('role:')) return null;
  return node.id;
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
  const [pickerStep, setPickerStep] = useState<'folder' | 'node' | 'person'>('folder');
  const [parentGroup, setParentGroup] = useState<GuideTreeNode | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<{
    id: string;
    code: string;
    arabicName: string;
    folderRole: DistributionFolderRole;
  } | null>(null);

  const tree = useMemo(() => {
    const people = rows.filter((row) => !isGroupRole(row.role));
    const groups = rows.filter((row) => isGroupRole(row.role));

    return groupAsFolders(
      ROLE_FOLDERS.map((folder) => {
        const roleGroups = groups.filter((row) => folderRoleOf(row.role) === folder.role);
        const rolePeople = people.filter((row) => folderRoleOf(row.role) === folder.role);
        const toneIndex = ROLE_TONES[folder.role];
        const groupTree = buildParentTree(
          roleGroups.map((row) => ({ ...row, parentId: row.groupId ?? null })),
          (item, children) =>
            withTone(
              {
                id: item.id,
                code: item.code || item.serial || '—',
                name: item.arabicName,
                subtitle: roleLabel(item.role),
                folder: true,
                groupKey: folder.role,
                children,
              },
              toneIndex
            )
        );
        const { folders, loose } = attachPeopleToGroups(groupTree, rolePeople);
        return {
          id: folder.id,
          code: folder.code,
          name: folder.name,
          groupKey: folder.role,
          toneIndex,
          children: sortGuideNodes([...folders, ...loose].map((child) => withTone(child, toneIndex))),
        };
      }),
      { keepEmpty: true }
    );
  }, [rows]);

  const openCard = (href: string) => {
    if (tabs) {
      tabs.openAppTab(href);
      return;
    }
    router.push(href);
  };

  const startAdd = (parent?: GuideTreeNode) => {
    if (parent && !parent.folder) {
      toast.error('الفرد لا يُفرَّع منه', { description: 'اختَر مجلد سائق / موزع / مندوب، أو مجموعة تحته.' });
      return;
    }
    if (parent) {
      setParentGroup(parent);
      setPickerStep('node');
    } else {
      setParentGroup(null);
      setPickerStep('folder');
    }
    setPickerOpen(true);
  };

  const openPersonCard = (kind: StaffCardKind) => {
    setPickerOpen(false);
    openCard(staffCardHref(kind, null, { groupId: realParentId(parentGroup) }));
  };

  const openEdit = (node: GuideTreeNode) => {
    if (node.folder && !node.synthetic) {
      setEditGroup({
        id: node.id,
        code: node.code === '—' ? '' : node.code,
        arabicName: node.name,
        folderRole: folderRoleOf(node.groupKey),
      });
      setParentGroup(node);
      setGroupModalOpen(true);
      return;
    }
    openCard(staffCardHref(staffKindFromRole(node.groupKey), node.id, { mode: 'edit' }));
  };

  const openView = (node: GuideTreeNode) => {
    if (node.folder || node.synthetic) return;
    openCard(staffCardHref(staffKindFromRole(node.groupKey), node.id, { mode: 'view' }));
  };

  const handleDelete = async (node: GuideTreeNode) => {
    if (node.synthetic) return;
    if (!(await confirmAction(`حذف «${node.name}»؟`))) return;
    try {
      await apiClient.delete(`/accounting/delegates/${node.id}`);
      toast.success(node.folder ? 'تم حذف المجموعة' : 'تم حذف الفرد');
      invalidate(['delegates']);
      void refetch();
    } catch (e) {
      toast.error('تعذّر الحذف', {
        description: e instanceof Error ? e.message : 'حدّث الدليل ثم أعد المحاولة.',
      });
    }
  };

  const activeFolderRole = folderRoleOf(parentGroup?.groupKey || editGroup?.folderRole);

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
            canAddChild={(n) => Boolean(n.folder)}
            onView={openView}
            onEdit={openEdit}
            onDelete={(n) => void handleDelete(n)}
          />
        )}
      </div>

      <DistributionAddDialog
        open={pickerOpen}
        parentLabel={parentGroup ? `${parentGroup.code} — ${parentGroup.name}` : null}
        folderRole={parentGroup ? folderRoleOf(parentGroup.groupKey) : null}
        step={pickerStep}
        onStepChange={(step) => {
          setPickerStep(step);
          if (step === 'folder') setParentGroup(null);
        }}
        onPickFolder={(role) => {
          setParentGroup(roleFolderNode(role));
          setPickerStep('node');
        }}
        onPickGroup={() => {
          setPickerOpen(false);
          setEditGroup(null);
          setGroupModalOpen(true);
        }}
        onPickPerson={openPersonCard}
        onClose={() => setPickerOpen(false)}
        canPickFolder={!parentGroup || Boolean(parentGroup.synthetic)}
      />

      {groupModalOpen ? (
        <DistributionGroupModal
          open
          parentId={editGroup ? null : realParentId(parentGroup)}
          parentLabel={
            editGroup
              ? null
              : parentGroup
                ? `${parentGroup.code} — ${parentGroup.name}`
                : null
          }
          folderRole={activeFolderRole}
          initial={editGroup}
          onClose={() => {
            setGroupModalOpen(false);
            setEditGroup(null);
          }}
          onSaved={() => {
            toast.success(editGroup ? 'تم تحديث المجموعة' : 'تم حفظ المجموعة');
            invalidate(['delegates']);
            invalidate(['delegates', 'next-code']);
            invalidate(['delegates', 'next-code', 'group']);
            void refetch();
          }}
          onError={(msg) => toast.error('تعذّر حفظ المجموعة', { description: msg })}
        />
      ) : null}
    </ErpDocumentLayout>
  );
}
