'use client';

import { useMemo, useState } from 'react';
import { PageHeader, FilterToolbar, Button, CompactFormField, compactControlClass } from '@/components/ui';
import { MasterGuideTree } from '@/components/accounting/guide/MasterGuideTree';
import { GuideEntityModal } from '@/components/accounting/guide/GuideEntityModal';
import { groupAsFolders, type GuideTreeNode } from '@/lib/accounting/buildGuideTree';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type DelegateRow = {
  id: string;
  serial?: string | null;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
  phone1?: string | null;
  mobile?: string | null;
  groupId?: string | null;
  role?: 'DELEGATE' | 'DISTRIBUTOR' | 'DRIVER' | string;
  isActive?: boolean;
};

type FormState = {
  code: string;
  arabicName: string;
  englishName: string;
  phone1: string;
  mobile: string;
  role: 'DELEGATE' | 'DISTRIBUTOR' | 'DRIVER';
};

const emptyForm = (): FormState => ({
  code: '',
  arabicName: '',
  englishName: '',
  phone1: '',
  mobile: '',
  role: 'DELEGATE',
});

const ROLE_FOLDERS: { id: DelegateRow['role']; code: string; name: string }[] = [
  { id: 'DELEGATE', code: '01', name: 'المندوبون' },
  { id: 'DISTRIBUTOR', code: '02', name: 'الموزعون' },
  { id: 'DRIVER', code: '03', name: 'السائقون' },
];

function roleFromFolder(node?: GuideTreeNode): FormState['role'] {
  const key = node?.groupKey || node?.id.replace(/^role:/, '');
  if (key === 'DISTRIBUTOR' || key === 'DRIVER') return key;
  return 'DELEGATE';
}

export default function RepresentativesGuidePage() {
  const invalidate = useInvalidateQuery();
  const { data, isLoading, refetch } = useApiQuery<DelegateRow[]>(
    ['delegates', 'guide'],
    '/accounting/delegates',
    { limit: 1000 },
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

  const tree = useMemo(() => {
    const leavesByRole = (role: string): GuideTreeNode[] =>
      rows
        .filter((r) => {
          const normalized = r.role === 'DISTRIBUTOR' || r.role === 'DRIVER' ? r.role : 'DELEGATE';
          return normalized === role;
        })
        .map((r) => ({
          id: r.id,
          code: r.code || r.serial || '—',
          name: r.arabicName,
          subtitle: r.mobile || r.phone1 || undefined,
          groupKey: role,
        }));

    return groupAsFolders(
      ROLE_FOLDERS.map((folder) => ({
        id: `role:${folder.id}`,
        code: folder.code,
        name: folder.name,
        groupKey: folder.id as string,
        children: leavesByRole(folder.id as string),
      })),
      { keepEmpty: true }
    );
  }, [rows]);

  const openCreate = (parent?: GuideTreeNode) => {
    setModalMode('create');
    setEditId(null);
    setForm({ ...emptyForm(), role: roleFromFolder(parent) });
    setModalOpen(true);
  };

  const openEdit = (node: GuideTreeNode) => {
    const row = rows.find((r) => r.id === node.id);
    if (!row) return;
    setModalMode('edit');
    setEditId(row.id);
    setForm({
      code: row.code || row.serial || '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
      phone1: row.phone1 ?? '',
      mobile: row.mobile ?? '',
      role: (row.role as FormState['role']) || 'DELEGATE',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.arabicName.trim()) {
      toast.error('أدخل الاسم العربي للمندوب');
      return;
    }
    setSaving(true);
    try {
      const body = {
        code: form.code.trim() || undefined,
        serial: form.code.trim() || undefined,
        arabicName: form.arabicName.trim(),
        englishName: form.englishName.trim() || undefined,
        phone1: form.phone1.trim() || undefined,
        mobile: form.mobile.trim() || undefined,
        role: form.role,
      };
      if (modalMode === 'edit' && editId) {
        await apiClient.put(`/accounting/delegates/${editId}`, body);
      } else {
        await apiClient.post('/accounting/delegates', body);
      }
      toast.success('تم حفظ المندوب');
      invalidate(['delegates']);
      void refetch();
      setModalOpen(false);
    } catch (e) {
      toast.error('تعذّر حفظ المندوب', {
        description: e instanceof Error ? e.message : 'راجع الرمز والاسم ثم أعد المحاولة.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (node: GuideTreeNode) => {
    if (!window.confirm(`حذف «${node.name}»؟`)) return;
    try {
      await apiClient.delete(`/accounting/delegates/${node.id}`);
      toast.success('تم حذف المندوب');
      invalidate(['delegates']);
      void refetch();
    } catch (e) {
      toast.error('تعذّر حذف المندوب', {
        description: e instanceof Error ? e.message : 'حدّث الدليل ثم أعد المحاولة.',
      });
    }
  };

  return (
    <div className="coa-page min-h-full bg-white text-slate-900" dir="rtl" style={{ colorScheme: 'light' }}>
      <PageHeader
        title="دليل المندوبين"
        description="شجرة المندوبين والموزعين والسائقين — بحث وتعديل وحذف"
        favoriteHref="/accounting/guide/representatives-guide"
        favoriteLabel="دليل المندوبين"
        breadcrumbs={[
          { label: 'الحسابات', href: '/accounting' },
          { label: 'الدليل' },
          { label: 'المندوبين' },
        ]}
        actions={
          <Button type="button" variant="secondary" size="sm" onClick={() => openCreate()}>
            + إضافة مندوب
          </Button>
        }
      />

      <div className="mt-2">
        <FilterToolbar searchPlaceholder="بحث بالرمز أو الاسم أو الهاتف…" onSearchChange={setSearch} />
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
            + إضافة مندوب
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
            childNoun="مندوب"
            onAddChild={openCreate}
            canAddChild={(n) => Boolean(n.folder || n.synthetic)}
            onEdit={openEdit}
            onDelete={(n) => void handleDelete(n)}
          />
        )}
      </div>

      <GuideEntityModal
        open={modalOpen}
        title={modalMode === 'edit' ? 'تعديل مندوب' : 'إضافة مندوب'}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={() => void handleSave()}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CompactFormField
            label="الرمز / المسلسل"
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
          <CompactFormField label="النوع">
            <select
              className={compactControlClass}
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as FormState['role'] }))}
            >
              <option value="DELEGATE">مندوب</option>
              <option value="DISTRIBUTOR">موزع</option>
              <option value="DRIVER">سائق</option>
            </select>
          </CompactFormField>
          <CompactFormField
            label="الهاتف"
            value={form.phone1}
            onChange={(e) => setForm((f) => ({ ...f, phone1: e.target.value }))}
          />
          <CompactFormField
            label="الموبايل"
            value={form.mobile}
            onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
          />
        </div>
      </GuideEntityModal>
    </div>
  );
}
