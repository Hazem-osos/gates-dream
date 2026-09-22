'use client';

import React, { useMemo, useState } from 'react';
import OuterCard from '@/components/OuterCard';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  securitiesMultiCollectionFormSchema,
  type SecuritiesMultiCollectionFormInput,
} from '@/lib/validation/accounting.schema';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { apiClient } from '@/lib/api/client';
import { SECURITIES_PAPER_CASES } from '@/components/accounting/securities/securities-paper-status';

interface SecuritiesPayment {
  id: string;
  serial?: string;
  paymentNumber?: string;
  securityNumber?: string;
  date: string;
  hijriDate?: string;
  description?: string;
  amount: number | string;
  paperCase?: string | null;
  isCancelled?: boolean;
  supplier?: { code?: string; arabicName?: string };
  customer?: { code?: string; arabicName?: string };
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function money(value: number) {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MultiCollectionPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { watch, setValue, getValues, handleSubmit, formState: { errors } } =
    useForm<SecuritiesMultiCollectionFormInput>({
      resolver: zodResolver(securitiesMultiCollectionFormSchema) as Resolver<SecuritiesMultiCollectionFormInput>,
      defaultValues: { receiptIds: [], accountId: '', date: todayIso() },
      mode: 'onTouched',
    });

  const receiptIds = watch('receiptIds');
  const accountId = watch('accountId');
  const collectionDate = watch('date');

  const { data: paymentsResponse, isLoading } = useApiQuery<SecuritiesPayment[]>(
    ['securities-payments', 'multi-collection'],
    '/accounting/securities-payments',
    { limit: 200 }
  );
  const payments = useMemo(
    () =>
      (paymentsResponse?.data || []).filter(
        (row) =>
          !row.isCancelled &&
          (row.paperCase || SECURITIES_PAPER_CASES.ISSUED) === SECURITIES_PAPER_CASES.ISSUED
      ),
    [paymentsResponse?.data]
  );

  const toggleReceipt = (id: string) => {
    const cur = getValues('receiptIds');
    if (cur.includes(id)) {
      setValue(
        'receiptIds',
        cur.filter((x) => x !== id),
        { shouldValidate: true }
      );
    } else {
      setValue('receiptIds', [...cur, id], { shouldValidate: true });
    }
  };

  const rows = payments.map((payment) => {
    const party = payment.supplier || payment.customer;
    return {
      id: payment.id,
      desc: payment.description || payment.securityNumber || '',
      date: payment.date ? new Date(payment.date).toLocaleDateString('ar-EG') : '',
      hijri: payment.hijriDate || '',
      account: party ? `${party.code || ''} - ${party.arabicName || ''}`.replace(/^ - /, '') : '',
      amount: Number(payment.amount) || 0,
    };
  });

  const selectedRows = rows.filter((row) => receiptIds.includes(row.id));
  const totalAmount = selectedRows.reduce((sum, row) => sum + row.amount, 0);

  const collectSelected = async (data: SecuritiesMultiCollectionFormInput) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      for (const id of data.receiptIds) {
        await apiClient.post(`/accounting/securities-payments/${id}/collect`, {
          accountId: data.accountId,
          date: data.date,
        });
      }
      setSuccess('تم تحصيل الأوراق المحددة');
      invalidateQuery(['securities-payments']);
      invalidateQuery(['securities-payments', 'multi-collection']);
      invalidateQuery(['journal-entry']);
      setValue('receiptIds', []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء التحصيل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 flex flex-col items-center min-h-[60vh] w-full bg-[#F6FBFD]" style={{ direction: 'rtl' }}>
      <div className="w-full max-w-6xl mb-6">
        <div className="text-right">
          <h1 className="text-xl font-bold text-[#0E78AA] mb-2">تحصيل متعدد</h1>
          <div className="h-1 bg-sky-700 rounded w-full"></div>
        </div>
      </div>
      <OuterCard>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <DatePickerWithHijri
            label="تاريخ التحصيل"
            value={collectionDate}
            onChange={(value) => setValue('date', value, { shouldValidate: true })}
            required
          />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">حساب البنك</label>
            <AccountSelect
              value={accountId}
              onChange={(value) => setValue('accountId', value, { shouldValidate: true })}
              leafOnly
              bankOnly
              emptyLabel="اختر حساب البنك"
              placeholder="اختر حساب البنك"
            />
            {errors.accountId ? (
              <p className="text-red-600 text-sm text-right">{errors.accountId.message}</p>
            ) : null}
          </div>
        </div>
        {errors.date ? <p className="text-red-600 text-sm text-right mb-2">{errors.date.message}</p> : null}
        {errors.receiptIds && (
          <p className="text-red-600 text-sm text-right mb-2">{errors.receiptIds.message}</p>
        )}
        <div className="overflow-x-auto rounded-2xl">
          <table className="min-w-full text-center border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20 rounded-tr-2xl">م</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">الشرح</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">التاريخ</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">هجري</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">الطرف</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md rounded-tl-2xl">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">جاري التحميل...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">لا توجد أوراق للتحصيل</td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleReceipt(row.id);
                      }
                    }}
                    className={`${idx % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'} ${receiptIds.includes(row.id) ? 'ring-2 ring-[#0E78AA]' : ''} cursor-pointer`}
                    onClick={() => toggleReceipt(row.id)}
                  >
                    <td className="py-2 px-2 font-bold text-black">{idx + 1}</td>
                    <td className="py-2 px-2 text-black">{row.desc}</td>
                    <td className="py-2 px-2 text-black">{row.date}</td>
                    <td className="py-2 px-2 text-black">{row.hijri}</td>
                    <td className="py-2 px-2 text-black">{row.account}</td>
                    <td className="py-2 px-2 text-black">{money(row.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {error && <ErrorToast message={error} onClose={() => setError('')} />}
        {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

        <div className="flex w-full mt-6 gap-2">
          <div className="flex-1 bg-[#E8F7ED] text-[#25BB64] text-center font-bold py-3 rounded-l-xl border border-[#C6EAD6]">
            {money(totalAmount)}
          </div>
          <div className="flex-1 bg-[#E8F7ED] text-[#25BB64] text-center font-bold py-3 rounded-r-xl border border-[#C6EAD6]">الإجمالي</div>
        </div>
        <div className="flex justify-between items-center mt-8 w-full">
          <div className="flex gap-4">
            <button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-12 py-2 rounded-lg"
              onClick={() => {
                setValue('receiptIds', []);
                setError('');
                setSuccess('');
              }}
            >
              تراجع
            </button>
            <button
              type="button"
              className="bg-green-500 hover:bg-green-600 text-white font-bold px-12 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={() => void handleSubmit((data) => void collectSelected(data))()}
            >
              {loading ? 'جاري التحصيل...' : 'حفظ'}
            </button>
          </div>
          <button type="button" className="w-10 h-10 flex items-center justify-center bg-[#0E78AA] rounded-lg text-white text-2xl font-bold">?</button>
        </div>
      </OuterCard>
    </div>
  );
}
