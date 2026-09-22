'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Warehouse } from 'lucide-react';
import { useAppTabs } from '@/app/components/AppTabsContext';
import { FilterToolbar, Button, CompactFormField } from '@/components/ui';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { MasterGuideTree } from '@/components/accounting/guide/MasterGuideTree';
import { GuideEntityModal } from '@/components/accounting/guide/GuideEntityModal';
import { buildParentTree, type GuideTreeNode } from '@/lib/accounting/buildGuideTree';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import { asWarehouseRows, type WarehouseRow } from '@/components/inventory/WarehousesListSection';
import { WarehouseParentField } from '@/components/inventory/WarehouseParentField';
import { AccountSelect } from '@/components/form/AccountSelect';
import {
  ChildWarehouseKindDialog,
  WarehouseKindLegend,
} from '@/components/inventory/ChildWarehouseKindDialog';
import { bumpTrailingCode, isCodeAfter } from '@/lib/masters/nextNumericSerial';
import { NumberingModeControl } from '@/components/accounting/NumberingModeControl';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import type { CoaNumberingMode } from '@/components/accounting/chart-of-accounts/CoaEmptyState';
import {
  inheritWarehouseAccounts,
  warehouseCanBranch,
  warehouseRoleLabel,
  type WarehouseKind,
} from '@/lib/inventory/warehouse-kind';

type FormState = {
  code: string;
  arabicName: string;
  englishName: string;
  parentId: string;
  warehouseKind: WarehouseKind;
  inventoryAccountId: string;
  costAccountId: string;
};

