'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { confirmAction } from '@/lib/feedback/confirm';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { DocumentLayoutConfigurator } from '@/components/documentLayout/DocumentLayoutConfigurator';
import { DEFAULT_DOCUMENT_LAYOUT_CONFIG, cloneDefaultConfig } from '@/lib/documentLayout/defaults';
import {
  DOCUMENT_TYPE_LABELS,
  DocumentLayoutConfig,
  DocumentLayoutType,
} from '@/lib/documentLayout/types';
import { layoutDisplayName } from '@/lib/documentLayout/pickSavedDocumentLayout';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';

const QUERY_KEY = 'document-layout-configs';

function emptyShape(documentType: DocumentLayoutType): DocumentLayoutConfig {
  return { ...cloneDefaultConfig(), documentType, name: 'تخطيط جديد', id: undefined, isDefault: false };
}

export function DocumentLayoutSettingsView() {
  const invalidate = useInvalidateQuery();
  const [documentType, setDocumentType] = useState<DocumentLayoutType>('ALL');
  const [config, setConfig] = useState<DocumentLayoutConfig>(() => emptyShape('ALL'));
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(config));
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: listRes, isLoading } = useApiQuery<DocumentLayoutConfig[]>([QUERY_KEY], '/document-layout-configs');
  const rows = listRes?.data ?? [];

  const dirty = useMemo(() => JSON.stringify(config) !== savedSnapshot, [config, savedSnapshot]);

  const applyRow = (row: DocumentLayoutConfig) => {
    const next = { ...DEFAULT_DOCUMENT_LAYOUT_CONFIG, ...row };
    setDocumentType(next.documentType);
    setConfig(next);
    setSavedSnapshot(JSON.stringify(next));
    setBrowseOpen(false);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleChange = (patch: Partial<DocumentLayoutConfig>) => setConfig((prev) => ({ ...prev, ...patch }));

  const handleSave = async (override?: Partial<DocumentLayoutConfig>) => {
    const merged = { ...config, ...override };
    const payload: Partial<DocumentLayoutConfig> = {
      ...merged,
      documentType: override?.documentType ?? documentType,
      name: merged.name?.trim() || 'تخطيط',
    };
    delete payload.companyId;
    delete payload.createdAt;
    delete payload.updatedAt;
    const editing = Boolean(payload.id);
    if (!editing) delete payload.id;
    setSaving(true);
    try {
      const res = editing
        ? await apiClient.put<DocumentLayoutConfig>('/document-layout-configs', payload)
        : await apiClient.post<DocumentLayoutConfig>('/document-layout-configs', payload);
      setToast({ kind: 'success', message: editing ? 'تم تعديل الشكل' : 'تم حفظ الشكل' });
      if (res?.data) applyRow(res.data);
      invalidate([QUERY_KEY]);
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'فشل حفظ التخطيط' });
    } finally {
      setSaving(false);
    }
  };

  const handleNew = () => {
    const next = emptyShape(documentType);
    setConfig(next);
    setSavedSnapshot(JSON.stringify(next));
  };

  const handleResetDefaults = () => {
    setConfig({
      ...cloneDefaultConfig(),
      documentType,
      id: config.id,
      name: config.name || 'تخطيط جديد',
      branchId: config.branchId,
      isDefault: config.isDefault,
    });
  };

  const handleDelete = async () => {
    if (!config.id) return;
    if (!(await confirmAction(`حذف الشكل «${layoutDisplayName(config)}»؟`))) return;
    try {
      await apiClient.delete(`/document-layout-configs/${config.id}`);
      setToast({ kind: 'success', message: 'تم حذف الشكل' });
      invalidate([QUERY_KEY]);
      handleNew();
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'تعذر الحذف' });
    }
  };

  return (
    <ErpDocumentLayout>
      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[
          { href: '/accounting-settings', label: 'الإعدادات' },
          { label: 'تخطيط المستندات' },
        ]}
        title="تخطيط المستندات"
        docNumber={config.name || (config.id ? 'تعديل' : 'جديد')}
        statusTone={config.id ? 'info' : 'neutral'}
        statusLabel={config.id ? 'تعديل' : 'جديد'}
        showDocumentRef={false}
        saveLabel="حفظ الشكل"
        onSaveDraft={() => void handleSave()}
        savePending={saving}
        canSave={!saving}
        hideStandalonePost
        onBrowseList={() => setBrowseOpen(true)}
        browseListLabel="السابق"
        currentId={config.id}
        moreMenuItems={[
          { id: 'new', label: 'شكل جديد', onClick: handleNew },
          {
            id: 'default',
            label: 'اجعله الافتراضي',
            onClick: () => void handleSave({ isDefault: true }),
            disabled: !config.id || config.isDefault,
          },
          {
            id: 'del',
            label: 'حذف الشكل',
            onClick: () => void handleDelete(),
            disabled: !config.id,
            destructive: true,
          },
        ]}
      />

      {toast ? (
        <div
          className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${
            toast.kind === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-red-200 bg-red-50 text-red-600'
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="min-h-[calc(100vh-220px)]">
        <DocumentLayoutConfigurator
          config={config}
          onChange={handleChange}
          documentType={documentType}
          onDocumentTypeChange={(type) => {
            setDocumentType(type);
            setConfig((prev) => ({ ...prev, documentType: type }));
          }}
          onSave={() => void handleSave()}
          onResetDefaults={handleResetDefaults}
          saving={saving}
          loading={isLoading}
          dirty={dirty}
        />
      </div>

      <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="الأشكال المحفوظة">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">لا يوجد أشكال محفوظة بعد. احفظ شكلاً أولاً.</p>
        ) : (
          <div className="space-y-2 p-2">
            {rows.map((row) => (
              <button
                key={row.id || layoutDisplayName(row)}
                type="button"
                onClick={() => applyRow(row)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-right ${
                  row.id && row.id === config.id
                    ? 'border-[#0E79AA] bg-[#0E79AA]/5'
                    : 'border-[#D6EAF3] bg-white hover:border-[#0E79AA]'
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold text-[#094C6B]">{layoutDisplayName(row)}</span>
                  <span className="block text-[11px] text-slate-500">{DOCUMENT_TYPE_LABELS[row.documentType]}</span>
                </span>
                {row.isDefault ? (
                  <span className="rounded-full bg-[#0E79AA]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0E79AA]">
                    افتراضي
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </DocumentBrowseDrawer>
    </ErpDocumentLayout>
  );
}
