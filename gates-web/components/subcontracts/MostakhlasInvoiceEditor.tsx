'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/Switch';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { toast } from '@/lib/feedback/toast';
import { queryKeys } from '@/lib/query/query-keys';
import { calculateLiveDraft, nextInvoiceSequence } from '@/lib/subcontracts/calculate-draft';
import { formatEgp, formatPercent, formatQty, toDateInput, toMoney } from '@/lib/subcontracts/money';
import type { SubcontractDetail, SubcontractInvoice } from '@/lib/subcontracts/types';
import { InvoiceFinancialBreakdown } from './InvoiceFinancialBreakdown';

type DraftPayload = {
  invoiceId?: string;
  periodStartDate: string;
  periodEndDate: string;
  applyEarlyPaymentDiscount: boolean;
  items: Array<{ boqItemId: string; currentQuantity: number }>;
};

export function MostakhlasInvoiceEditor({
  subcontract,
  invoice,
}: {
  subcontract: SubcontractDetail;
  invoice?: SubcontractInvoice;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sequence = invoice?.sequenceNumber ?? nextInvoiceSequence(subcontract);
  const [periodStart, setPeriodStart] = useState(toDateInput(invoice?.periodStartDate) || new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(invoice?.periodEndDate) || new Date().toISOString().slice(0, 10));
  const [earlyPay, setEarlyPay] = useState(toMoney(invoice?.earlyPaymentDiscountDeduction) > 0);
  const [highlight, setHighlight] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const item of invoice?.items ?? []) {
      seed[item.subcontractBOQItemId] = toMoney(item.currentQuantity);
    }
    return seed;
  });

  useEffect(() => {
    if (!invoice) return;
    setPeriodStart(toDateInput(invoice.periodStartDate));
    setPeriodEnd(toDateInput(invoice.periodEndDate));
    setEarlyPay(toMoney(invoice.earlyPaymentDiscountDeduction) > 0);
    const seed: Record<string, number> = {};
    for (const item of invoice.items ?? []) {
      seed[item.subcontractBOQItemId] = toMoney(item.currentQuantity);
    }
    setQty(seed);
  }, [invoice]);

  const live = useMemo(
    () =>
      calculateLiveDraft(subcontract, qty, {
        applyEarlyPaymentDiscount: earlyPay,
        excludeInvoiceId: invoice?.id,
      }),
    [subcontract, qty, earlyPay, invoice?.id]
  );

  const payload = (): DraftPayload => ({
    invoiceId: invoice?.id,
    periodStartDate: periodStart,
    periodEndDate: periodEnd,
    applyEarlyPaymentDiscount: earlyPay,
    items: live.lines
      .filter((line) => line.currentQuantity > 0)
      .map((line) => ({ boqItemId: line.subcontractBOQItemId, currentQuantity: line.currentQuantity })),
  });

  const saveDraft = useMutation({
    mutationFn: async (next: DraftPayload) =>
      apiClient.post<SubcontractInvoice>(`/subcontracts/${subcontract.id}/invoices/draft`, next),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.subcontracts.detail(subcontract.id) });
      const previous = queryClient.getQueryData(queryKeys.subcontracts.detail(subcontract.id));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.subcontracts.detail(subcontract.id), ctx.previous);
      }
    },
    onSuccess: () => {
      notifyApiSuccess('تم حفظ مسودة المستخلص');
      void queryClient.invalidateQueries({ queryKey: queryKeys.subcontracts.all });
    },
  });

  const submitSite = useMutation({
    mutationFn: async (invoiceId: string) =>
      apiClient.patch(`/subcontracts/${subcontract.id}/invoices/${invoiceId}/submit`, {}),
    onSuccess: () => {
      notifyApiSuccess('تم تقديم المستخلص لمهندس الموقع');
      void queryClient.invalidateQueries({ queryKey: queryKeys.subcontracts.all });
      router.push(`/subcontracts/${subcontract.id}/invoices/${invoice?.id ?? ''}`);
    },
  });

  const onSaveDraft = () => {
    const next = payload();
    if (!next.items.length) {
      toast.error('أدخل كمية حالية لبند واحد على الأقل');
      return;
    }
    if (live.lines.some((line) => line.exceedsMax)) {
      toast.error('كمية تراكمية تتجاوز الحد الأقصى المسموح للبند');
      return;
    }
    saveDraft.mutate(next, {
      onSuccess: (res) => {
        const saved = res.data;
        if (saved?.id && !invoice) {
          router.replace(`/subcontracts/${subcontract.id}/invoices/${saved.id}/edit`);
        }
      },
    });
  };

  const onSubmit = async () => {
    const next = payload();
    if (!next.items.length) {
      toast.error('أدخل كمية حالية لبند واحد على الأقل');
      return;
    }
    const saved = await saveDraft.mutateAsync(next);
    const invoiceId = saved.data?.id ?? invoice?.id;
    if (!invoiceId) return;
    await submitSite.mutateAsync(invoiceId);
    router.push(`/subcontracts/${subcontract.id}/invoices/${invoiceId}`);
  };

  if (!subcontract.boqItems?.length) {
    return (
      <EmptyState
        title="لا توجد بنود مقايسة"
        description="أضف بنود BOQ من صفحة العقد قبل إنشاء مستخلص."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#D6EAF3] bg-white p-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">رقم التسلسل</span>
            <Input readOnly value={`${subcontract.subcontractNumber}-${String(sequence).padStart(5, '0')}`} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">بداية الفترة</span>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">نهاية الفترة</span>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </label>
          <div className="sm:col-span-3">
            <Switch
              checked={earlyPay}
              onCheckedChange={setEarlyPay}
              label="تطبيق خصم تعجيل الصرف"
              description={`نسبة العقد ${formatPercent(toMoney(subcontract.earlyPaymentDiscountRate) * 100)}`}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white">
          <table className="w-full min-w-[980px] text-center text-sm">
            <thead>
              <tr className="bg-[#0E78AA] text-white">
                <th className="px-2 py-3">البند</th>
                <th className="px-2 py-3">الوصف</th>
                <th className="px-2 py-3">سابق</th>
                <th className="px-2 py-3">حالي</th>
                <th className="px-2 py-3">تراكمي</th>
                <th className="px-2 py-3">الإنجاز</th>
                <th className="px-2 py-3">قيمة الفترة</th>
              </tr>
            </thead>
            <tbody>
              {live.lines.map((line, index) => (
                <tr key={line.subcontractBOQItemId} className={index % 2 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                  <td className="px-2 py-2 font-semibold">{line.itemCode}</td>
                  <td className="px-2 py-2 text-right">
                    <div>{line.descriptionAr}</div>
                    {line.approachingMax || line.exceedsMax ? (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                        <AlertTriangle className="h-3 w-3" />
                        {line.exceedsMax ? 'تجاوز الحد الأقصى' : 'اقتراب من الحد الأقصى'}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 tabular-nums text-slate-500">{formatQty(line.previousQuantity)}</td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      className="mx-auto max-w-28 text-center"
                      value={qty[line.subcontractBOQItemId] ?? ''}
                      onChange={(e) =>
                        setQty((prev) => ({
                          ...prev,
                          [line.subcontractBOQItemId]: toMoney(e.target.value),
                        }))
                      }
                    />
                  </td>
                  <td className="px-2 py-2 tabular-nums">{formatQty(line.totalCumulativeQuantity)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatPercent(line.completionPercentage)}</td>
                  <td className="px-2 py-2 tabular-nums font-semibold">{formatEgp(line.totalCurrentAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" isLoading={saveDraft.isPending} onClick={onSaveDraft}>
            حفظ المسودة
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setHighlight(true);
              window.setTimeout(() => setHighlight(false), 1400);
            }}
          >
            احتساب ومعاينة
          </Button>
          <Button isLoading={submitSite.isPending || saveDraft.isPending} onClick={() => void onSubmit()}>
            تقديم لمهندس الموقع
          </Button>
        </div>
      </div>

      <div className="xl:sticky xl:top-4 xl:self-start">
        <InvoiceFinancialBreakdown live={live} highlight={highlight} />
      </div>
    </div>
  );
}
