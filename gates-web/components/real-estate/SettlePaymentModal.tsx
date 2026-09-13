'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { formatEgp, toMoney } from '@/lib/real-estate/format';
import type { PaymentAllocation, PaymentMethod, PostDatedCheque, UnitInstallment } from '@/lib/real-estate/types';

export function SettlePaymentModal({
  open,
  installment,
  cheques,
  onClose,
  onSettled,
}: {
  open: boolean;
  installment: UnitInstallment | null;
  cheques: PostDatedCheque[];
  onClose: () => void;
  onSettled?: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [allocation, setAllocation] = useState<PaymentAllocation>('LATE_FEES_FIRST');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [pdcChequeId, setPdcChequeId] = useState('');

  const max = installment ? toMoney(installment.balance) + toMoney(installment.accumulatedLateFee) : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!installment) throw new Error('لا يوجد قسط');
      const paymentAmount = toMoney(amount);
      if (paymentAmount <= 0 || paymentAmount > max + 0.01) {
        throw new Error('المبلغ يجب أن يكون أكبر من صفر ولا يتجاوز المستحق');
      }
      return apiClient.post(`/real-estate/installments/${installment.id}/settle`, {
        paymentAmount,
        paymentDate,
        allocation,
        paymentMethod: method,
        pdcChequeId: method === 'LINKED_PDC' ? pdcChequeId || undefined : undefined,
      });
    },
    onSuccess: () => {
      notifyApiSuccess('تم تسوية القسط');
      setAmount('');
      onSettled?.();
      onClose();
    },
  });

  if (!open || !installment) return null;

  const advancedFilledCount =
    (allocation !== 'LATE_FEES_FIRST' ? 1 : 0) + (method === 'LINKED_PDC' && pdcChequeId ? 1 : 0);

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="p-5 pb-0">
          <h2 className="mb-2 text-lg font-bold text-[#0E79AA]">تسوية سداد القسط #{installment.installmentNumber}</h2>
          <p className="mb-4 text-sm text-slate-600">
            الرصيد {formatEgp(installment.balance)} + غرامة {formatEgp(installment.accumulatedLateFee)} = حد أقصى {formatEgp(max)}
          </p>
          <FormSectionCard title="البيانات الأساسية" subtitle="مبلغ السداد وتاريخه وطريقته" icon={Wallet} className="mb-3">
            <CompactFormField
              label="مبلغ السداد"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <CompactFormField
              label="تاريخ السداد"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
            <CompactFormField label="طريقة السداد">
              <select
                className={compactControlClass}
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                <option value="CASH">نقدي</option>
                <option value="BANK_TRANSFER">تحويل بنكي</option>
                <option value="LINKED_PDC">شيك آجل مرتبط</option>
              </select>
            </CompactFormField>
          </FormSectionCard>
          <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount} defaultOpen={method === 'LINKED_PDC'}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CompactFormField label="ترتيب التخصيص">
                <select
                  className={compactControlClass}
                  value={allocation}
                  onChange={(e) => setAllocation(e.target.value as PaymentAllocation)}
                >
                  <option value="LATE_FEES_FIRST">الغرامات أولاً</option>
                  <option value="PRINCIPAL_FIRST">الأصل أولاً</option>
                </select>
              </CompactFormField>
              {method === 'LINKED_PDC' ? (
                <CompactFormField label="الشيك">
                  <select
                    className={compactControlClass}
                    value={pdcChequeId}
                    onChange={(e) => setPdcChequeId(e.target.value)}
                  >
                    <option value="">اختر شيكًا</option>
                    {cheques.map((cheque) => (
                      <option key={cheque.id} value={cheque.id}>
                        {cheque.chequeNumber} — {formatEgp(cheque.amount)}
                      </option>
                    ))}
                  </select>
                </CompactFormField>
              ) : null}
            </div>
          </AdvancedFieldsSection>
          {mutation.isError ? (
            <p className="mb-3 text-sm text-red-600">{mutation.error instanceof Error ? mutation.error.message : 'تعذر التسوية'}</p>
          ) : null}
        </div>
        <FormStickyFooter
          onCancel={onClose}
          onSave={() => mutation.mutate()}
          saveText="تأكيد التسوية"
          cancelText="إلغاء"
          saveLoading={mutation.isPending}
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </div>
  );
}
