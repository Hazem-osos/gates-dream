'use client';

import type { FieldHelp } from '@/lib/electronic-invoices/ereceipt-field-help';

export function FieldHelpHint({ help }: { help: FieldHelp }) {
  return (
    <div className="mt-1 space-y-0.5 text-xs text-foreground-muted">
      <p>{help.explanationAr}</p>
      <p>
        <span className="font-semibold text-brand">من أين أحصل عليها؟</span> {help.helpAr}
      </p>
      {help.example ? <p className="text-slate-500">مثال: {help.example}</p> : null}
    </div>
  );
}
