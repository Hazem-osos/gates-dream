'use client';

import type { InputHTMLAttributes } from 'react';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import { parseDiscountType, type DiscountType } from '@/lib/invoices/discount-type';

type Props = {
  value?: number | string;
  discountType?: DiscountType | string;
  onValueCommit: (value: number) => void;
  onTypeChange: (type: DiscountType) => void;
  inputClassName?: string;
  error?: boolean;
  disabled?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'onBlur' | 'disabled'>;

export function InvoiceLineDiscountInput({
  value,
  discountType,
  onValueCommit,
  onTypeChange,
  inputClassName = '',
  error,
  disabled,
  onKeyDown,
  ...inputAttrs
}: Props) {
  const type = parseDiscountType(discountType);
  const isPercent = type === 'PERCENTAGE';

  return (
    <div className="flex h-9 min-h-9 items-stretch overflow-hidden rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] focus-within:border-[#0E78AA] focus-within:ring-2 focus-within:ring-[#0E78AA]/20">
      <TableNumberInput
        value={value}
        onValueCommit={onValueCommit}
        fractionDigits={2}
        disabled={disabled}
        className={`h-full min-h-0 flex-1 rounded-none border-0 bg-transparent text-center shadow-none focus:ring-0 ${
          error ? 'text-red-700' : ''
        } ${inputClassName}`}
        onKeyDown={onKeyDown}
        {...inputAttrs}
      />
      <button
        type="button"
        disabled={disabled}
        title={isPercent ? 'خصم نسبة مئوية — اضغط للتبديل إلى مبلغ ثابت' : 'خصم مبلغ ثابت — اضغط للتبديل إلى نسبة مئوية'}
        aria-label={isPercent ? 'نوع الخصم: نسبة مئوية' : 'نوع الخصم: مبلغ ثابت'}
        onClick={() => onTypeChange(isPercent ? 'FIXED' : 'PERCENTAGE')}
        className={`min-w-[2.25rem] shrink-0 border-r border-[#D6EAF3] px-1.5 text-xs font-bold transition-colors ${
          isPercent
            ? 'bg-[#E8F4FB] text-[#0E78AA] hover:bg-[#d5ecf8]'
            : 'bg-[#FFF4E5] text-[#B45309] hover:bg-[#ffe8c7]'
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {isPercent ? '%' : 'ج.م'}
      </button>
    </div>
  );
}
