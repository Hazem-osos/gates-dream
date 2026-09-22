'use client';

import { Download } from 'lucide-react';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { Button } from '@/components/ui';

type Props = {
  docNumber?: string;
  isPosted: boolean;
  isReadOnly: boolean;
  hasDocument: boolean;
  canPost?: boolean;
  date: string;
  dateError?: boolean;
  fiscalYearName?: string;
  savePending?: boolean;
  canSave?: boolean;
  loadPending?: boolean;
  onSave: () => void;
  onBrowseList: () => void;
  onLoadItems: () => void;
  onPost: () => void;
  onUnpost: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onExportExcel: () => void;
  onClearAll: () => void;
  onNew?: () => void;
  newDisabled?: boolean;
  newHint?: string;
  onVoid?: () => void;
  onRestore?: () => void;
  isCancelled?: boolean;
};

export function OpeningStockHeader({
  docNumber,
  isPosted,
  isReadOnly,
  hasDocument,
  canPost,
  date,
  dateError,
  fiscalYearName,
  savePending,
  canSave,
  loadPending,
  onSave,
  onBrowseList,
  onLoadItems,
  onPost,
  onUnpost,
  onEdit,
  onPrint,
  onExportExcel,
  onClearAll,
  onNew,
  newDisabled,
  newHint,
  onVoid,
  onRestore,
  isCancelled,
}: Props) {
  return (
    <>
      <ErpDocumentPageHeader
        compact
        breadcrumbs={[
          { href: '/inventory', label: 'المخازن' },
          { label: 'العمليات' },
          { label: 'بضاعة أول المدة' },
        ]}
        title="بضاعة أول المدة"
        docNumber={docNumber || 'OS-XXXX'}
        statusTone={isCancelled ? 'danger' : isPosted ? 'success' : 'warning'}
        statusLabel={isCancelled ? 'ملغي' : isPosted ? 'مرحل ومثبت (Posted)' : 'مسودة (Draft)'}
        onSaveDraft={onSave}
        saveLabel="حفظ"
        savePending={savePending}
        canSave={canSave}
        hideStandalonePost
        onBrowseList={onBrowseList}
        browseListLabel="السابق"
        favoriteHref="/inventory/operations/opening-stock"
        favoriteLabel="بضاعة أول المدة"
        extraActions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            isLoading={loadPending}
            disabled={isReadOnly || isPosted || loadPending}
            onClick={onLoadItems}
          >
            <Download className="h-3.5 w-3.5" />
            تحميل كافة الأصناف
          </Button>
        }
        standardActions={{
          hasDocument,
          isPosted,
          isCancelled: Boolean(isCancelled),
          onNew,
          newLabel: 'جديد',
          newDisabled,
          newHint:
            newHint ?? 'يوجد كشف بضاعة أول المدة بالفعل. عدّل نفس الكشف أو استرجعه إن كان ملغياً.',
          onEdit,
          onPost,
          onUnpost,
          onPrint,
          printLabel: 'طباعة كشف بضاعة أول المدة',
          onVoid,
          onRestore,
          allowEditWhenCancelled: true,
          voidLabel: 'إلغاء الكشف',
          restoreLabel: 'استعادة الكشف',
          restoreConfirmMessage:
            'سيتم استعادة نفس كشف بضاعة أول المدة. لو فيه كشف تاني شغال لازم تلغيه الأول.',
          extraItems: [
            { id: 'excel', label: 'تصدير إلى إكسيل', onClick: onExportExcel },
            {
              id: 'clear',
              label: 'تفريغ محتويات الجدول',
              onClick: onClearAll,
              disabled: isReadOnly || isPosted,
              destructive: true,
            },
          ],
        }}
      />
      <div className="mb-3 max-w-md rounded-xl border border-border/80 bg-card p-3 shadow-sm">
        <DatePickerWithHijri
          label="تاريخ بضاعة أول المدة"
          value={date}
          onChange={() => undefined}
          disabled
          error={dateError}
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          نفس تاريخ الرصيد الافتتاحي — اليوم السابق لبداية السنة المالية
          {fiscalYearName ? ` (${fiscalYearName})` : ''}
        </p>
      </div>
    </>
  );
}
