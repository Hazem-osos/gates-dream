'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  Button,
  CompactFormField,
  FormSectionCard,
  compactControlClass,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { GuideEntityModal } from '@/components/accounting/guide/GuideEntityModal';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { exportRowsToExcel } from '@/lib/export/export-utils';
import SuccessToast from '@/components/SuccessToast';
import ErrorToast from '@/components/ErrorToast';
import type { ItemGroupRow } from '@/components/inventory/ItemGroupsListSection';
import {
  matchStatusLabel,
  tagItemImportRows,
  type ExistingItemKeys,
  type ItemImportMatchKind,
} from '@/lib/inventory/item-import-match';

const ITEM_IMPORT_HEADERS = ['اسم الصنف', 'الوحدة', 'رقم الصنف', 'الباركود', 'سعر البيع', 'سعر الشراء'];
const ITEM_IMPORT_SAMPLE = ['صنف تجريبي', 'قطعة', '', '', 100, 80];
const PREVIEW_COLUMNS = ['اسم الصنف', 'الوحدة', 'رقم الصنف', 'الباركود', 'سعر البيع', 'سعر الشراء', 'المجموعة', 'المقارنة'];

const HEADER_TO_FIELD: Record<string, string> = {
  'اسم الصنف': 'arabicName',
  'الإسم العربي': 'arabicName',
  'الاسم العربي': 'arabicName',
  'الإسم الإنجليزي': 'englishName',
  'الاسم الإنجليزي': 'englishName',
  'الوحدة': 'unit',
  'الباركود': 'barcode',
  'سعر البيع': 'price',
  'السعر': 'price',
  'سعر': 'price',
  'السعر 1': 'price',
  price: 'price',
  salesPrice: 'price',
  'سعر الشراء': 'purchasePrice',
  'سعر التكلفة': 'purchasePrice',
  'التكلفة': 'purchasePrice',
  purchasePrice: 'purchasePrice',
  cost: 'purchasePrice',
  'رقم الصنف': 'serial',
  'كود الصنف': 'serial',
  'الكود': 'serial',
  كود: 'serial',
  code: 'serial',
  serial: 'serial',
  'رقم المجموعة': 'groupCode',
  'اسم المجموعة': 'groupName',
};

function parseItemImportMatrix(matrix: unknown[][]): Record<string, string | number | null>[] {
  if (matrix.length < 2) return [];
  const headers = (matrix[0] as unknown[]).map((cell) => String(cell ?? '').trim());
  return matrix
    .slice(1)
    .map((raw) => {
      const values = raw as unknown[];
      const out: Record<string, string | number | null> = {};
      headers.forEach((header, index) => {
        const value = values[index];
        if (value == null || value === '') return;
        const field = HEADER_TO_FIELD[header];
        if (!field) return;
        if (field === 'price' || field === 'purchasePrice') {
          const n = Number(value);
          out[field] = Number.isFinite(n) ? n : null;
        } else {
          out[field] = String(value);
        }
        if (field === 'arabicName') out.name = String(value);
      });
      return out;
    })
    .filter((row) => cellOf(row, ['arabicName', 'name']));
}

function cellOf(row: Record<string, string | number | null>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== '') return String(value);
  }
  return '';
}

