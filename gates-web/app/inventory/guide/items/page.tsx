'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { FilterToolbar, Button, CompactFormField } from '@/components/ui';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { MasterGuideTree } from '@/components/accounting/guide/MasterGuideTree';
import { GuideEntityModal } from '@/components/accounting/guide/GuideEntityModal';
import { buildParentTree, type GuideTreeNode } from '@/lib/accounting/buildGuideTree';
import { NumberingModeControl } from '@/components/accounting/NumberingModeControl';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import { asWarehouseRows } from '@/components/inventory/WarehousesListSection';
import type { ItemRow } from '@/components/inventory/ItemsCatalogListSection';
import type { ItemGroupRow } from '@/components/inventory/ItemGroupsListSection';
import { ItemGroupSelect } from '@/components/form/ItemGroupSelect';

function asRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const nested =
      (data as { categories?: unknown }).categories ??
      (data as { items?: unknown }).items ??
      (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return asWarehouseRows(data) as T[];
}

export default function ItemsGuidePage() {
  const router = useRouter();
  const invalidate = useInvalidateQuery();
  const { data: settingsRes } = useAccountingSettingsQuery();
  const itemAuto = settingsRes?.data?.general?.itemAutoNumbering !== false;
  const itemRecordCount = settingsRes?.data?.general?.numberingRecordCounts?.items ?? 0;

  const { data: groupsRes, isLoading: groupsLoading, refetch: refetchGroups } = useApiQuery<ItemGroupRow[]>(
    ['item-categories', 'guide'],
    '/inventory/item-categories',
    { limit: 1000, isActive: true },
    { staleTime: 15_000 }
  );
  const { data: itemsRes, isLoading: itemsLoading, refetch: refetchItems } = useApiQuery<ItemRow[]>(
    ['items', 'guide'],
    '/inventory/items',
    { limit: 1000, isActive: true },
    { staleTime: 15_000 }
  );

  const groups = asRows<ItemGroupRow>(groupsRes?.data);
  const items = asRows<ItemRow>(itemsRes?.data);
  const isLoading = groupsLoading || itemsLoading;

  const [search, setSearch] = useState('');
  const [expandToken, setExpandToken] = useState(0);
  const [collapseToken, setCollapseToken] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editId, setEditId] = useState<string | null>(null);
  const [parentId, setParentId] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [saving, setSaving] = useState(false);

  const tree = useMemo(() => {
    const itemsByGroup = new Map<string | null, ItemRow[]>();
    for (const item of items) {
      const key = (item.categoryId as string | null | undefined) ?? null;
      const list = itemsByGroup.get(key) ?? [];
      list.push(item);
      itemsByGroup.set(key, list);
    }

    const toItemNode = (item: ItemRow): GuideTreeNode => ({
      id: item.id,
      code: String(item.code || item.serial || ''),
      name: item.arabicName,
      subtitle: 'صنف',
      folder: false,
      groupKey: 'item',
    });

    const groupTree = buildParentTree(
      groups.map((row) => ({ ...row, parentId: row.parentCategoryId ?? null })),
      (group, children) => ({
        id: group.id,
        code: group.code || '',
        name: group.arabicName,
        subtitle: group.groupType === 'SUB' ? 'مجموعة فرعية' : 'مجموعة',
        folder: true,
        groupKey: 'group',
        children: [...children, ...(itemsByGroup.get(group.id) ?? []).map(toItemNode)],
      })
    );

    const ungrouped = (itemsByGroup.get(null) ?? []).map(toItemNode);
    if (ungrouped.length === 0) return groupTree;
    return [
      ...groupTree,
      {
        id: '__ungrouped',
        code: '',
        name: 'بدون مجموعة',
        subtitle: 'أصناف',
        folder: true,
        synthetic: true,
        groupKey: 'ungrouped',
        children: ungrouped,
      },
    ];
  }, [groups, items]);

  const parentLabel = useMemo(() => {
    if (!parentId) return 'مجموعة رئيسية';
    const parent = groups.find((row) => row.id === parentId);
    return parent ? `${parent.code || '—'} — ${parent.arabicName}` : 'مجموعة رئيسية';
  }, [groups, parentId]);

  const openCreateGroup = (parent?: GuideTreeNode) => {
    if (parent && (parent.groupKey === 'item' || parent.synthetic)) return;
    setModalMode('create');
    setEditId(null);
    setParentId(parent && parent.groupKey === 'group' ? parent.id : '');
    setArabicName('');
    setEnglishName('');
    setModalOpen(true);
  };

  const openEditGroup = (node: GuideTreeNode) => {
    if (node.groupKey === 'item') {
      router.push(`/inventory/creations/item-card?id=${node.id}`);
      return;
    }
    const row = groups.find((item) => item.id === node.id);
    if (!row) return;
    setModalMode('edit');
    setEditId(row.id);
    setParentId(row.parentCategoryId ?? '');
    setArabicName(row.arabicName ?? '');
    setEnglishName(row.englishName ?? '');
    setModalOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!arabicName.trim()) {
      toast.error('أدخل اسم المجموعة');
      return;
    }
    setSaving(true);
    try {
      const body = {
        arabicName: arabicName.trim(),
        englishName: englishName.trim() || undefined,
        groupType: parentId ? 'SUB' : 'MAIN',
        parentCategoryId: parentId || null,
      };
      if (modalMode === 'edit' && editId) {
        await apiClient.put(`/inventory/item-categories/${editId}`, body);
        toast.success('تم حفظ المجموعة');
        setModalOpen(false);
      } else {
        await apiClient.post('/inventory/item-categories', body);
        toast.success('تم حفظ المجموعة — تقدر تضيف التالية');
        setArabicName('');
        setEnglishName('');
      }
      invalidate(['item-categories']);
      invalidate(['items']);
      void refetchGroups();
      void refetchItems();
    } catch (e) {
      toast.error('تعذّر حفظ المجموعة', {
        description: e instanceof Error ? e.message : 'راجع اسم المجموعة ثم أعد المحاولة.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (node: GuideTreeNode) => {
    if (node.synthetic) return;
    if (node.groupKey === 'item') {
      if (!(await confirmAction(`حذف الصنف ${node.code} — ${node.name}؟`))) return;
      try {
        await apiClient.delete(`/inventory/items/${node.id}`);
        toast.success('تم حذف الصنف');
        invalidate(['items']);
        void refetchItems();
      } catch (e) {
        toast.error('تعذّر حذف الصنف', {
          description: e instanceof Error ? e.message : 'تحقق من وجود حركات على الصنف.',
        });
      }
      return;
    }
    if (!(await confirmAction(`حذف المجموعة ${node.code} — ${node.name}؟`))) return;
    try {
      await apiClient.delete(`/inventory/item-categories/${node.id}`);
      toast.success('تم حذف المجموعة');
      invalidate(['item-categories']);
      invalidate(['items']);
      void refetchGroups();
    } catch (e) {
      toast.error('تعذّر حذف المجموعة', {
        description: e instanceof Error ? e.message : 'انقل الأصناف أو المجموعات الفرعية أولاً.',
      });
    }
  };

  const isEmpty = !isLoading && groups.length === 0 && items.length === 0;

  return (
    <ErpDocumentLayout className="coa-page">
      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[
          { href: '/inventory', label: 'المخازن' },
          { label: 'الدليل' },
          { label: 'الأصناف' },
        ]}
        title="دليل الأصناف"
        showDocumentRef={false}
        statusTone="info"
        statusLabel="دليل"
        hideStandalonePost
        hideBrowseList
        hideActionMenu
        favoriteHref="/inventory/guide/items"
        favoriteLabel="دليل الأصناف"
        extraActions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => openCreateGroup()}>
              + إضافة مجموعة
            </Button>
            <NumberingModeControl
              kind="items"
              auto={itemAuto}
              recordCount={itemRecordCount}
              settingKey="itemAutoNumbering"
            />
            <Link href="/inventory/guide/items/import">
              <Button variant="secondary">استيراد أصناف</Button>
            </Link>
          </div>
        }
      />

      {isEmpty ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
          <Package className="mx-auto mb-3 h-8 w-8 text-[#0E79AA]" />
          <p className="text-lg font-semibold text-slate-800">لا توجد مجموعات أو أصناف بعد</p>
          <p className="mt-1 text-sm text-slate-500">أضف مجموعة أولاً، ثم أصناف تحتها — زي شجرة الحسابات.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={() => openCreateGroup()}>
              + إضافة مجموعة
            </Button>
            <Link href="/inventory/creations/item-card">
              <Button variant="secondary">صنف جديد</Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" size="sm" onClick={() => openCreateGroup()}>
              + إضافة مجموعة
            </Button>
            <Link href="/inventory/creations/item-card">
              <Button variant="secondary" size="sm">
                + صنف جديد
              </Button>
            </Link>
            <FilterToolbar
              className="min-w-0 flex-1"
              searchPlaceholder="بحث بالمجموعة أو الصنف…"
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
            {isLoading ? (
              <p className="text-slate-600">جاري تحميل الدليل…</p>
            ) : (
              <MasterGuideTree
                nodes={tree}
                search={search}
                expandAllToken={expandToken}
                collapseAllToken={collapseToken}
                childNoun="عناصر"
                addChildLabel="مجموعة فرعية"
                onAddChild={openCreateGroup}
                canAddChild={(node) => node.groupKey === 'group'}
                onView={(node) => {
                  if (node.groupKey === 'item') {
                    router.push(`/inventory/creations/item-card?id=${node.id}`);
                  }
                }}
                onEdit={openEditGroup}
                onDelete={(node) => void handleDelete(node)}
              />
            )}
          </div>
        </>
      )}

      <GuideEntityModal
        open={modalOpen}
        title={modalMode === 'edit' ? 'تعديل مجموعة' : parentId ? 'إضافة مجموعة فرعية' : 'إضافة مجموعة'}
        subtitle={`تحت: ${parentLabel}`}
        hint={modalMode === 'create' ? 'بعد الحفظ النموذج يفضل مفتوح عشان تضيف مجموعة تانية تحت نفس الأب.' : undefined}
        saveText={modalMode === 'create' ? 'حفظ وإضافة آخر' : 'حفظ'}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={() => void handleSaveGroup()}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CompactFormField
            label="اسم المجموعة"
            required
            value={arabicName}
            onChange={(e) => setArabicName(e.target.value)}
          />
          <CompactFormField
            label="الاسم الإنجليزي"
            value={englishName}
            onChange={(e) => setEnglishName(e.target.value)}
          />
          <CompactFormField label="المجموعة الرئيسية" className="sm:col-span-2">
            <ItemGroupSelect
              value={parentId}
              onChange={setParentId}
              groups={groups}
              excludeIds={editId ? [editId] : undefined}
            />
          </CompactFormField>
        </div>
      </GuideEntityModal>
    </ErpDocumentLayout>
  );
}
