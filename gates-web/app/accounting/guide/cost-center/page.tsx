'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { FilterToolbar, Button, CompactFormField } from '@/components/ui';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { MasterGuideTree } from '@/components/accounting/guide/MasterGuideTree';
import { GuideEntityModal } from '@/components/accounting/guide/GuideEntityModal';
import { buildParentTree, type GuideTreeNode } from '@/lib/accounting/buildGuideTree';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { NumberingModeControl } from '@/components/accounting/NumberingModeControl';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { bumpTrailingCode, isCodeAfter } from '@/lib/masters/nextNumericSerial';

type CostCenterRow = {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string | null;
  parentId?: string | null;
  isActive?: boolean;
};

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

export default function CostCentersGuidePage() {
  const invalidate = useInvalidateQuery();
  const { data: settingsRes } = useAccountingSettingsQuery();
  const costCenterAuto = settingsRes?.data?.general?.costCenterAutoNumbering !== false;
  const costCenterCount = settingsRes?.data?.general?.numberingRecordCounts?.costCenters ?? 0;
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

  const { data: nextCodeResponse } = useApiQuery<{ code?: string }>(
    ['cost-centers', 'next-code', form.parentId || 'root'],
    '/accounting/cost-centers/next-code',
    form.parentId ? { parentId: form.parentId } : undefined,
    { enabled: modalOpen && modalMode === 'create' && costCenterAuto }
  );

  useEffect(() => {
    if (!modalOpen || modalMode !== 'create' || !costCenterAuto) return;
    const suggested = nextCodeResponse?.data?.code;
    if (!suggested) return;
    setForm((f) => {
      if (!costCenterAuto && f.code) return f;
      if (f.code && isCodeAfter(f.code, suggested)) return f;
      return f.code === suggested ? f : { ...f, code: suggested };
    });
  }, [modalOpen, modalMode, costCenterAuto, nextCodeResponse?.data?.code]);

  const tree = useMemo(
    () =>
      buildParentTree(rows, (item, children) => ({
        id: item.id,
        code: item.code,
        name: item.arabicName,
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
      parentId: row.parentId ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.arabicName.trim()) {
      toast.error('أدخل اسم المركز');
      return;
    }
    if (!costCenterAuto && modalMode === 'create' && !form.code.trim()) {
      toast.error('رقم المركز مطلوب — الترقيم يدوي');
      return;
    }
    setSaving(true);
    try {
      const body = {
        code: form.code.trim() || undefined,
        arabicName: form.arabicName.trim(),
        englishName: form.englishName.trim() || undefined,
        parentId: form.parentId || undefined,
        isActive: true,
      };
      if (modalMode === 'edit' && editId) {
        await apiClient.put(`/accounting/cost-centers/${editId}`, body);
        toast.success('تم حفظ مركز التكلفة');
        invalidate(['cost-centers']);
        void refetch();
        setModalOpen(false);
        return;
      }
      await apiClient.post('/accounting/cost-centers', body);
      toast.success('تم حفظ مركز التكلفة — تقدر تضيف التالي');
      const parentId = form.parentId;
      setForm({
        ...emptyForm(),
        parentId,
        code: costCenterAuto ? bumpTrailingCode(form.code) : '',
      });
      invalidate(['cost-centers']);
      invalidate(['cost-centers', 'next-code']);
      void refetch();
    } catch (e) {
      toast.error('تعذّر حفظ مركز التكلفة', {
        description: e instanceof Error ? e.message : 'راجع المركز الأب والحركات المرتبطة به.',
      });
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
      toast.error('تعذّر حذف مركز التكلفة', {
        description:
          e instanceof Error
            ? e.message
            : 'تحقق من وجود مراكز فرعية أو حركات، أو انقل الحركة من شاشة «نقل حركة مركز التكلفة».',
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
          { href: '/accounting', label: 'المحاسبة' },
          { label: 'الدليل' },
          { label: 'مراكز التكلفة' },
        ]}
        title="دليل مراكز التكلفة"
        showDocumentRef={false}
        statusTone="info"
        statusLabel="دليل"
        hideStandalonePost
        hideBrowseList
        hideActionMenu
        favoriteHref="/accounting/guide/cost-center"
        favoriteLabel="دليل مراكز التكلفة"
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
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => openCreate()}>
              + إضافة
            </Button>
            <NumberingModeControl
              kind="costCenters"
              auto={costCenterAuto}
              recordCount={costCenterCount}
              settingKey="costCenterAutoNumbering"
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
        hint={modalMode === 'create' ? 'بعد الحفظ النموذج يفضل مفتوح عشان تضيف التالي تحت نفس الأب. إغلاق من إلغاء.' : undefined}
        saveText={modalMode === 'create' ? 'حفظ وإضافة آخر' : 'حفظ'}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={() => void handleSave()}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CompactFormField
            label="رقم مركز التكلفة"
            required={!costCenterAuto}
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            disabled={costCenterAuto && modalMode === 'create'}
            placeholder={costCenterAuto ? 'تلقائي' : 'أدخل الرقم'}
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
        </div>
      </GuideEntityModal>
    </ErpDocumentLayout>
  );
}
