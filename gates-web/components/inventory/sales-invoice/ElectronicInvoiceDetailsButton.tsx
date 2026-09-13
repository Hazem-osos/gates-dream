'use client';

import { useState } from 'react';
import { FileText, X } from 'lucide-react';
import { useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { Button } from '@/components/ui';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import type { SalesInvoiceFormValues } from '@/lib/validation/inventory.schema';
import { erpInputClass, erpLabelClass } from '@/components/erp';

type Props = {
  control: Control<SalesInvoiceFormValues>;
  register: UseFormRegister<SalesInvoiceFormValues>;
  disabled?: boolean;
  className?: string;
};

export function ElectronicInvoiceDetailsButton({ control, register, disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const salesOrderNumber = useWatch({ control, name: 'salesOrderNumber' });
  const purchaseOrderNumber = useWatch({ control, name: 'purchaseOrderNumber' });
  const filledCount = [salesOrderNumber, purchaseOrderNumber].filter((v) => String(v ?? '').trim()).length;

  return (
    <>
      <div className={className ?? 'inline-flex'}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2 font-semibold"
          onClick={() => setOpen(true)}
        >
          <FileText className="h-4 w-4" aria-hidden />
          تفاصيل الفاتورة الإلكترونية
          {filledCount > 0 ? (
            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#0E78AA]/15 px-1.5 text-xs text-[#094C6B]">
              {filledCount}
            </span>
          ) : null}
        </Button>
      </div>

      <CenteredOverlay
        open={open}
        onClose={() => setOpen(false)}
        width="md"
        labelledBy="einvoice-details-title"
      >
        <div className="relative shrink-0 bg-gradient-to-l from-[#0E78AA] to-[#1E88E5] px-5 py-4">
          <h2 id="einvoice-details-title" className="text-center text-lg font-bold text-white">
            تفاصيل الفاتورة الإلكترونية
          </h2>
          <button
            type="button"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/90 hover:bg-white/10 hover:text-white"
            onClick={() => setOpen(false)}
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-5">
          <p className="text-sm text-slate-600">تُحفظ مع الفاتورة عند الإغلاق — بدون إعادة تحميل.</p>
          <div>
            <label className={erpLabelClass} htmlFor="salesOrderNumber">
              رقم أمر البيع
            </label>
            <input
              id="salesOrderNumber"
              className={erpInputClass}
              placeholder="مثلاً SO-1024"
              disabled={disabled}
              {...register('salesOrderNumber')}
            />
          </div>
          <div>
            <label className={erpLabelClass} htmlFor="salesOrderDescription">
              وصف أمر البيع
            </label>
            <textarea
              id="salesOrderDescription"
              className={`${erpInputClass} h-auto min-h-[88px] py-2`}
              placeholder="وصف أمر البيع"
              disabled={disabled}
              {...register('salesOrderDescription')}
            />
          </div>
          <div>
            <label className={erpLabelClass} htmlFor="purchaseOrderNumber">
              رقم أمر الشراء
            </label>
            <input
              id="purchaseOrderNumber"
              className={erpInputClass}
              placeholder="مثلاً PO-88"
              disabled={disabled}
              {...register('purchaseOrderNumber')}
            />
          </div>
          <div>
            <label className={erpLabelClass} htmlFor="purchaseOrderDescription">
              وصف أمر الشراء
            </label>
            <textarea
              id="purchaseOrderDescription"
              className={`${erpInputClass} h-auto min-h-[88px] py-2`}
              placeholder="وصف أمر الشراء"
              disabled={disabled}
              {...register('purchaseOrderDescription')}
            />
          </div>
        </div>
        <div className="shrink-0 border-t border-[#E6F0F7] p-4 text-left">
          <Button type="button" variant="primary" size="sm" onClick={() => setOpen(false)}>
            تم
          </Button>
        </div>
      </CenteredOverlay>
    </>
  );
}