const emptyForm = (): FormState => ({
  code: '',
  arabicName: '',
  englishName: '',
  parentId: '',
  warehouseKind: 'HEADER',
  inventoryAccountId: '',
  costAccountId: '',
});

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function WarehouseGuidePage() {
  const invalidate = useInvalidateQuery();
  const router = useRouter();
  const tabs = useAppTabs();
  const { data: settingsRes } = useAccountingSettingsQuery();
  const warehouseAuto = settingsRes?.data?.general?.warehouseAutoNumbering !== false;
  const warehouseCount = settingsRes?.data?.general?.numberingRecordCounts?.warehouses ?? 0;
  const { data, isLoading, refetch } = useApiQuery<WarehouseRow[]>(
    ['warehouses', 'guide'],
    '/inventory/warehouses',
    { limit: 1000, isActive: true },
    { staleTime: 15_000 }
  );

  const rows = asWarehouseRows(data?.data).filter((row) => row.isActive !== false);
  const [search, setSearch] = useState('');
  const [expandToken, setExpandToken] = useState(0);
  const [collapseToken, setCollapseToken] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [kindPickerParent, setKindPickerParent] = useState<GuideTreeNode | null>(null);
  const [numberingMode, setNumberingMode] = useState<CoaNumberingMode>('auto');
  const autoNumbering = rows.length === 0 ? numberingMode !== 'manual' : warehouseAuto;

  const persistWarehouseNumbering = useCallback(async (auto: boolean) => {
    await apiClient.put(
      '/accounting/settings',
      { general: { warehouseAutoNumbering: auto } },
      { skipSuccessNotify: true }
    );
    invalidate(['accounting-settings']);
  }, [invalidate]);

  const { data: nextCodeResponse } = useApiQuery<{ code?: string }>(
    ['warehouses', 'next-code', form.parentId || 'root'],
    '/inventory/warehouses/next-code',
    form.parentId ? { parentWarehouseId: form.parentId } : undefined,
    { enabled: modalOpen && modalMode === 'create' && autoNumbering }
  );

  useEffect(() => {
    if (!modalOpen || modalMode !== 'create' || !autoNumbering) return;
    const suggested = nextCodeResponse?.data?.code;
    if (!suggested) return;
    setForm((current) => {
      if (current.code && isCodeAfter(current.code, suggested)) return current;
      return current.code === suggested ? current : { ...current, code: suggested };
    });
  }, [modalOpen, modalMode, autoNumbering, nextCodeResponse?.data?.code]);

  const tree = useMemo(
    () =>
      buildParentTree(
        rows.map((row) => ({ ...row, parentId: row.parentWarehouseId ?? null })),
        (item, children) => ({
          id: item.id,
          code: item.code || '',
          name: item.arabicName,
          subtitle: warehouseRoleLabel(item),
          folder: warehouseCanBranch(item.warehouseKind, item.parentWarehouseId) || children.length > 0,
          children,
        })
      ),
    [rows]
  );

  const parentLabel = useMemo(() => {
    if (!form.parentId) return 'المخزن الأب';
    const parent = rows.find((row) => row.id === form.parentId);
    return parent ? `${parent.code || '—'} — ${parent.arabicName}` : 'المخزن الأب';
  }, [form.parentId, rows]);

  const blockedParentIds = useMemo(() => {
    if (!editId) return [] as string[];
    const blocked = new Set<string>([editId]);
    const stack = [editId];
    while (stack.length) {
      const current = stack.pop()!;
      for (const row of rows) {
        if (row.parentWarehouseId === current && !blocked.has(row.id)) {
          blocked.add(row.id);
          stack.push(row.id);
        }
      }
    }
    return [...blocked];
  }, [editId, rows]);

  const applyParent = (parentId: string) => {
    const inherited = inheritWarehouseAccounts(rows, parentId);
    setForm((prev) => ({
      ...prev,
      parentId,
      warehouseKind: parentId ? prev.warehouseKind || 'POSTING' : prev.warehouseKind === 'POSTING' ? 'POSTING' : 'HEADER',
      inventoryAccountId: parentId ? inherited.inventoryAccountId : '',
      costAccountId: parentId ? inherited.costAccountId : '',
    }));
  };

  const openCreateRoot = () => {
    if (rows.length === 0) {
      void persistWarehouseNumbering(numberingMode !== 'manual').catch(() => undefined);
    }
    setModalMode('create');
    setEditId(null);
    setForm({ ...emptyForm(), warehouseKind: 'HEADER' });
    setModalOpen(true);
  };

  const openCreateChild = (parent?: GuideTreeNode) => {
    if (!parent || parent.synthetic) {
      openCreateRoot();
      return;
    }
    const row = rows.find((item) => item.id === parent.id);
    if (row && !warehouseCanBranch(row.warehouseKind, row.parentWarehouseId)) {
      toast.error('مخزن العمليات لا يُفرَّع منه', {
        description: 'اختَر مخزناً رئيسياً أو رئيسياً فرعياً، أو أنشئ العمليات تحت مجموعة أعلى.',
      });
      return;
    }
    setKindPickerParent(parent);
  };

  const openStockReport = (node: GuideTreeNode) => {
    if (node.synthetic) return;
    const today = todayIso();
    const qs = new URLSearchParams({
      warehouseId: node.id,
      fromDate: today,
      toDate: today,
    });
    const href = `/inventory/reports/inventory-reports/preview?${qs.toString()}`;
    if (tabs) {
      tabs.openAppTab(href);
      return;
    }
    router.push(href);
  };

  const openCreateUnder = (parent: GuideTreeNode, kind: WarehouseKind) => {
    setModalMode('create');
    setEditId(null);
    setForm({
      ...emptyForm(),
      parentId: parent.id,
      warehouseKind: kind,
      ...inheritWarehouseAccounts(rows, parent.id),
    });
    setModalOpen(true);
  };

  const openEdit = (node: GuideTreeNode) => {
    const row = rows.find((item) => item.id === node.id);
    if (!row) return;
    setModalMode('edit');
    setEditId(row.id);
    setForm({
      code: row.code ?? '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
      parentId: row.parentWarehouseId ?? '',
      warehouseKind:
        row.warehouseKind === 'POSTING'
          ? 'POSTING'
          : row.warehouseKind === 'HEADER' || !row.parentWarehouseId
            ? 'HEADER'
            : 'POSTING',
      inventoryAccountId: row.inventoryAccountId ?? '',
      costAccountId: row.costAccountId ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.arabicName.trim()) {
      toast.error('أدخل اسم المخزن');
      return;
    }
    if (!autoNumbering && modalMode === 'create' && !form.code.trim()) {
      toast.error('رقم المخزن مطلوب — الترقيم يدوي');
      return;
    }
    if (editId && form.parentId === editId) {
      toast.error('لا يمكن أن يكون المخزن أباً لنفسه');
      return;
    }
    setSaving(true);
    try {
      const body = {
        arabicName: form.arabicName.trim(),
        englishName: form.englishName.trim() || undefined,
        storeType: form.parentId ? 'SUB' : 'MAIN',
        parentWarehouseId: form.parentId || null,
        warehouseKind:
          form.parentId || modalMode === 'edit' ? form.warehouseKind : 'HEADER',
        inventoryAccountId: form.inventoryAccountId || null,
        costAccountId: form.costAccountId || null,
      };
      if (modalMode === 'edit' && editId) {
        await apiClient.put(`/inventory/warehouses/${editId}`, {
          ...body,
          code: form.code.trim() || undefined,
        });
        toast.success('تم حفظ المخزن');
        invalidate(['warehouses']);
        void refetch();
        setModalOpen(false);
        return;
      }
      const created = await apiClient.post<{ id?: string; code?: string }>('/inventory/warehouses', {
        ...body,
        ...(form.code.trim() ? { code: form.code.trim() } : {}),
      });
      const createdCode = created.data?.code ?? form.code;
      toast.success('تم حفظ المخزن — تقدر تضيف التالي');
      const parentId = form.parentId;
      const warehouseKind = form.warehouseKind;
      setForm({
        ...emptyForm(),
        parentId,
        warehouseKind: parentId ? warehouseKind : 'HEADER',
        inventoryAccountId: form.inventoryAccountId,
        costAccountId: form.costAccountId,
        code: autoNumbering ? bumpTrailingCode(createdCode) : '',
      });
      invalidate(['warehouses']);
      invalidate(['warehouses', 'next-code']);
      invalidate(['accounting-settings']);
      void refetch();
    } catch (e) {
      toast.error('تعذّر حفظ المخزن', {
        description: e instanceof Error ? e.message : 'راجع المخزن الأب والحركات المرتبطة به.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (node: GuideTreeNode) => {
    if (!(await confirmAction(`حذف المخزن ${node.code} — ${node.name}؟`))) return;
    try {
      await apiClient.delete(`/inventory/warehouses/${node.id}`);
      toast.success('تم حذف المخزن');
      invalidate(['warehouses']);
      invalidate(['warehouses', 'guide']);
      invalidate(['accounting-settings']);
      await refetch();
    } catch (e) {
      toast.error('تعذّر حذف المخزن', {
        description:
          e instanceof Error ? e.message : 'تحقق من وجود مخازن فرعية أو حركات على هذا المخزن.',
      });
    }
  };

  const isEmpty = !isLoading && rows.length === 0;

  return (
    <ErpDocumentLayout className="coa-page">
      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[
          { href: '/inventory', label: 'المخازن' },
          { label: 'الدليل' },
          { label: 'دليل المخازن' },
        ]}
        title="دليل المخازن"
        showDocumentRef={false}
        statusTone="info"
        statusLabel="دليل"
        hideStandalonePost
        hideBrowseList
        hideActionMenu
        favoriteHref="/inventory/guide"
        favoriteLabel="دليل المخازن"
      />

      {isEmpty ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
          <Warehouse className="mx-auto mb-3 h-8 w-8 text-[#0E79AA]" />
          <p className="text-lg font-semibold text-slate-800">لا توجد مخازن بعد</p>
          <p className="mt-1 text-sm text-slate-500">أضف أول مخزن رئيسي لبناء الدليل بنفس أسلوب شجرة الحسابات.</p>
          <label className="mx-auto mt-5 block max-w-sm text-right text-sm">
            <span className="font-medium text-slate-600">ترقيم المخازن</span>
            <select
              className="mt-1.5 h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] sm:text-sm"
              value={numberingMode}
              onChange={(e) => setNumberingMode(e.target.value === 'manual' ? 'manual' : 'auto')}
            >
              <option value="auto">تلقائي (افتراضي)</option>
              <option value="manual">يدوي</option>
            </select>
            <span className="mt-1 block text-[11px] font-medium text-slate-500">
              الافتراضي تلقائي. اختَر يدوي لو هتدخل أرقام المخازن بنفسك.
            </span>
          </label>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={openCreateRoot}>
              + إضافة مخزن رئيسي
            </Button>
            <Link href="/inventory/creations/stores">
              <Button variant="secondary">بطاقة المخزن</Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={openCreateRoot}>
              + إضافة مخزن رئيسي
            </Button>
            <Link href="/inventory/creations/stores">
              <Button variant="secondary" size="sm">
                بطاقة المخزن
              </Button>
            </Link>
            <NumberingModeControl
              kind="warehouses"
              auto={warehouseAuto}
              recordCount={warehouseCount}
              settingKey="warehouseAutoNumbering"
            />
            <FilterToolbar
              className="min-w-0 flex-1"
              searchPlaceholder="بحث بالرمز أو الاسم…"
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
              <WarehouseKindLegend className="mr-2" />
            </div>
            {isLoading ? (
              <p className="text-slate-600">جاري تحميل الدليل…</p>
            ) : (
              <MasterGuideTree
                nodes={tree}
                search={search}
                expandAllToken={expandToken}
                collapseAllToken={collapseToken}
                childNoun="مخازن فرعية"
                onAddChild={openCreateChild}
                canAddChild={(node) => {
                  const row = rows.find((item) => item.id === node.id);
                  return row
                    ? warehouseCanBranch(row.warehouseKind, row.parentWarehouseId)
                    : Boolean(node.folder);
                }}
                onStockReport={openStockReport}
                onView={(node) => {
                  if (node.synthetic) return;
                  const href = `/inventory/creations/stores?id=${node.id}`;
                  if (tabs) {
                    tabs.openAppTab(href);
                    return;
                  }
                  router.push(href);
                }}
                onEdit={openEdit}
                onDelete={(node) => void handleDelete(node)}
              />
            )}
          </div>
        </>
      )}

      <GuideEntityModal
        open={modalOpen}
        title={
          modalMode === 'edit'
            ? 'تعديل مخزن'
            : form.parentId
              ? form.warehouseKind === 'HEADER'
                ? 'إضافة رئيسي فرعي'
                : 'إضافة مخزن عمليات'
              : 'إضافة مخزن رئيسي'
        }
        subtitle={`المخزن الأب: ${parentLabel}`}
        hint={modalMode === 'create' ? 'بعد الحفظ النموذج يفضل مفتوح عشان تضيف التالي تحت نفس الأب. إغلاق من إلغاء.' : undefined}
        saveText={modalMode === 'create' ? 'حفظ وإضافة آخر' : 'حفظ'}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={() => void handleSave()}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CompactFormField
            label="رقم المخزن"
            required={!autoNumbering}
            value={form.code}
            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            disabled={autoNumbering && modalMode === 'create'}
            placeholder={autoNumbering ? 'تلقائي' : 'أدخل الرقم'}
          />
          <CompactFormField
            label="الاسم العربي"
            required
            value={form.arabicName}
            onChange={(e) => setForm((prev) => ({ ...prev, arabicName: e.target.value }))}
          />
          <CompactFormField
            label="الاسم الإنجليزي"
            value={form.englishName}
            onChange={(e) => setForm((prev) => ({ ...prev, englishName: e.target.value }))}
          />
          {modalMode === 'edit' ? (
            <CompactFormField label="المخزن الأب" className="sm:col-span-2">
              <WarehouseParentField
                value={form.parentId}
                onChange={applyParent}
                excludeIds={blockedParentIds}
              />
            </CompactFormField>
          ) : (
            <CompactFormField
              label="المخزن الأب"
              className="sm:col-span-2"
              value={parentLabel}
              disabled
            />
          )}
          <CompactFormField
            label="حساب المخزون"
            hint={form.parentId ? 'متاخد من الأب — تقدر تغيّره' : undefined}
          >
            <AccountSelect
              value={form.inventoryAccountId}
              onChange={(inventoryAccountId) => setForm((prev) => ({ ...prev, inventoryAccountId }))}
              leafOnly
              placeholder="حساب حركة"
              emptyLabel="حساب حركة"
            />
          </CompactFormField>
          <CompactFormField
            label="حساب تكلفة البضاعة المباعة"
            hint={form.parentId ? 'متاخد من الأب — تقدر تغيّره' : undefined}
          >
            <AccountSelect
              value={form.costAccountId}
              onChange={(costAccountId) => setForm((prev) => ({ ...prev, costAccountId }))}
              leafOnly
              placeholder="حساب حركة"
              emptyLabel="حساب حركة"
            />
          </CompactFormField>
        </div>
      </GuideEntityModal>

      <ChildWarehouseKindDialog
        open={Boolean(kindPickerParent)}
        parentLabel={
          kindPickerParent ? `${kindPickerParent.code} — ${kindPickerParent.name}` : ''
        }
        onClose={() => setKindPickerParent(null)}
        onPick={(kind) => {
          if (!kindPickerParent) return;
          const parent = kindPickerParent;
          setKindPickerParent(null);
          openCreateUnder(parent, kind);
        }}
      />
    </ErpDocumentLayout>
  );
}
