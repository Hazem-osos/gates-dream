'use client';

import { Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { ErpDocumentPageHeader, type ErpHeaderMenuItem } from '@/components/erp/ErpDocumentPageHeader';
import { ErpFormHeaderCard } from '@/components/erp/ErpFormHeaderCard';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { erpInputClass, erpLabelClass } from '@/components/erp';

export type DisassemblyParentOption = {
  id: string;
  serial?: string | null;
  arabicName: string;
  isAssembly?: boolean;
};

type Props = {
  docNumber: string;
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
  const composite = parentItems.filter((item) => item.isAssembly);
  const options = (composite.length ? composite : parentItems).map((item) => ({
    value: item.id,
    label: `${item.arabicName}${item.serial ? ` (${item.serial})` : ''}`,
  }));

  return (
    <>
      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/inventory', label: 'المخازن' },
          { label: 'العمليات' },
          { label: 'تفكيك الأصناف' },
        ]}
        title="تفكيك الأصناف"
        docNumber={docNumber || 'DIS-XXXX'}
        statusTone={isCancelled ? 'danger' : isPosted ? 'success' : 'warning'}
        statusLabel={
          isCancelled ? 'ملغي (Cancelled)' : isPosted ? 'مرحل ومثبت (Posted)' : 'مسودة (Draft)'
        }
        hideStandalonePost
        onSaveDraft={onSaveDraft}
        onCancel={onCancel}
        saveLabel="حفظ أمر التفكيك"
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
            disabled={!canExplode || explodePending || disabled}
            className="gap-1.5 border-primary/30 bg-primary/10 font-semibold text-primary shadow-sm hover:bg-primary/20"
            onClick={onExplode}
          >
            {explodePending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5 text-primary" />
            )}
            تحليل
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
                readOnly
                value={docNumber}
                placeholder="DIS-2026-XXXX"
                className={erpInputClass}
              />
            </div>
            <DatePickerWithHijri label="التاريخ" value={date} onChange={onDate} disabled={disabled} />
            <div>
              <label className={erpLabelClass}>الصنف المراد تفكيكه</label>
              <SearchableCombobox
                value={parentItemId}
                onChange={onParentItemId}
                options={options}
                placeholder="اختر الصنف التجميعي لتفكيكه..."
                disabled={disabled}
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
                className={`${erpInputClass} text-center font-mono font-bold`}
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
                excludeIds={targetWarehouseId ? [targetWarehouseId] : undefined}
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
                excludeIds={sourceWarehouseId ? [sourceWarehouseId] : undefined}
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
