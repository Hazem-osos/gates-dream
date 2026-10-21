'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { MasterGuideTree } from '@/components/accounting/guide/MasterGuideTree';
import { GuideEntityModal } from '@/components/accounting/guide/GuideEntityModal';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { WorkItemKindDialog } from '@/components/contracting/WorkItemKindDialog';
import { WorkItemCatalogExcelModal } from '@/components/contracting/WorkItemCatalogExcelModal';
import { downloadWorkItemCatalogTemplate } from '@/lib/contracting/work-item-catalog-excel';
import { buildParentTree, type GuideTreeNode } from '@/lib/accounting/buildGuideTree';
import { FilterToolbar, Button, CompactFormField } from '@/components/ui';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useItemsQuery, type ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import { bumpTrailingCode } from '@/lib/masters/nextNumericSerial';
import {
  BOQ_UNITS,
  CATALOG_KIND_AR,
  allowedWorkItemKindsForParent,
  normalizeWorkItemCatalogKind,
  isTenderHeaderKind,
  type WorkItemCatalogKindUi,
} from '@/components/contracting/tender/tender-labels';

type CatalogRow = {
  id: string;
  parentId?: string | null;
  itemCode: string;
  descriptionAr: string;
  descriptionEn?: string | null;
  unit: string;
  kind: string;
  groupName?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  notes?: string | null;
};

type FormState = {
  itemCode: string;
  descriptionAr: string;
  descriptionEn: string;
  unit: string;
  kind: string;
  quantity: string;
  unitPrice: string;
  notes: string;
  parentId: string;
};

const emptyForm = (): FormState => ({
  itemCode: '',
  descriptionAr: '',
  descriptionEn: '',
  unit: 'ITEM',
  kind: 'SEASON',
  quantity: '',
  unitPrice: '',
  notes: '',
  parentId: '',
});

function kindLabel(kind: string): string {
  return CATALOG_KIND_AR[kind] ?? kind;
}

function catalogKindForSave(kind: string): WorkItemCatalogKindUi {
  return normalizeWorkItemCatalogKind(kind);
}

function toBoqUnit(raw?: string | null): (typeof BOQ_UNITS)[number] {
  const key = (raw ?? '').trim().toUpperCase();
  return (BOQ_UNITS as readonly string[]).includes(key) ? (key as (typeof BOQ_UNITS)[number]) : 'ITEM';
}

function itemUnitName(item: ItemOption): string | null {
  const base = item.units?.find((u) => u.isBaseUnit) ?? item.units?.[0];
  return base?.unit?.code || base?.unit?.arabicName || null;
}

function itemSalePrice(item: ItemOption): number {
  if (typeof item.salesPrice === 'number') return item.salesPrice;
  if (item.itemPrices?.length) {
    const def = item.itemPrices.find((p) => p.priceList?.isDefault) ?? item.itemPrices[0];
    if (def?.price != null) return Number(def.price) || 0;
  }
  return 0;
}

function qtyText(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? String(value) : '';
}

