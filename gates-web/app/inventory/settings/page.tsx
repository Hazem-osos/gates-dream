'use client';

import Link from 'next/link';
import { ChevronLeft, Settings } from 'lucide-react';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { useRegisterScreenChrome } from '@/components/erp/AppScreenChromeContext';
import {
  INVENTORY_DOCUMENT_SETTINGS_GROUPS,
  TRANSACTION_SETTINGS_CONTEXT,
  settingsPageHref,
} from '@/lib/transaction-settings/types';

export default function InventorySettingsHubPage() {
  useRegisterScreenChrome();

  return (
    <ErpDocumentLayout>
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-slate-500" aria-label="مسار الصفحة">
        <Link href="/inventory" className="hover:text-[#0E78AA]">
          المخازن
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#0A3D5E]">الإعدادات</span>
      </nav>

      <header className="mb-5">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[#0E78AA]" />
          <h1 className="text-2xl font-bold text-[#0A3D5E]">إعدادات المخازن</h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          كل شاشة عمليات لها إعداداتها لوحدها: الترقيم، الترحيل التلقائي، المخزن الافتراضي، والطباعة. تعديل
          شاشة لا يغيّر شاشة أخرى.
        </p>
      </header>

      <div className="space-y-5">
        {INVENTORY_DOCUMENT_SETTINGS_GROUPS.map((group) => (
          <section
            key={group.title}
            className="rounded-2xl border border-[#D6EAF3] bg-[#F8FBFD] p-4 shadow-sm"
          >
            <h2 className="mb-3 text-sm font-bold text-[#0A3D5E]">{group.title}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.types.map((type) => {
                const ctx = TRANSACTION_SETTINGS_CONTEXT[type];
                return (
                  <Link
                    key={type}
                    href={settingsPageHref(type)}
                    className="flex items-center justify-between rounded-xl border border-[#E6F0F7] bg-white px-3 py-3 text-sm font-semibold text-[#0A3D5E] hover:border-[#0E78AA]/40"
                  >
                    <span>
                      {ctx.title}
                      <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                        {ctx.sourceLabel}
                      </span>
                    </span>
                    <ChevronLeft className="h-4 w-4 shrink-0 text-[#0E78AA]" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </ErpDocumentLayout>
  );
}
