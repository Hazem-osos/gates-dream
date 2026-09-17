'use client';

import { useMemo, useState } from 'react';
import { Warehouse } from 'lucide-react';
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
import { bumpTrailingCode } from '@/lib/masters/nextNumericSerial';

type FormState = {
  code: string;
  arabicName: string;
  englishName: string;
  parentId: string;
};

const emptyForm = (): FormState => ({
  code: '',
  arabicName: '',
  englishName: '',
  parentId: '',
});

export default function WarehouseGuidePage() {
  const invalidate = useInvalidateQuery();
  const { data, isLoading, refetch } = useApiQuery<WarehouseRow[]>(
    ['warehouses', 'guide'],
    '/inventory/warehouses',
    { limit: 1000 },
    { staleTime: 15_000 }
  );

  const rows = asWarehouseRows(data?.data);
  const [search, setSearch] = useState('');
  const [expandToken, setExpandToken] = useState(0);
  const [collapseToken, setCollapseToken] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const tree = useMemo(
    () =>
      buildParentTree(
        rows.map((row) => ({ ...row, parentId: row.parentWarehouseId ?? null })),
        (item, children) => ({
          id: item.id,
          code: item.code || '',
          name: item.arabicName,
          subtitle: item.storeType === 'SUB' ? 'فرعي' : 'رئيسي',
          folder: children.length > 0 || item.storeType !== 'SUB',
          children,
        })
      ),
    [rows]
  );

  const parentLabel = useMemo(() => {
    if (!form.parentId) return 'مخزن رئيسي (بدون أب)';
    const parent = rows.find((row) => row.id === form.parentId);
    return parent ? `${parent.code || '—'} — ${parent.arabicName}` : 'مخزن رئيسي';
  }, [form.parentId, rows]);

  const openCreate = (parent?: GuideTreeNode) => {
    setModalMode('create');
    setEditId(null);
    setForm({
      ...emptyForm(),
      parentId: parent && !parent.synthetic ? parent.id : '',
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
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.arabicName.trim()) {
      toast.error('أدخل اسم المخزن');
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
      setForm({
        ...emptyForm(),
        parentId: form.parentId,
        code: bumpTrailingCode(createdCode),
      });
      invalidate(['warehouses']);
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
      void refetch();
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
          <p className="mt-1 text-sm text-slate-500">أضف أول مخزن لبناء الدليل بنفس أسلوب شجرة الحسابات.</p>
          <Button type="button" className="mt-4" onClick={() => openCreate()}>
            إضافة مخزن
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => openCreate()}>
              + إضافة
            </Button>
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
                onAddChild={openCreate}
                onEdit={openEdit}
                onDelete={(node) => void handleDelete(node)}
              />
            )}
          </div>
        </>
      )}

      <GuideEntityModal
        open={modalOpen}
        title={modalMode === 'edit' ? 'تعديل مخزن' : form.parentId ? 'إضافة مخزن فرعي' : 'إضافة مخزن رئيسي'}
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
            value={form.code}
            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            disabled={modalMode === 'create'}
            placeholder={modalMode === 'create' ? 'تلقائي' : 'أدخل الرقم'}
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
        </div>
      </GuideEntityModal>
    </ErpDocumentLayout>
  );
}