export default function WorkItemCatalogPage() {
  const invalidate = useInvalidateQuery();
  const key = ['contracting-item-catalog'];
  const { data, isLoading, refetch } = useApiQuery<CatalogRow[]>(key, '/contracting/item-catalog', undefined, {
    staleTime: 15_000,
  });

  const rows = data?.data ?? [];
  const [search, setSearch] = useState('');
  const [expandToken, setExpandToken] = useState(0);
  const [collapseToken, setCollapseToken] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [kindPicker, setKindPicker] = useState<{
    parentId: string;
    parentLabel: string;
    parentKind?: string | null;
  } | null>(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [pickedItemIds, setPickedItemIds] = useState<string[]>([]);
  const [importingItems, setImportingItems] = useState(false);

  const itemsQ = useItemsQuery(400, itemSearch, { isActive: true });
  const inventoryItems = itemsQ.data?.data ?? [];

  const { data: nextCodeResponse } = useApiQuery<{ itemCode?: string }>(
    ['contracting-item-catalog', 'next-code', form.parentId || 'root'],
    '/contracting/item-catalog/next-code',
    form.parentId ? { parentId: form.parentId } : undefined,
    { enabled: modalOpen && modalMode === 'create' }
  );

  useEffect(() => {
    if (!modalOpen || modalMode !== 'create') return;
    const suggested = nextCodeResponse?.data?.itemCode;
    if (!suggested) return;
    setForm((f) => (f.itemCode === suggested ? f : { ...f, itemCode: suggested }));
  }, [modalOpen, modalMode, nextCodeResponse?.data?.itemCode]);

  const tree = useMemo(
    () =>
      buildParentTree(rows, (item, children) => {
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
    [rows]
  );

  const parentLabel = useMemo(() => {
    if (!form.parentId) return 'جذر الدليل';
    const parent = rows.find((r) => r.id === form.parentId);
    return parent ? `${parent.itemCode} — ${parent.descriptionAr}` : '—';
  }, [form.parentId, rows]);

  const editableKinds = useMemo(() => {
    const parent = form.parentId ? rows.find((r) => r.id === form.parentId) : null;
    return allowedWorkItemKindsForParent(parent?.kind ?? null);
  }, [form.parentId, rows]);

  const openCreateRoot = () => {
    setKindPicker({ parentId: '', parentLabel: 'جذر الدليل', parentKind: null });
  };

  const openCreateChild = (parent?: GuideTreeNode) => {
    if (!parent || parent.synthetic) {
      openCreateRoot();
      return;
    }
    if (!parent.folder) {
      toast.error('البند التنفيذي لا يُفرَّع منه', {
        description: 'أضف البنود التنفيذية تحت بند رئيسي.',
      });
      return;
    }
    const parentRow = rows.find((r) => r.id === parent.id);
    setKindPicker({
      parentId: parent.id,
      parentLabel: `${parent.code} — ${parent.name}`,
      parentKind: parentRow?.kind ?? null,
    });
  };

  const kindPickerOptions = useMemo(
    () => (kindPicker ? allowedWorkItemKindsForParent(kindPicker.parentKind) : []),
    [kindPicker]
  );

  const onPickKind = (kind: WorkItemCatalogKindUi) => {
    const parentId = kindPicker?.parentId ?? '';
    setKindPicker(null);
    setModalMode('create');
    setEditId(null);
    setForm({
      ...emptyForm(),
      parentId,
      kind,
      unit: kind === 'EXECUTABLE' ? 'M2' : 'ITEM',
    });
    setModalOpen(true);
  };

  const openEdit = (node: GuideTreeNode) => {
    const row = rows.find((r) => r.id === node.id);
    if (!row) return;
    setModalMode('edit');
    setEditId(row.id);
    setForm({
      itemCode: row.itemCode,
      descriptionAr: row.descriptionAr,
      descriptionEn: row.descriptionEn ?? '',
      unit: row.unit,
      kind: catalogKindForSave(row.kind),
      quantity: qtyText(row.quantity),
      unitPrice: qtyText(row.unitPrice),
      notes: row.notes ?? '',
      parentId: row.parentId ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.descriptionAr.trim()) {
      toast.error('أدخل بيان البند');
      return;
    }
    if (!form.itemCode.trim()) {
      toast.error('أدخل كود البند');
      return;
    }
    setSaving(true);
    try {
      const body = {
        itemCode: form.itemCode.trim(),
        descriptionAr: form.descriptionAr.trim(),
        descriptionEn: form.descriptionEn.trim() || undefined,
        unit: form.unit,
        kind: catalogKindForSave(form.kind),
        quantity: form.quantity.trim() ? Number(form.quantity) : 0,
        unitPrice: form.unitPrice.trim() ? Number(form.unitPrice) : 0,
        notes: form.notes.trim() || undefined,
        parentId: form.parentId || undefined,
      };
      if (modalMode === 'edit' && editId) {
        await apiClient.patch(`/contracting/item-catalog/${editId}`, body);
        toast.success('تم حفظ البند');
        invalidate(key);
        void refetch();
        setModalOpen(false);
        return;
      }
      await apiClient.post('/contracting/item-catalog', body);
      toast.success('تم إضافة البند — يمكنك إضافة التالي');
      const parentId = form.parentId;
      const kind = form.kind;
      setForm({
        ...emptyForm(),
        parentId,
        kind,
        itemCode: bumpTrailingCode(form.itemCode),
        unit: form.unit,
      });
      invalidate(key);
      invalidate(['contracting-item-catalog', 'next-code']);
      void refetch();
    } catch (e) {
      toast.error('تعذّر حفظ البند', {
        description: e instanceof Error ? e.message : 'راجع الكود والبند الأب.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (node: GuideTreeNode) => {
    if (!(await confirmAction(`إيقاف البند ${node.code} — ${node.name} من الدليل؟`))) return;
    try {
      await apiClient.delete(`/contracting/item-catalog/${node.id}`);
      toast.success('تم إيقاف البند');
      invalidate(key);
      void refetch();
    } catch (e) {
      toast.error('تعذّر إيقاف البند', {
        description: e instanceof Error ? e.message : 'تحقق من وجود بنود فرعية نشطة.',
      });
    }
  };

  const importPickedItems = async () => {
    const selected = inventoryItems.filter((item) => pickedItemIds.includes(item.id));
    if (!selected.length) {
      toast.error('اختر صنفاً واحداً على الأقل');
      return;
    }
    setImportingItems(true);
    let added = 0;
    let skipped = 0;
    try {
      for (const item of selected) {
        const itemCode = (item.code || item.serial || '').trim();
        if (!itemCode) {
          skipped += 1;
          continue;
        }
        try {
          await apiClient.post('/contracting/item-catalog', {
            itemCode,
            descriptionAr: item.arabicName,
            unit: toBoqUnit(itemUnitName(item)),
            kind: 'EXECUTABLE',
            quantity: 1,
            unitPrice: itemSalePrice(item),
          });
          added += 1;
        } catch {
          skipped += 1;
        }
      }
      if (added) toast.success(`تم إضافة ${added} بنداً من دليل الأصناف`);
      if (skipped) toast.error(`تعذّر إضافة ${skipped} صنفاً — الكود مكرر أو ناقص`);
      invalidate(key);
      invalidate(['contracting-item-catalog', 'next-code']);
      void refetch();
      setItemsOpen(false);
      setPickedItemIds([]);
      setItemSearch('');
    } finally {
      setImportingItems(false);
    }
  };

  const isEmpty = !isLoading && rows.length === 0;
  const addButtons = (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={openCreateRoot}>
        + إضافة بند
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => setItemsOpen(true)}>
        الأصناف
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          downloadWorkItemCatalogTemplate().catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : 'تعذر تنزيل القالب')
          );
        }}
      >
        تنزيل القالب
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => setExcelOpen(true)}>
        استيراد Excel
      </Button>
    </>
  );

  return (
    <ExtractsPageChrome
      title="دليل بنود الأعمال"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { label: 'دليل بنود الأعمال' },
      ]}
      favoriteHref="/contracting/catalog/work-items"
      hideSave
    >
      <p className="mb-3 text-sm text-slate-600">
        ثلاثة أنواع فقط: رئيسي، رئيسي فرعي، وتنفيذي. الكود النقطي (مثل 1 و 1.1 و 1.1.2) يربط الأب تلقائياً.
      </p>

      {isEmpty ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
          <Layers className="mx-auto mb-3 h-8 w-8 text-[#0E78AA]" />
          <p className="text-lg font-semibold text-slate-800">لا توجد بنود في الدليل بعد</p>
          <p className="mt-1 text-sm text-slate-500">أضف بنداً رئيسياً ثم فرعياً أو تنفيذياً، أو انقل أصنافاً من دليل الأصناف.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">{addButtons}</div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {addButtons}
            <FilterToolbar
              className="min-w-0 flex-1"
              searchPlaceholder="بحث بالكود أو البيان…"
              onSearchChange={setSearch}
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
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
                childNoun="بنود فرعية"
                onAddChild={openCreateChild}
                canAddChild={(n) => Boolean(n.folder)}
                onView={openEdit}
                onEdit={openEdit}
                onDelete={(n) => void handleDeactivate(n)}
              />
            )}
          </div>
        </>
      )}

      <WorkItemCatalogExcelModal
        open={excelOpen}
        onClose={() => setExcelOpen(false)}
        onImported={() => {
          invalidate(key);
          invalidate(['contracting-item-catalog', 'next-code']);
          void refetch();
        }}
      />

      <WorkItemKindDialog
        open={Boolean(kindPicker)}
        parentLabel={kindPicker?.parentLabel ?? 'جذر الدليل'}
        options={kindPickerOptions}
        onClose={() => setKindPicker(null)}
        onPick={onPickKind}
      />

      <GuideEntityModal
        open={modalOpen}
        title={modalMode === 'edit' ? 'تعديل بند' : `إضافة ${kindLabel(form.kind)}`}
        subtitle={`البند الأب: ${parentLabel}`}
        hint="الرموز النقطية (1.1.2) تربط الشجرة تلقائياً إذا وُجد الأب في الدليل."
        saving={saving}
        saveText={modalMode === 'edit' ? 'حفظ' : 'إضافة'}
        onClose={() => setModalOpen(false)}
        onSave={() => void handleSave()}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <CompactFormField label="الكود">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.itemCode}
              onChange={(e) => setForm({ ...form, itemCode: e.target.value })}
              placeholder="1 / 1.1 / 1.1.1"
            />
          </CompactFormField>
          <CompactFormField label="النوع">
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={catalogKindForSave(form.kind)}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              {editableKinds.map((k) => (
                <option key={k} value={k}>{CATALOG_KIND_AR[k]}</option>
              ))}
            </select>
          </CompactFormField>
          <CompactFormField label="البيان (عربي)" className="sm:col-span-2">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.descriptionAr}
              onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
            />
          </CompactFormField>
          <CompactFormField label="البيان (إنجليزي)" className="sm:col-span-2">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.descriptionEn}
              onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
            />
          </CompactFormField>
          <CompactFormField label="الوحدة">
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              {BOQ_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </CompactFormField>
          <CompactFormField label="الكمية">
            <input
              type="number"
              min="0"
              step="0.0001"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </CompactFormField>
          <CompactFormField label="السعر">
            <input
              type="number"
              min="0"
              step="0.0001"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
            />
          </CompactFormField>
          <CompactFormField label="ملاحظات" className="sm:col-span-2">
            <textarea
              className="min-h-[72px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </CompactFormField>
        </div>
      </GuideEntityModal>

      <CenteredOverlay
        open={itemsOpen}
        onClose={() => {
          if (importingItems) return;
          setItemsOpen(false);
        }}
        width="lg"
        labelledBy="work-item-inventory-title"
      >
        <div className="flex max-h-[85vh] flex-col p-6" dir="rtl">
          <h2 id="work-item-inventory-title" className="text-lg font-bold text-[#0E78AA]">
            دليل الأصناف
          </h2>
          <p className="mt-1 text-sm text-slate-500">اختر أصنافاً لتنزل في دليل بنود الأعمال كبنود تنفيذية.</p>
          <div className="mt-3">
            <FilterToolbar
              searchPlaceholder="بحث في الأصناف…"
              onSearchChange={setItemSearch}
            />
          </div>
          <div className="mt-3 max-h-[50vh] overflow-auto rounded-xl border border-[#E8F1F6] text-sm">
            {itemsQ.isLoading ? (
              <p className="p-3 text-slate-500">جاري تحميل الأصناف…</p>
            ) : inventoryItems.length ? (
              inventoryItems.map((item) => (
                <label key={item.id} className="flex items-center gap-2 border-b border-[#E8F1F6] px-3 py-2">
                  <input
                    type="checkbox"
                    checked={pickedItemIds.includes(item.id)}
                    onChange={(e) =>
                      setPickedItemIds((prev) =>
                        e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                      )
                    }
                  />
                  <span className="font-mono text-xs">{item.code || item.serial || '—'}</span>
                  <span className="flex-1">{item.arabicName}</span>
                  <span className="text-slate-500">{itemSalePrice(item) || '—'}</span>
                </label>
              ))
            ) : (
              <p className="p-3 text-slate-500">لا توجد أصناف مطابقة.</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" disabled={importingItems} onClick={() => setItemsOpen(false)}>
              إلغاء
            </Button>
            <Button type="button" disabled={!pickedItemIds.length || importingItems} onClick={() => void importPickedItems()}>
              {importingItems ? 'جاري الإضافة…' : `إضافة المحدد (${pickedItemIds.length})`}
            </Button>
          </div>
        </div>
      </CenteredOverlay>
    </ExtractsPageChrome>
  );
}
