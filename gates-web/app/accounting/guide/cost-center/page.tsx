'use client';

import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { PageHeader, FilterToolbar, Button, CompactFormField, compactControlClass } from '@/components/ui';
import { MasterGuideTree } from '@/components/accounting/guide/MasterGuideTree';
import { GuideEntityModal } from '@/components/accounting/guide/GuideEntityModal';
import { buildParentTree, type GuideTreeNode } from '@/lib/accounting/buildGuideTree';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type CostCenterRow = {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string | null;
  centerType?: string | null;
  parentId?: string | null;
  isActive?: boolean;
};

type FormState = {
  code: string;
  arabicName: string;
  englishName: string;
  centerType: string;
  parentId: string;
};

const emptyForm = (): FormState => ({
  code: '',
  arabicName: '',
  englishName: '',
  centerType: '',
  parentId: '',
});

export default function CostCentersGuidePage() {
  const invalidate = useInvalidateQuery();
  const { data, isLoading, refetch } = useApiQuery<CostCenterRow[]>(
    ['cost-centers', 'guide'],
    '/accounting/cost-centers',
    { limit: 1000, isActive: true },
    { staleTime: 15_000 }
  );

  const rows = data?.data ?? [];
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
      buildParentTree(rows, (item, children) => ({
        id: item.id,
        code: item.code,
        name: item.arabicName,
        subtitle: item.centerType || undefined,
        folder: children.length > 0,
        children,
      })),
    [rows]
  );

  const parentLabel = useMemo(() => {
    if (!form.parentId) return 'مركز رئيسي (بدون أب)';
    const parent = rows.find((r) => r.id === form.parentId);
    return parent ? `${parent.code} — ${parent.arabicName}` : 'مركز رئيسي';
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
    const row = rows.find((r) => r.id === node.id);
    if (!row) return;
    setModalMode('edit');
    setEditId(row.id);
    setForm({
      code: row.code ?? '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
      centerType: row.centerType ?? '',
      parentId: row.parentId ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.arabicName.trim()) {
      toast.error('أدخل رقم المركز والاسم العربي');
      return;
    }
    setSaving(true);
    try {
      const body = {
        code: form.code.trim(),
        arabicName: form.arabicName.trim(),
        englishName: form.englishName.trim() || undefined,
        centerType: form.centerType || undefined,
        parentId: form.parentId || undefined,
        isActive: true,
      };
      if (modalMode === 'edit' && editId) {
        await apiClient.put(`/accounting/cost-centers/${editId}`, body);
      } else {
        await apiClient.post('/accounting/cost-centers', body);
      }
      toast.success('تم حفظ مركز التكلفة');
      invalidate(['cost-centers']);
      void refetch();
      setModalOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (node: GuideTreeNode) => {
    if (!window.confirm(`حذف مركز التكلفة ${node.code} — ${node.name}؟`)) return;
    try {
      await apiClient.delete(`/accounting/cost-centers/${node.id}`);
      toast.success('تم حذف مركز التكلفة');
      invalidate(['cost-centers']);
      void refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر الحذف — تحقق من وجود مراكز فرعية أو حركات.');
    }
  };

  const isEmpty = !isLoading && rows.length === 0;

  return (
    <div className="coa-page min-h-full bg-white text-slate-900" dir="rtl" style={{ colorScheme: 'light' }}>
      <PageHeader
        title="دليل مراكز التكلفة"
        description="شجرة مراكز التكلفة — بحث، إضافة فرعي، تعديل وحذف"
        favoriteHref="/accounting/guide/cost-center"
        favoriteLabel="دليل مراكز التكلفة"
        breadcrumbs={[
          { label: 'الحسابات', href: '/accounting' },
          { label: 'الدليل' },
          { label: 'مراكز التكلفة' },
        ]}
        actions={
          <Button type="button" variant="secondary" size="sm" onClick={() => openCreate()}>
            + إضافة مركز رئيسي
          </Button>
        }
      />

      {isEmpty ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
          <Layers className="mx-auto mb-3 h-8 w-8 text-[#0E79AA]" />
          <p className="text-lg font-semibold text-slate-800">لا توجد مراكز تكلفة بعد</p>
          <p className="mt-1 text-sm text-slate-500">أضف أول مركز لبناء الدليل بنفس أسلوب شجرة الحسابات.</p>
          <Button type="button" className="mt-4" onClick={() => openCreate()}>
            إضافة مركز تكلفة
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-2">
            <FilterToolbar searchPlaceholder="بحث بالرمز أو الاسم…" onSearchChange={setSearch} />
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandToken((t) => t + 1)}>
                ⊞ توسيع الكل
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCollapseToken((t) => t + 1)}>
                ⊟ طي الكل
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => openCreate()}>
                + إضافة مركز رئيسي
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
                childNoun="مراكز فرعية"
                onAddChild={openCreate}
                onEdit={openEdit}
                onDelete={(n) => void handleDelete(n)}
              />
            )}
          </div>
        </>
      )}

      <GuideEntityModal
        open={modalOpen}
        title={modalMode === 'edit' ? 'تعديل مركز تكلفة' : form.parentId ? 'إضافة مركز فرعي' : 'إضافة مركز رئيسي'}
        subtitle={`المركز الأب: ${parentLabel}`}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={() => void handleSave()}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CompactFormField
            label="رقم مركز التكلفة"
            required
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          />
          <CompactFormField
            label="الاسم العربي"
            required
            value={form.arabicName}
            onChange={(e) => setForm((f) => ({ ...f, arabicName: e.target.value }))}
          />
          <CompactFormField
            label="الاسم الإنجليزي"
            value={form.englishName}
            onChange={(e) => setForm((f) => ({ ...f, englishName: e.target.value }))}
          />
          <CompactFormField label="نوع المركز">
            <select
              className={compactControlClass}
              value={form.centerType}
              onChange={(e) => setForm((f) => ({ ...f, centerType: e.target.value }))}
            >
              <option value="">اختر النوع</option>
              <option value="توفير">توفير</option>
              <option value="إنتاج">إنتاج</option>
              <option value="خدمة">خدمة</option>
            </select>
          </CompactFormField>
        </div>
      </GuideEntityModal>
    </div>
  );
}
