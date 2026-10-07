'use client';

import { Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { ErpDocumentPageHeader, type ErpHeaderMenuItem } from '@/components/erp/ErpDocumentPageHeader';
import { ErpFormHeaderCard } from '@/components/erp/ErpFormHeaderCard';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { erpInputClass, erpLabelClass } from '@/components/erp';
import { compactSerialControlClass } from '@/app/components/ui/forms/formTokens';

export type DisassemblyParentOption = {
  id: string;
  serial?: string | null;
  arabicName: string;
  isAssembly?: boolean;
};

type Props = {
  docNumber: string;
  serialReadOnly?: boolean;
  serialPlaceholder?: string;
  onSerialChange?: (value: string) => void;
  isPosted: boolean;
  isCancelled?: boolean;
  parentItemId: string;
  onParentItemId: (id: string) => void;
  parentItems: DisassemblyParentOption[];
  disassemblyQuantity: number;
  onDisassemblyQuantity: (qty: number) => void;
  description: string;
  onDescription: (v: string) => void;
  date: string;
  onDate: (v: string) => void;
  sourceWarehouseId: string;
  onSourceWarehouseId: (id: string) => void;
  targetWarehouseId: string;
  onTargetWarehouseId: (id: string) => void;
  costCenterId: string;
  onCostCenterId: (id: string) => void;
  disabled?: boolean;
  explodePending?: boolean;
  canExplode?: boolean;
  onExplode: () => void;
  onSaveDraft?: () => void;
  onCancel?: () => void;
  savePending?: boolean;
  canSave?: boolean;
  onBrowseList: () => void;
  moreMenuItems: ErpHeaderMenuItem[];
};

export function ItemDisassemblyHeader({
  docNumber,
  serialReadOnly = true,
  serialPlaceholder = 'يُولَّد تلقائياً',
  onSerialChange,
  isPosted,
  isCancelled,
  parentItemId,
  onParentItemId,
  parentItems,
  disassemblyQuantity,
  onDisassemblyQuantity,
  description,
  onDescription,
  date,
  onDate,
  sourceWarehouseId,
  onSourceWarehouseId,
  targetWarehouseId,
  onTargetWarehouseId,
  costCenterId,
  onCostCenterId,
  disabled,
  explodePending,
  canExplode,
  onExplode,
  onSaveDraft,
  onCancel,
  savePending,
  canSave,
  onBrowseList,
  moreMenuItems,
}: Props) {
  const selectedParent = parentItems.find((item) => item.id === parentItemId);

  return (
    <>
      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/inventory', label: 'المخازن' },
          { label: 'العمليات' },
          { label: 'تفكيك الأصناف' },
        ]}
        title="تفكيك الأصناف"
        docNumber={docNumber || '—'}
        statusTone={isCancelled ? 'danger' : isPosted ? 'success' : 'warning'}
        statusLabel={
          isCancelled ? 'ملغي (Cancelled)' : isPosted ? 'مرحل ومثبت (Posted)' : 'غير مرحّل'
        }
        hideStandalonePost
        onSaveDraft={onSaveDraft}
        onCancel={onCancel}
        saveLabel="حفظ وترحيل التفكيك"
        savePending={savePending}
        canSave={canSave}
        onBrowseList={onBrowseList}
        browseListLabel="السابق"
        favoriteHref="/inventory/operations/disassembly"
        favoriteLabel="تفكيك الأصناف"
        extraActions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canExplode || explodePending}
            className="gap-1.5 border-primary/30 bg-primary/10 font-semibold text-primary shadow-sm hover:bg-primary/20"
            onClick={onExplode}
          >
            {explodePending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5 text-primary" />
            )}
            تحميل
          </Button>
        }
        moreMenuItems={moreMenuItems}
      />

      <ErpFormHeaderCard
        row1={
          <>
            <div>
              <label className={erpLabelClass}>المسلسل</label>
              <input
                type="text"
                readOnly={serialReadOnly || disabled}
                value={docNumber}
                placeholder={serialPlaceholder}
                onChange={(e) => onSerialChange?.(e.target.value)}
                className={compactSerialControlClass}
              />
            </div>
            <DatePickerWithHijri label="التاريخ" value={date} onChange={onDate} disabled={disabled} />
            <div>
              <label className={erpLabelClass}>الصنف المراد تفكيكه</label>
              <ItemSelect
                value={parentItemId}
                onChange={onParentItemId}
                emptyLabel="اختر الصنف المراد تفكيكه..."
                disabled={disabled}
                assemblyOnly
                enableQuickCreate={false}
                className={erpInputClass}
                menuPlacement="auto"
                fallbackLabel={selectedParent?.arabicName}
              />
            </div>
            <div>
              <label className={erpLabelClass}>كمية التفكيك</label>
              <input
                type="number"
                min={1}
                disabled={disabled}
                value={disassemblyQuantity || ''}
                onChange={(e) => onDisassemblyQuantity(Math.max(1, Number(e.target.value) || 1))}
                className={`${erpInputClass} h-9 text-center text-base font-semibold tabular-nums`}
                placeholder="الكمية"
              />
            </div>
          </>
        }
        row2={
          <>
            <div>
              <label className={erpLabelClass}>الشرح / البيان</label>
              <input
                type="text"
                disabled={disabled}
                value={description}
                onChange={(e) => onDescription(e.target.value)}
                className={erpInputClass}
                placeholder="بيان سبب تفكيك الأصناف..."
              />
            </div>
            <div>
              <label className={erpLabelClass}>مخزن صرف الصنف المفكك</label>
              <WarehouseSelect
                value={sourceWarehouseId}
                onChange={onSourceWarehouseId}
                className={erpInputClass}
                disabled={disabled}
                emptyLabel="المخزن المنصرف منه..."
              />
            </div>
            <div>
              <label className={erpLabelClass}>مخزن استلام المكونات الناتجة</label>
              <WarehouseSelect
                value={targetWarehouseId}
                onChange={onTargetWarehouseId}
                className={erpInputClass}
                disabled={disabled}
                emptyLabel="مخزن قطع الغيار والخامات..."
              />
            </div>
            <div>
              <label className={erpLabelClass}>مركز التكلفة</label>
              <CostCenterSelect
                value={costCenterId}
                onChange={onCostCenterId}
                className={erpInputClass}
                disabled={disabled}
                emptyLabel="مركز التكلفة..."
              />
            </div>
          </>
        }
      />
    </>
  );
}
