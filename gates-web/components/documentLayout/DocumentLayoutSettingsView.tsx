'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { DocumentLayoutConfigurator } from '@/components/documentLayout/DocumentLayoutConfigurator';
import { DEFAULT_DOCUMENT_LAYOUT_CONFIG, cloneDefaultConfig } from '@/lib/documentLayout/defaults';
import { DocumentLayoutConfig, DocumentLayoutType } from '@/lib/documentLayout/types';

const QUERY_KEY = 'document-layout-configs';

export function DocumentLayoutSettingsView() {
  const invalidate = useInvalidateQuery();
  const [documentType, setDocumentType] = useState<DocumentLayoutType>('ALL');
  const [config, setConfig] = useState<DocumentLayoutConfig>(() => ({ ...cloneDefaultConfig(), documentType: 'ALL' }));
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(config));
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const { data: listRes, isLoading } = useApiQuery<DocumentLayoutConfig[]>(
    [QUERY_KEY, documentType],
    '/document-layout-configs',
    { documentType }
  );

  useEffect(() => {
    const rows = listRes?.data ?? [];
    const companyWide = rows.find((r) => !r.branchId) ?? rows[0];
    const next: DocumentLayoutConfig = companyWide
      ? { ...DEFAULT_DOCUMENT_LAYOUT_CONFIG, ...companyWide }
      : { ...cloneDefaultConfig(), documentType };
    setConfig(next);
    setSavedSnapshot(JSON.stringify(next));
  }, [listRes?.data, documentType]);

  const dirty = useMemo(() => JSON.stringify(config) !== savedSnapshot, [config, savedSnapshot]);

  const saveMutation = useApiMutation<DocumentLayoutConfig, Partial<DocumentLayoutConfig>>(
    `/document-layouts/${documentType}`,
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        setToast({ kind: 'success', message: 'تم حفظ تخطيط المستند بنجاح' });
        if (res?.data) {
          setConfig(res.data);
          setSavedSnapshot(JSON.stringify(res.data));
        }
        invalidate([QUERY_KEY]);
      },
      onError: (e) => setToast({ kind: 'error', message: e.message || 'فشل حفظ التخطيط' }),
    }
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleChange = (patch: Partial<DocumentLayoutConfig>) => setConfig((prev) => ({ ...prev, ...patch }));

  const handleSave = () => {
    const payload: Partial<DocumentLayoutConfig> = { ...config, documentType };
    delete payload.id;
    delete payload.companyId;
    delete payload.createdAt;
    delete payload.updatedAt;
    saveMutation.mutate(payload);
  };

  const handleResetDefaults = () => {
    setConfig({ ...cloneDefaultConfig(), documentType, id: config.id, branchId: config.branchId });
  };

  return (
    <div className="flex h-[calc(100vh-96px)] flex-col gap-3 p-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#094C6B]">تخصيص طباعة المستندات</h1>
          <p className="text-xs text-slate-500">
            تحكم في تصميم مستخلصات المقاولين، إيصالات الأقساط العقارية، وإشعارات الخصم — مع معاينة فورية.
          </p>
        </div>
        {toast ? (
          <div
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              toast.kind === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
            }`}
          >
            {toast.message}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        <DocumentLayoutConfigurator
          config={config}
          onChange={handleChange}
          documentType={documentType}
          onDocumentTypeChange={setDocumentType}
          onSave={handleSave}
          onResetDefaults={handleResetDefaults}
          saving={saveMutation.isPending}
          loading={isLoading}
          dirty={dirty}
        />
      </div>
    </div>
  );
}