export default function ImportItemsPage() {
  useBackendReachability();
  const router = useRouter();
  const invalidate = useInvalidateQuery();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSuccess, setImportSuccess] = useState('');
  const [importError, setImportError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileName, setFileName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  type ImportRow = Record<string, string | number | null> & { matchKind?: ItemImportMatchKind | null };
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);

  const { data: groupsRes } = useApiQuery<ItemGroupRow[]>(
    ['item-categories', 'import'],
    '/inventory/item-categories',
    { limit: 500, isActive: true }
  );
  const groups = Array.isArray(groupsRes?.data) ? groupsRes.data : [];
  const selectedGroup = groups.find((row) => row.id === categoryId);

  const importMut = useApiMutation<
    { created: number; total: number; skipped?: number; skippedExisting?: number; skippedInSheet?: number },
    { entity: 'ITEMS'; categoryId?: string; rows: Record<string, unknown>[] }
  >('/onboarding/import-excel', 'POST', {
    showSuccessToast: true,
    successMessage: 'تم استيراد الأصناف',
  });

  const handleDownloadTemplate = async () => {
    setImportError('');
    setDownloading(true);
    try {
      await exportRowsToExcel(
        'gates-items-import-template.xlsx',
        ITEM_IMPORT_HEADERS,
        [ITEM_IMPORT_SAMPLE],
        'الأصناف'
      );
      setImportSuccess('تم تنزيل القالب. اكتب الاسم والوحدة والسعر. رقم الصنف والمجموعة اختياريان.');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'تعذر تنزيل قالب الإكسيل');
    } finally {
      setDownloading(false);
    }
  };

  const loadExcelFile = async (file: File) => {
    setImportError('');
    setImportSuccess('');
    setLoadingFile(true);
    try {
      const XLSX = await import(/* webpackChunkName: "xlsx" */ 'xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        setImportError('الملف لا يحتوي على ورقة عمل');
        return;
      }
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      if (matrix.length < 2) {
        setImportError('الملف فارغ أو بدون صف عناوين');
        return;
      }
      const mapped = parseItemImportMatrix(matrix);
      if (!mapped.length) {
        setImportError('لم يتم العثور على أصناف باسم في الملف');
        return;
      }
      let existing: ExistingItemKeys[] = [];
      try {
        const catalogRes = await apiClient.get<ExistingItemKeys[]>('/inventory/items', {
          limit: 5000,
          isActive: true,
        });
        existing = Array.isArray(catalogRes.data) ? catalogRes.data : [];
      } catch {
        existing = [];
      }
      const tagged = tagItemImportRows(
        mapped.map((row) => ({
          ...row,
          arabicName: cellOf(row, ['arabicName', 'name']),
          barcode: cellOf(row, ['barcode']) || null,
          serial: cellOf(row, ['serial', 'code']) || null,
        })),
        existing
      );
      const newCount = tagged.filter((row) => !row.matchKind).length;
      const existingCount = tagged.length - newCount;
      setFileName(file.name);
      setImportRows(tagged);
      setPreviewRows(tagged.slice(0, 20));
      setImportSuccess(
        existingCount
          ? `تم تحميل ${tagged.length} صف: ${newCount} جديد و${existingCount} موجود أو مكرر ولن يُضاف. راجع ثم احفظ.`
          : `تم تحميل ${tagged.length} صنف جديد${
              selectedGroup ? ` على مجموعة «${selectedGroup.arabicName}»` : ' — المجموعة اختيارية وهتنزل على «بدون مجموعة»'
            }. راجع ثم احفظ.`
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'تعذر قراءة ملف الإكسيل');
    } finally {
      setLoadingFile(false);
    }
  };

  const handleSave = () => {
    setImportError('');
    if (!importRows.length) {
      setImportError('حمّل ملف إكسيل أولاً من خانة ملف الاستيراد');
      return;
    }
    importMut.mutate(
      {
        entity: 'ITEMS',
        ...(categoryId ? { categoryId } : {}),
        rows: importRows.map((row) => ({
          arabicName: cellOf(row, ['arabicName', 'name']),
          unit: cellOf(row, ['unit', 'unitName']) || 'قطعة',
          serial: cellOf(row, ['serial', 'code']) || undefined,
          barcode: cellOf(row, ['barcode']) || undefined,
          price: row.price ?? row.salesPrice ?? undefined,
          purchasePrice: row.purchasePrice ?? undefined,
        })),
      },
      {
        onSuccess: (res) => {
          const created = res.data?.created ?? importRows.length;
          const total = res.data?.total ?? importRows.length;
          const skipped = res.data?.skipped ?? 0;
          setImportSuccess(
            skipped
              ? `اتضاف ${created} صنف جديد من ${total}. ${skipped} موجود بالفعل أو مكرر في الشيت واتعدّى عشان ما يتكررش.`
              : `تم استيراد ${created} من ${total} صنف${
                  selectedGroup ? ` على مجموعة «${selectedGroup.arabicName}»` : ' في مجموعة «بدون مجموعة»'
                }`
          );
          invalidate(['items']);
          invalidate(['item-categories']);
        },
        onError: (err) => {
          setImportError(err.message || 'فشل استيراد الأصناف');
        },
      }
    );
  };

  return (
    <MasterCardShell
      title="استيراد الأصناف"
      breadcrumbs={[
        { href: '/inventory', label: 'المخازن' },
        { label: 'الدليل' },
        { href: '/inventory/guide/items', label: 'الأصناف' },
        { label: 'استيراد' },
      ]}
      docNumber="استيراد"
      statusLabel="مسودة"
      onSave={handleSave}
      canSave={!importMut.isPending}
      savePending={importMut.isPending}
      onNew={() => router.push('/inventory/guide/items')}
      favoriteHref="/inventory/guide/items/import"
    >
      {importError ? <ErrorToast message={importError} onClose={() => setImportError('')} /> : null}
      {importSuccess ? <SuccessToast message={importSuccess} onClose={() => setImportSuccess('')} /> : null}

      <FormSectionCard
        title="المجموعة"
        subtitle="اختياري. لو سيبتها فاضي، الأصناف تنزل في مجموعة «بدون مجموعة»."
        icon={Upload}
      >
        <CompactFormField label="مجموعة الأصناف" className="sm:col-span-2">
          <div className="flex gap-2">
            <select
              className={compactControlClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">بدون مجموعة</option>
              {groups.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code ? `${row.code} — ` : ''}
                  {row.arabicName}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setNewGroupName('');
                setShowGroupModal(true);
              }}
            >
              + مجموعة
            </Button>
          </div>
        </CompactFormField>
      </FormSectionCard>

      <FormSectionCard title="ملف الاستيراد" subtitle="اكتب الاسم والوحدة والسعر يدويًا في الشيت">
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="mb-1 block text-xs font-semibold text-[#0A3D5E]">ملف الاستيراد</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={fileName}
              placeholder="لم يتم اختيار ملف"
              className={`${compactControlClass} min-w-[16rem] flex-1`}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void loadExcelFile(file);
              }}
            />
            <Button
              type="button"
              variant="primary"
              isLoading={loadingFile}
              onClick={() => fileInputRef.current?.click()}
            >
              {loadingFile ? 'جاري التحميل…' : 'تحميل الإكسيل'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              isLoading={downloading}
              onClick={() => void handleDownloadTemplate()}
            >
              {downloading ? 'جاري التنزيل…' : 'تنزيل القالب'}
            </Button>
          </div>
        </div>
        <p className="sm:col-span-2 lg:col-span-3 text-xs text-slate-500">
          العمود المطلوب: <strong>اسم الصنف</strong>. الوحدة والسعر والباركود ورقم الصنف اختياريين — لو رقم الصنف فاضي النظام بيولّد كود تلقائي، ولو مفيش وحدة بتنزل <strong>قطعة</strong>.
          النظام يقارن بالموجود بالباركود أو رقم الصنف أو نفس الاسم، والمكرر مش بيتضاف تاني.
        </p>
      </FormSectionCard>

      <section className="mb-4">
        <div className={denseTableWrapClass}>
          <table className={denseTableClass}>
            <thead className={denseTheadClass}>
              <tr>
                {PREVIEW_COLUMNS.map((header) => (
                  <th key={header} className={denseThClass}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(previewRows.length ? previewRows : Array.from({ length: 5 }, () => null)).map((row, idx) => (
                <tr key={idx} className={denseTrClass}>
                  {(row
                    ? [
                        cellOf(row, ['arabicName', 'name']),
                        cellOf(row, ['unit']) || 'قطعة',
                        cellOf(row, ['serial', 'code']) || 'تلقائي',
                        cellOf(row, ['barcode']),
                        cellOf(row, ['price', 'salesPrice']),
                        cellOf(row, ['purchasePrice']),
                        selectedGroup?.arabicName ?? 'بدون مجموعة',
                        matchStatusLabel(row.matchKind ?? null),
                      ]
                    : Array.from({ length: PREVIEW_COLUMNS.length }, () => '—')
                  ).map((cell, col) => (
                    <td
                      key={col}
                      className={`${denseTdClass} ${
                        !row
                          ? 'text-slate-400'
                          : col === 7 && row.matchKind
                            ? 'font-semibold text-amber-700'
                            : 'text-[#094C6B]'
                      }`}
                    >
                      {cell || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <GuideEntityModal
        open={showGroupModal}
        title="إضافة مجموعة أصناف"
        saving={savingGroup}
        saveText="حفظ المجموعة"
        onClose={() => setShowGroupModal(false)}
        onSave={() => {
          void (async () => {
            if (!newGroupName.trim()) {
              setImportError('أدخل اسم المجموعة');
              return;
            }
            setSavingGroup(true);
            try {
              const created = await apiClient.post<{ id?: string }>('/inventory/item-categories', {
                arabicName: newGroupName.trim(),
                groupType: 'MAIN',
              });
              const id = created.data?.id;
              invalidate(['item-categories']);
              if (id) setCategoryId(id);
              setShowGroupModal(false);
              setNewGroupName('');
              setImportSuccess('تم حفظ المجموعة — اختَرها للرفع');
            } catch (err) {
              setImportError(err instanceof Error ? err.message : 'تعذر حفظ المجموعة');
            } finally {
              setSavingGroup(false);
            }
          })();
        }}
      >
        <CompactFormField
          label="اسم المجموعة"
          required
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
        />
      </GuideEntityModal>
    </MasterCardShell>
  );
}
