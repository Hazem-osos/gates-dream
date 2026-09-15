'use client';

import type { ReactNode } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { DocumentHeaderBar } from '@/components/common/document-shell/DocumentHeaderBar';
import type { DocumentActionMenuProps } from '@/components/common/document-shell';
import { Button } from '@/components/ui';
import { ErpFormHeaderCard, ErpFieldError } from '@/components/erp';
import { erpInputClass, erpLabelClass } from '@/components/erp/erpUiTokens';

function formatLockedDate(iso?: string) {
  if (!iso) return '—';
  const [year, month, day] = iso.slice(0, 10).split('-');
  if (!year || !month || !day) return iso;
  return `${year}/${month}/${day}`;
}

type Props = {
  docNumber?: string;
  isPosted: boolean;
  isSyncingInventory: boolean;
  canSync: boolean;
  onSyncOpeningInventory: () => void;
  onSaveDraft: () => void;
  savePending?: boolean;
  canSave?: boolean;
  onBrowseList: () => void;
  currentId?: string | null;
  onNavigate?: (id: string) => void;
  standardActions?: DocumentActionMenuProps;
  printTrigger?: ReactNode;
  openingDate?: string;
  hijriDate?: string;
  fiscalYearName?: string;
  entryNumber: string;
  onEntryNumberChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  descriptionError?: string;
  currency: string;
  onCurrencyChange: (value: string) => void;
  readOnly?: boolean;
};

export function OpeningBalanceHeader({
  docNumber,
  isPosted,
  isSyncingInventory,
  canSync,
  onSyncOpeningInventory,
  onSaveDraft,
  savePending,
  canSave,
  onBrowseList,
  currentId,
  onNavigate,
  standardActions,
  printTrigger,
  openingDate,
  hijriDate,
  fiscalYearName,
  entryNumber,
  onEntryNumberChange,
  description,
  onDescriptionChange,
  descriptionError,
  currency,
  onCurrencyChange,
  readOnly,
}: Props) {
  return (
    <>
      <DocumentHeaderBar
        breadcrumbs={[
          { href: '/accounting', label: 'المحاسبة' },
          { label: 'العمليات' },
          { label: 'الرصيد الافتتاحي' },
        ]}
        title="قيد الرصيد الافتتاحي للسنة المالية"
        docNumber={docNumber}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحل ومثبت (Posted)' : 'مسودة (Draft)'}
        onSaveDraft={onSaveDraft}
        savePending={savePending}
        canSave={canSave}
        onBrowseList={onBrowseList}
        browseListLabel="السابق"
        favoriteHref="/accounting/operations/basic-operations/opening-balance"
        favoriteLabel="الرصيد الافتتاحي"
        navEntity="journal-entry"
        entryType="OPENING_BALANCE"
        currentId={currentId}
        onNavigate={onNavigate}
        standardActions={standardActions}
        printTrigger={printTrigger}
        extraActions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canSync || isPosted || isSyncingInventory}
            onClick={onSyncOpeningInventory}
            className="gap-1.5 border-emerald-600/30 font-medium text-emerald-700 shadow-sm hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncingInventory ? 'animate-spin' : ''}`} />
            <span>تحديث بضاعة أول المدة</span>
          </Button>
        }
      />

      <ErpFormHeaderCard
        row1={
          <>
            <div>
              <label className={erpLabelClass}>رقم القيد</label>
              <input
                className={erpInputClass}
                placeholder="OB-2026"
                value={entryNumber}
                disabled={readOnly}
                onChange={(e) => onEntryNumberChange(e.target.value)}
              />
            </div>
            <div className="lg:col-span-2">
              <label className={erpLabelClass}>تاريخ الرصيد الافتتاحي</label>
              <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/60 p-2 px-3">
                <Calendar className="h-4 w-4 shrink-0 text-primary" />
                <div className="flex flex-col text-xs">
                  <div className="flex items-center gap-1.5 font-mono font-semibold text-foreground">
                    <span>تاريخ الرصيد:</span>
                    <span>{formatLockedDate(openingDate)}</span>
                  </div>
                  {hijriDate ? (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      الموافق: {hijriDate}
                    </span>
                  ) : null}
                  {fiscalYearName ? (
                    <span className="text-[11px] text-muted-foreground">السنة المالية: {fiscalYearName}</span>
                  ) : null}
                </div>
                <span className="mr-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  آلي (اليوم السابق للسنة المالية)
                </span>
              </div>
            </div>
            <div>
              <label className={erpLabelClass}>العملة</label>
              <select
                className={erpInputClass}
                value={currency}
                disabled={readOnly}
                onChange={(e) => onCurrencyChange(e.target.value)}
              >
                <option value="جنية مصري">جنية مصري</option>
              </select>
            </div>
          </>
        }
        row2={
          <>
            <div className="lg:col-span-4">
              <label className={erpLabelClass}>الشرح / الملاحظات</label>
              <textarea
                className={`${erpInputClass} min-h-[72px] resize-y`}
                placeholder="إدخل شرح قيد الرصيد الافتتاحي"
                value={description}
                disabled={readOnly}
                onChange={(e) => onDescriptionChange(e.target.value)}
              />
              <ErpFieldError message={descriptionError} show={!!descriptionError} />
            </div>
          </>
        }
      />
    </>
  );
}
