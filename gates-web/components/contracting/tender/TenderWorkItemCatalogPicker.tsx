'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { MasterGuideTree } from '@/components/accounting/guide/MasterGuideTree';
import { GuideEntityModal } from '@/components/accounting/guide/GuideEntityModal';
import { FilterToolbar } from '@/components/ui';
import { buildParentTree, type GuideTreeNode } from '@/lib/accounting/buildGuideTree';
import { useApiQuery } from '@/lib/hooks/useApi';
import { toast } from '@/lib/feedback/toast';
import { resolveTenderCatalogPickerIds } from '@/lib/contracting/tender-catalog-picker';
import { CATALOG_KIND_AR, isTenderHeaderKind } from './tender-labels';

type CatalogRow = {
  id: string;
  parentId?: string | null;
  itemCode: string;
  descriptionAr: string;
  unit: string;
  kind: string;
  notes?: string | null;
};

export function TenderWorkItemCatalogPicker({
  open,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (catalogIds: string[]) => void;
}) {
  const { data, isLoading } = useApiQuery<CatalogRow[]>(
    ['contracting-item-catalog'],
    '/contracting/item-catalog',
    undefined,
    { enabled: open, staleTime: 15_000 }
  );
  const rows = data?.data ?? [];
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const headerRows = useMemo(
    () => rows.filter((row) => isTenderHeaderKind(row.kind)),
    [rows]
  );

  const tree = useMemo(
    () =>
      buildParentTree(headerRows, (item, children) => ({
        id: item.id,
        code: item.itemCode,
        name: item.descriptionAr,
        subtitle: CATALOG_KIND_AR[item.kind] ?? item.kind,
        folder: children.length > 0,
        children,
      })),
    [headerRows]
  );

  const toggleSelect = (node: GuideTreeNode) => {
    setSelectedIds((prev) =>
      prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id]
    );
  };

  const handleSave = () => {
    const catalogIds = resolveTenderCatalogPickerIds(rows, selectedIds);
    if (!catalogIds.length) {
      toast.error('علّم بنداً واحداً على الأقل');
      return;
    }
    onConfirm(catalogIds);
  };

  const handleClose = () => {
    setSelectedIds([]);
    setSearch('');
    onClose();
  };

  return (
    <GuideEntityModal
      open={open}
      title="بنود الأعمال"
      subtitle="البنود الرئيسية فقط. علّم أكثر من بند ثم أضفهم للجدول."
      hint="تعليم بند في أول مستوى يضيفه مع كل ما تحته. تعليم بند أعمق يضيفه وحده."
      saveText={saving ? 'جاري الإضافة…' : 'إضافة إلى الجدول'}
      saving={saving}
      onClose={handleClose}
      onSave={handleSave}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterToolbar
          className="min-w-0 flex-1"
          searchPlaceholder="بحث بالكود أو البيان…"
          onSearchChange={setSearch}
        />
        <Link className="text-xs text-[#0E78AA] underline" href="/contracting/catalog/work-items">
          فتح الدليل
        </Link>
      </div>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-slate-500">جاري تحميل الدليل…</p>
      ) : !headerRows.length ? (
        <p className="py-8 text-center text-sm text-slate-500">
          لا توجد بنود رئيسية في الدليل — أضف مواسم وفصولاً من دليل بنود الأعمال.
        </p>
      ) : (
        <MasterGuideTree
          nodes={tree}
          search={search}
          startCollapsed
          selectable
          selectedIds={new Set(selectedIds)}
          onToggleSelect={toggleSelect}
          childNoun="بنود فرعية"
        />
      )}
    </GuideEntityModal>
  );
}
