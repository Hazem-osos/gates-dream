'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { useRegisterScreenChrome } from '@/components/erp/AppScreenChromeContext';
import { TransactionSettingsForm } from '@/components/settings/transaction-settings/TransactionSettingsForm';
import {
  TRANSACTION_SETTINGS_CONTEXT,
  isSecuritiesDocumentType,
  isTreasuryDocumentType,
  type TransactionDocumentType,
} from '@/lib/transaction-settings/types';

export function TransactionSettingsScreen({
  documentType,
}: {
  documentType: TransactionDocumentType;
}) {
  const ctx = TRANSACTION_SETTINGS_CONTEXT[documentType];
  useRegisterScreenChrome();

  return (
    <ErpDocumentLayout>
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-slate-500" aria-label="مسار الصفحة">
        <Link href={ctx.module === 'inventory' ? '/inventory' : '/accounting'} className="hover:text-[#0E79AA]">
          {ctx.moduleLabel}
        </Link>
        <span>/</span>
        <span>العمليات</span>
        <span>/</span>
        <Link href={ctx.sourceHref} className="hover:text-[#0E79AA]">
          {ctx.sourceLabel}
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#0A3D5E]">الإعدادات</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#0E79AA]">إعدادات شاشة {ctx.sourceLabel}</p>
          <h1 className="mt-0.5 text-2xl font-bold text-[#0A3D5E]">{ctx.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isTreasuryDocumentType(documentType)
              ? `اختَر الحسابات من شجرة هذه الشركة فقط — الصندوق أو البنك، الحساب المقابل، والعمولة. كل عميل يحدّد شجرته بنفسه لشاشة «${ctx.sourceLabel}».`
              : isSecuritiesDocumentType(documentType)
                ? `ترقيم ورقة «${ctx.sourceLabel}» تلقائي من النظام، إلا لو اخترت يدوياً من نوع الترقيم.`
                : `هذه السياسات خاصة بوحدة ${ctx.moduleLabel} وشاشة «${ctx.sourceLabel}» فقط.`}
          </p>
        </div>
        <Link
          href={ctx.sourceHref}
          className="inline-flex items-center gap-1 rounded-xl border border-[#D6EAF3] bg-white px-3 py-2 text-sm font-medium text-[#0E79AA] hover:bg-[#E8F4FA]"
        >
          العودة إلى {ctx.sourceLabel}
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>

      <TransactionSettingsForm documentType={documentType} hidePageTitle />
    </ErpDocumentLayout>
  );
}
