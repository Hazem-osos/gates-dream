'use client';

import { useState } from 'react';
import { LeftControlPanel } from './LeftControlPanel';
import { RightPreviewPanel } from './RightPreviewPanel';
import { DOCUMENT_TYPE_LABELS, DocumentLayoutConfig, DocumentLayoutType } from '@/lib/documentLayout/types';

export interface DocumentLayoutConfiguratorProps {
  config: DocumentLayoutConfig;
  onChange: (patch: Partial<DocumentLayoutConfig>) => void;
  documentType: DocumentLayoutType;
  onDocumentTypeChange: (type: DocumentLayoutType) => void;
  onSave: () => void;
  onResetDefaults: () => void;
  saving?: boolean;
  loading?: boolean;
  dirty?: boolean;
}

/**
 * Real-time, split-screen Document Layout Configurator (Odoo-print-tool
 * inspired). Purely presentational + local UI state — persistence and data
 * loading are owned by the parent page.
 */
export function DocumentLayoutConfigurator({
  config,
  onChange,
  documentType,
  onDocumentTypeChange,
  onSave,
  onResetDefaults,
  saving,
  loading,
  dirty,
}: DocumentLayoutConfiguratorProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E6F0F7] bg-white shadow-sm" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6F0F7] bg-[#F6FBFD] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#094C6B]">مصمم تخطيط المستندات</span>
          <select
            value={documentType}
            onChange={(e) => onDocumentTypeChange(e.target.value as DocumentLayoutType)}
            className="rounded-lg border border-[#D6EAF3] bg-white px-3 py-1.5 text-xs font-medium text-[#094C6B]"
          >
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {dirty ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">تعديلات غير محفوظة</span> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetDefaults}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-300 disabled:opacity-50"
          >
            إعادة الضبط الافتراضي
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || loading}
            className="rounded-lg bg-[#0E78AA] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#094C6B] disabled:opacity-60"
          >
            {saving ? 'جارِ الحفظ…' : 'حفظ التخطيط'}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_1fr]">
        <aside className="min-h-0 border-e border-[#E6F0F7]">
          <LeftControlPanel config={config} onChange={onChange} error={localError} onError={setLocalError} />
        </aside>
        <section className="min-h-0">
          <RightPreviewPanel config={config} onSave={onSave} saving={saving} />
        </section>
      </div>
    </div>
  );
}
