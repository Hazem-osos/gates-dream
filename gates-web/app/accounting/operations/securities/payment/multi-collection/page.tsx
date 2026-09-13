'use client';

import React, { useState, useRef } from 'react';
import OuterCard from '@/components/OuterCard';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  securitiesMultiCollectionFormSchema,
  type SecuritiesMultiCollectionFormInput,
} from '@/lib/validation/accounting.schema';
import type { ApiError } from '@/lib/api/types';

interface SecuritiesReceipt {
  id: string;
  serial?: string;
  receiptNumber?: string;
  date: string;
  hijriDate?: string;
  description?: string;
  amount: number;
  account?: {
    code: string;
    arabicName: string;
  };
  costCenter?: {
    code: string;
    arabicName: string;
  };
}

export default function MultiCollectionPage() {
  const invalidateQuery = useInvalidateQuery();
  const queueRef = useRef<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { watch, setValue, getValues, handleSubmit, formState: { errors } } =
    useForm<SecuritiesMultiCollectionFormInput>({
      resolver: zodResolver(securitiesMultiCollectionFormSchema) as Resolver<SecuritiesMultiCollectionFormInput>,
      defaultValues: { receiptIds: [] },
      mode: 'onTouched',
    });

  const receiptIds = watch('receiptIds');

  const { data: receiptsResponse, isLoading } = useApiQuery<SecuritiesReceipt[]>(
    ['securities-receipts', 'multi-collection'],
    '/accounting/securities-receipts',
    { limit: 100, isPosted: false }
  );
  const receipts = receiptsResponse?.data || [];

  const processNext = () => {
    const q = queueRef.current;
    if (q.length === 0) {
      setSuccess('تم تحصيل جميع الأوراق بنجاح');
      invalidateQuery(['securities-receipts']);
      invalidateQuery(['securities-receipts', 'multi-collection']);
      setValue('receiptIds', []);
      return;
    }
    const id = q[0];
    queueRef.current = q.slice(1);
    collectionMutation.mutate({
      id,
      isPosted: true,
    });
  };

  const collectionMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/accounting/securities-receipts',
    'PUT',
    {
      onSuccess: () => {
        processNext();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء التحصيل');
      },
    }
  );

  const loading = collectionMutation.isPending;

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

  const rows = receipts.map((receipt) => ({
    id: receipt.id,
    desc: receipt.description || '',
    date: receipt.date ? new Date(receipt.date).toLocaleDateString('ar-EG') : '',
    hijri: receipt.hijriDate || '',
    account: receipt.account ? `${receipt.account.code} - ${receipt.account.arabicName}` : '',
    costCenter: receipt.costCenter ? `${receipt.costCenter.code} - ${receipt.costCenter.arabicName}` : '',
    amount: receipt.amount?.toFixed(2) || '0.00',
    commission: '0.00',
  }));

  const totalAmount = receipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);

  return (
    <div className="p-8 flex flex-col items-center min-h-[60vh] w-full bg-[#F6FBFD]" style={{ direction: 'rtl' }}>
      <div className="w-full max-w-6xl mb-6">
        <div className="text-right">
          <h1 className="text-xl font-bold text-[#0E78AA] mb-2">تحصيل متعدد</h1>
          <div className="h-1 bg-sky-700 rounded w-full"></div>
        </div>
      </div>
      <OuterCard>
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
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">حساب</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">مركز التكلفة</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">المبلغ</th>
                <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md rounded-tl-2xl">العمولة</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-gray-500">جاري التحميل...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-gray-500">لا توجد أوراق للتحصيل</td>
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
                    <td className="py-2 px-2 text-black">{row.costCenter}</td>
                    <td className="py-2 px-2 text-black">{row.amount}</td>
                    <td className="py-2 px-2 text-black">{row.commission}</td>
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
            {totalAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              onClick={() =>
                void handleSubmit((data) => {
                  setError('');
                  setSuccess('');
                  queueRef.current = [...data.receiptIds];
                  processNext();
                })()
              }
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
