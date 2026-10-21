'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GitBranch, ListTree } from 'lucide-react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { MasterGuideTree } from '@/components/accounting/guide/MasterGuideTree';
import { buildParentTree, type GuideTreeNode } from '@/lib/accounting/buildGuideTree';
import {
  AppTable,
  CompactFormField,
  FilterToolbar,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { Button } from '@/components/ui/button';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import {
  canEnterBoqLineQuantity,
  isParentIdTreeRowVisible,
  parentIdsWithChildren,
  withItemCodeHierarchy,
  workItemHierarchyHints,
} from '@/lib/contracting/boq-hierarchy';
import { BoqHierarchyTreeCell } from '@/components/contracting/BoqHierarchyTreeCell';
import { CATALOG_KIND_AR, isTenderHeaderKind } from '@/components/contracting/tender/tender-labels';
import { formatEgp, formatPercent, formatQty, toMoney } from '@/lib/subcontracts/money';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import ErrorToast from '@/components/ErrorToast';
import type { ApiError } from '@/lib/api/types';

type ProjectOption = { id: string; arabicName?: string; serial?: string };

type CatalogRow = {
  id: string;
  parentId?: string | null;
  itemCode: string;
  descriptionAr: string;
  descriptionEn?: string | null;
  unit: string;
  kind: string;
  groupName?: string | null;
};

type WorkItemRow = {
  id: string;
  projectId?: string;
  parentId?: string | null;
  isExecutable?: boolean;
  _count?: { children?: number };
  itemNumber: string;
  itemGroupName?: string | null;
  itemGroupCode?: string | null;
  arabicName: string;
  englishName?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unitPrice?: number | string | null;
  totalPrice?: number | string | null;
};

type LineEdit = { quantity?: string; unitPrice?: string };

const UNIT_AR: Record<string, string> = {
  M2: 'م2',
  M3: 'م3',
  TON: 'طن',
  ITEM: 'عدد',
  LM: 'م.ط',
  LS: 'مقطوعية',
};

function catalogUnitLabel(unit?: string | null): string {
  const key = String(unit ?? '').trim();
  return UNIT_AR[key] ?? key;
}

function kindLabel(kind: string): string {
  return CATALOG_KIND_AR[kind] ?? kind;
}

function uniqueItemNumber(catalogCode: string, parentNumber: string, taken: Set<string>): string {
  if (!taken.has(catalogCode)) return catalogCode;
  const prefixed = `${parentNumber}.${catalogCode}`;
  if (!taken.has(prefixed)) return prefixed;
  let n = 2;
  while (taken.has(`${prefixed}-${n}`)) n += 1;
  return `${prefixed}-${n}`;
}

export default function ExecutionPlanDistributionPage() {
  useBackendReachability();
  const searchParams = useSearchParams();
  const invalidateQuery = useInvalidateQuery();
  const [projectId, setProjectId] = useState(() => searchParams.get('projectId') ?? '');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [expandToken, setExpandToken] = useState(0);
  const [collapseToken, setCollapseToken] = useState(0);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, LineEdit>>({});
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState('');

  const { data: projectsRes } = useApiQuery<ProjectOption[]>(
    ['extracts-projects', 'execution-plan-distribution'],
    '/extracts/projects',
    { limit: 500, isActive: true }
  );
  const projects = projectsRes?.data ?? [];

  const { data: catalogRes, isLoading: catalogLoading } = useApiQuery<CatalogRow[]>(
    ['contracting-item-catalog', 'execution-plan-distribution'],
    '/contracting/item-catalog',
    undefined,
    { staleTime: 15_000 }
  );
  const catalogRows = catalogRes?.data ?? [];

  const workItemsKey = ['extract-work-items', 'execution-plan-distribution', projectId];
  const { data: itemsResponse, isLoading } = useApiQuery<WorkItemRow[]>(
    workItemsKey,
    '/extracts/work-items',
    { limit: 1000, projectId: projectId || undefined },
    { enabled: Boolean(projectId) }
  );
  const tableData = itemsResponse?.data ?? [];

  const catalogById = useMemo(() => {
    const map = new Map<string, CatalogRow>();
    for (const row of catalogRows) map.set(row.id, row);
    return map;
  }, [catalogRows]);

  const catalogTree = useMemo(
    () =>
      buildParentTree(catalogRows, (item, children) => {
        const folder = isTenderHeaderKind(item.kind) || children.length > 0;
        return {
          id: item.id,
          code: item.itemCode,
          name: item.descriptionAr,
          subtitle: kindLabel(item.kind),
          folder,
          children,
        };
      }),
    [catalogRows]
  );

  const hierarchical = useMemo(
    () => withItemCodeHierarchy(tableData, (row) => row.itemNumber || '', workItemHierarchyHints),
    [tableData]
  );

  const workItemById = useMemo(() => {
    const map = new Map<string, WorkItemRow>();
    for (const row of tableData) map.set(row.id, row);
    return map;
  }, [tableData]);

  const parentIdsWithKids = useMemo(() => parentIdsWithChildren(tableData), [tableData]);

  const visibleHierarchical = useMemo(
    () =>
      hierarchical.filter((row) =>
        isParentIdTreeRowVisible(row, expandedParentIds, workItemById)
      ),
    [hierarchical, expandedParentIds, workItemById]
  );

  const toggleParentExpand = (id: string) => {
    setExpandedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAllParents = () => setExpandedParentIds(new Set(parentIdsWithKids));
  const collapseAllParents = () => setExpandedParentIds(new Set());

  useEffect(() => {
    const roots = new Set<string>();
    for (const row of tableData) {
      if (!row.parentId && parentIdsWithChildren(tableData).has(row.id)) roots.add(row.id);
    }
    setExpandedParentIds(roots);
  }, [projectId, tableData]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, WorkItemRow[]>();
    for (const row of tableData) {
      if (!row.parentId) continue;
      const list = map.get(row.parentId) ?? [];
      list.push(row);
      map.set(row.parentId, list);
    }
    return map;
  }, [tableData]);

  const lineQty = (row: WorkItemRow) => {
    const edited = edits[row.id]?.quantity;
    return toMoney(edited ?? row.quantity);
  };
  const linePrice = (row: WorkItemRow) => {
    const edited = edits[row.id]?.unitPrice;
    return toMoney(edited ?? row.unitPrice);
  };
  const lineTotal = (row: WorkItemRow) => round4(lineQty(row) * linePrice(row));

  const parentRollup = useMemo(() => {
    const map = new Map<string, { qty: number; cost: number }>();
    for (const [parentId, kids] of childrenByParent) {
      let qty = 0;
      let cost = 0;
      for (const kid of kids) {
        qty += lineQty(kid);
        cost += lineTotal(kid);
      }
      map.set(parentId, { qty: round4(qty), cost: round4(cost) });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- edits change qty/price
  }, [childrenByParent, edits, tableData]);

  const selectedCatalog = selectedCatalogId ? catalogById.get(selectedCatalogId) ?? null : null;
  const selectedWorkItem = tableData.find((row) => row.id === selectedWorkItemId) ?? null;
  const insertParent = (() => {
    if (!selectedWorkItem) return null;
    const hasChildren = (childrenByParent.get(selectedWorkItem.id)?.length ?? 0) > 0;
    if (selectedWorkItem.isExecutable === false || hasChildren) return selectedWorkItem;
    if (selectedWorkItem.parentId) {
      return tableData.find((row) => row.id === selectedWorkItem.parentId) ?? selectedWorkItem;
    }
    return selectedWorkItem;
  })();

  const dirtyIds = Object.keys(edits);
  const executableTotal = visibleHierarchical
    .filter((row) => canEnterBoqLineQuantity(row.__isParent))
    .reduce((sum, row) => sum + lineTotal(row), 0);

  const refreshItems = () => {
    invalidateQuery(workItemsKey);
  };

  const createMutation = useApiMutation<WorkItemRow, Record<string, unknown>>(
    '/extracts/work-items',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        toast.success('تم إدخال البند على المخطط');
        setEdits({});
        if (res?.data?.id) setSelectedWorkItemId(res.data.id);
        refreshItems();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إدخال البند'),
    }
  );

  const handleInsert = () => {
    setError('');
    if (!projectId) {
      setError('اختر مشروعاً أولاً');
      return;
    }
    if (!selectedCatalog) {
      setError('اختر بنداً تنفيذياً من دليل بنود الأعمال');
      return;
    }
    if (isTenderHeaderKind(selectedCatalog.kind)) {
      setError('لا يمكن إدخال بند عام من الدليل — اختر بنداً تنفيذياً');
      return;
    }
    if (!insertParent) {
      setError('اختر بنداً عاماً في الجدول لإدخال التوزيع تحته');
      return;
    }
    const taken = new Set(tableData.map((row) => row.itemNumber));
    createMutation.mutate({
      projectId,
      parentId: insertParent.id,
      isExecutable: true,
      itemNumber: uniqueItemNumber(selectedCatalog.itemCode, insertParent.itemNumber, taken),
      itemGroupCode: insertParent.itemGroupCode || insertParent.itemNumber,
      itemGroupName: insertParent.itemGroupName || insertParent.arabicName,
      arabicName: selectedCatalog.descriptionAr,
      englishName: selectedCatalog.descriptionEn || undefined,
      quantity: 1,
      unit: catalogUnitLabel(selectedCatalog.unit),
      unitPrice: 0,
    });
  };

  const handleSaveEdits = async () => {
    setError('');
    if (dirtyIds.length === 0) {
      toast.success('لا توجد تعديلات للحفظ');
      return;
    }
    try {
      for (const id of dirtyIds) {
        const row = tableData.find((item) => item.id === id);
        if (!row) continue;
        await apiClient.put(`/extracts/work-items/${id}`, {
          quantity: lineQty(row),
          unitPrice: linePrice(row),
        });
      }
      setEdits({});
      refreshItems();
      toast.success('تم حفظ كميات وتكاليف التوزيع');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التوزيع');
    }
  };

  const handleDelete = async () => {
    if (!selectedWorkItem || (childrenByParent.get(selectedWorkItem.id)?.length ?? 0) > 0) {
      setError('اختر بند توزيع فرعي للحذف');
      return;
    }
    const ok = await confirmAction({
      title: 'حذف بند التوزيع',
      message: `حذف «${selectedWorkItem.arabicName}» من مخطط المشروع؟`,
      confirmLabel: 'حذف',
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/extracts/work-items/${selectedWorkItem.id}`);
      setSelectedWorkItemId(insertParent?.id ?? null);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[selectedWorkItem.id];
        return next;
      });
      refreshItems();
      toast.success('تم حذف البند');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف البند');
    }
  };

  const resetLocal = () => {
    setSelectedCatalogId(null);
    setSelectedWorkItemId(null);
    setEdits({});
    setError('');
  };

  return (
    <ExtractsPageChrome
      title="توزيع مخطط التنفيذ"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'توزيع مخطط التنفيذ' },
      ]}
      onSave={() => void handleSaveEdits()}
      savePending={false}
      canSave={Boolean(projectId)}
      saveLabel="حفظ التوزيع"
      onNew={resetLocal}
      extraActions={
        <>
          <Button
            type="button"
            size="sm"
            disabled={!projectId || createMutation.isPending}
            onClick={handleInsert}
          >
            إدخال من الدليل
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void handleDelete()}>
            حذف
          </Button>
        </>
      }
      statusLabel={dirtyIds.length ? 'تعديل' : 'عرض'}
      favoriteHref="/extracts/operations/execution-plan-distribution"
      browseList={{
        title: 'بنود المشروع',
        apiPath: '/extracts/work-items',
        listKey: 'execution-plan-distribution-browse',
        extraParams: projectId ? { projectId } : undefined,
        columns: [
          { id: 'code', header: 'الكود', getValue: (r) => String(r.itemNumber || r.id) },
          { id: 'name', header: 'البند', getValue: (r) => String(r.arabicName || '—') },
        ],
        onSelect: (id) => setSelectedWorkItemId(id),
      }}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}

      <FormSectionCard
        title="المشروع"
        subtitle="اختر بنداً تنفيذياً من الدليل، ثم بنداً عاماً في الجدول، ثم إدخال"
        icon={GitBranch}
      >
        <CompactFormField label="المشروع" required>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              resetLocal();
            }}
            className={compactControlClass}
          >
            <option value="">— اختر مشروعاً —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.arabicName || p.serial || p.id}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField
          label="من الدليل"
          readOnly
          value={
            selectedCatalog
              ? `${selectedCatalog.itemCode} — ${selectedCatalog.descriptionAr}`
              : '—'
          }
        />
        <CompactFormField
          label="تحت البند العام"
          readOnly
          value={insertParent ? `${insertParent.itemNumber} — ${insertParent.arabicName}` : '—'}
        />
        <CompactFormField label="إجمالي التوزيع" readOnly value={formatEgp(executableTotal)} />
      </FormSectionCard>

      <div className="mb-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <FormSectionCard title="دليل بنود الأعمال" icon={ListTree} bodyClassName="grid-cols-1">
          <FilterToolbar searchPlaceholder="بحث في الدليل…" onSearchChange={setCatalogSearch} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setExpandToken((t) => t + 1)}>
              توسيع
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCollapseToken((t) => t + 1)}>
              طي
            </Button>
          </div>
          {catalogLoading ? (
            <p className="text-sm text-slate-500">جاري تحميل الدليل…</p>
          ) : (
            <MasterGuideTree
              nodes={catalogTree}
              search={catalogSearch}
              expandAllToken={expandToken}
              collapseAllToken={collapseToken}
              revealId={selectedCatalogId}
              childNoun="بنود"
              selectedIds={selectedCatalogId ? new Set([selectedCatalogId]) : undefined}
              onView={(node: GuideTreeNode) => {
                if (node.folder) return;
                setSelectedCatalogId(node.id);
              }}
            />
          )}
        </FormSectionCard>

        <FormSectionCard title="بنود المخطط" subtitle="الصفوف العامة من المقايسة، والفرعية من الدليل" bodyClassName="grid-cols-1">
          {!projectId ? (
            <p className="text-sm text-slate-500">اختر مشروعاً لعرض التوزيع.</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={expandAllParents}>
                  توسيع الشجرة
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={collapseAllParents}>
                  طي الشجرة
                </Button>
              </div>
            <AppTable
              columns={[
                {
                  id: 'code',
                  header: 'الكود',
                  cell: (row) => (
                    <BoqHierarchyTreeCell
                      code={row.itemNumber}
                      depth={row.__depth}
                      isParent={row.__isParent}
                      hasChildren={parentIdsWithKids.has(row.id)}
                      expanded={expandedParentIds.has(row.id)}
                      onToggleExpand={() => toggleParentExpand(row.id)}
                    />
                  ),
                },
                { id: 'name', header: 'البند', accessor: 'arabicName' },
                {
                  id: 'unit',
                  header: 'الوحدة',
                  cell: (row) => row.unit || '—',
                },
                {
                  id: 'qty',
                  header: 'الكمية',
                  numeric: true,
                  cell: (row) =>
                    !canEnterBoqLineQuantity(row.__isParent) ? (
                      formatQty(parentRollup.get(row.id)?.qty)
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step="0.0001"
                        className={compactControlClass}
                        value={edits[row.id]?.quantity ?? String(row.quantity ?? '')}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], quantity: e.target.value },
                          }))
                        }
                      />
                    ),
                },
                {
                  id: 'price',
                  header: 'الفئة',
                  numeric: true,
                  cell: (row) =>
                    !canEnterBoqLineQuantity(row.__isParent) ? (
                      '—'
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={compactControlClass}
                        value={edits[row.id]?.unitPrice ?? (row.unitPrice != null ? String(row.unitPrice) : '')}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], unitPrice: e.target.value },
                          }))
                        }
                      />
                    ),
                },
                {
                  id: 'cost',
                  header: 'إجمالي التكلفة',
                  numeric: true,
                  cell: (row) =>
                    !canEnterBoqLineQuantity(row.__isParent)
                      ? formatEgp(parentRollup.get(row.id)?.cost)
                      : formatEgp(lineTotal(row)),
                },
                {
                  id: 'distQty',
                  header: 'كمية التوزيع',
                  numeric: true,
                  cell: (row) =>
                    !canEnterBoqLineQuantity(row.__isParent)
                      ? formatQty(parentRollup.get(row.id)?.qty)
                      : formatQty(lineQty(row)),
                },
                {
                  id: 'distCost',
                  header: 'تكلفة التوزيع',
                  numeric: true,
                  cell: (row) =>
                    !canEnterBoqLineQuantity(row.__isParent)
                      ? formatEgp(parentRollup.get(row.id)?.cost)
                      : formatEgp(lineTotal(row)),
                },
                {
                  id: 'pct',
                  header: 'نسبة التوزيع',
                  numeric: true,
                  cell: (row) => {
                    if (!canEnterBoqLineQuantity(row.__isParent)) return '100%';
                    const parentCost = row.parentId ? parentRollup.get(row.parentId)?.cost ?? 0 : 0;
                    if (!(parentCost > 0)) return '—';
                    return formatPercent((lineTotal(row) / parentCost) * 100);
                  },
                },
              ]}
              data={visibleHierarchical}
              getRowKey={(row) => row.id}
              isLoading={isLoading}
              emptyTitle="لا توجد بنود على المشروع"
              emptyDescription="أضف البنود العامة من شاشة البنود العامة، ثم أدخل بنود الدليل تحتها."
              exportFileName="execution-plan-distribution"
              onRowClick={(row) => setSelectedWorkItemId(row.id)}
              rowClassName={(row) =>
                selectedWorkItemId === row.id
                  ? 'bg-amber-50'
                  : row.__isParent
                    ? 'bg-[#EEF6FA]'
                    : undefined
              }
            />
            </>
          )}
        </FormSectionCard>
      </div>
    </ExtractsPageChrome>
  );
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
