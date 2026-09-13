'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { erpInputClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { apiClient } from '@/lib/api/client';

type Props = {
  disabled?: boolean;
  onLoaded: (order: Record<string, unknown>) => void;
  onError: (message: string) => void;
};

export function ReceiptOrderReferenceInputs({ disabled, onLoaded, onError }: Props) {
  const [code, setCode] = useState('');
  const [number, setNumber] = useState('');
  const [pending, setPending] = useState(false);

  const load = async () => {
    if (!code.trim() && !number.trim()) {
      onError('أدخل كود أو رقم أمر التوريد');
      return;
    }
    setPending(true);
    try {
      const res = await apiClient.get<Record<string, unknown>>('/orders/receipt-orders', {
        code: code.trim() || undefined,
        number: number.trim() || undefined,
      } as never);
      const order = res.data;
      if (!order?.id) {
        onError('أمر التوريد غير موجود');
        return;
      }
      onLoaded(order);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'تعذر تحميل أمر التوريد');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2">
      <div>
        <label className={erpLabelClass}>كود / سلسلة أمر التوريد</label>
        <input
          className={erpInputClass}
          disabled={disabled}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="مثال: RO-2026"
        />
      </div>
      <div>
        <label className={erpLabelClass}>رقم أمر التوريد</label>
        <div className="flex gap-2">
          <input
            className={erpInputClass}
            disabled={disabled}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="الرقم"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void load();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={disabled || pending} onClick={() => void load()}>
            <Search className="h-3.5 w-3.5" />
            {pending ? '...' : 'تحميل أمر التوريد'}
          </Button>
        </div>
      </div>
    </div>
  );
}
