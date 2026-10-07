'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import {
  ManufacturingPageChrome,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgTdIdx,
  mfgThClass,
  mfgThIdx,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';
import { Button, compactControlClass } from '@/components/ui';
import { compactNumericControlClass } from '@/app/components/ui/forms/formTokens';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

type AlternativeRow = {
  id?: string;
  alternativeItemId: string;
  quantity: string;
};

type ApiLine = {
  id: string;
  alternativeItemId: string;
  quantity: number;
  alternativeItem: { arabicName: string; serial?: string | null };
};

function emptyLine(): AlternativeRow {
  return { alternativeItemId: '', quantity: '1' };
}

export default function ItemAlternativesDefinitionPage() {
  useBackendReachability();
  const invalidateQuery = useInvalidateQuery();
  const [itemId, setItemId] = useState('');
  const [lines, setLines] = useState<AlternativeRow[]>([emptyLine()]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data, isLoading } = useApiQuery<ApiLine[]>(
    ['item-alternatives-def', itemId],
    itemId ? `/manufacturing/item-alternatives/by-item/${itemId}` : '',
    undefined,
    { enabled: Boolean(itemId) }
  );

  useEffect(() => {
    if (!itemId) {
      setLines([emptyLine()]);
      return;
    }
    const apiLines = data?.data;
    if (!apiLines) return;
    if (!apiLines.length) {
      setLines([emptyLine()]);
      return;
    }
    setLines(
      apiLines.map((row) => ({
        id: row.id,
        alternativeItemId: row.alternativeItemId,
        quantity: String(row.quantity),
      }))
    );
  }, [itemId, data?.data]);

  const saveMutation = useApiMutation<ApiLine[], { lines: { alternativeItemId: string; quantity: number }[] }>(
    itemId ? `/manufacturing/item-alternatives/by-item/${itemId}` : '',
    'PUT'
  );

  const filledLines = useMemo(
    () => lines.filter((l) => l.alternativeItemId.trim() && Number(l.quantity) > 0),
    [lines]
  );

  const handleSave = async () => {
    if (!itemId) {
      setError('اختر الصنف أولاً');
      return;
    }
    setError('');
    setSuccess('');
    const payload = filledLines.map((line, index) => ({
      alternativeItemId: line.alternativeItemId,
      quantity: Number(line.quantity),
      lineOrder: index + 1,
    }));
    for (const line of payload) {
      if (line.alternativeItemId === itemId) {
        setError('لا يمكن أن يكون البديل هو نفس الصنف');
        return;
      }
    }
    try {
      await saveMutation.mutateAsync({ lines: payload });
      setSuccess('تم حفظ بدائل الصنف');
      void invalidateQuery(['item-alternatives', itemId]);
      void invalidateQuery(['item-alternatives-counts']);
      void invalidateQuery(['item-alternatives-def', itemId]);
    } catch (err) {
      setError((err as ApiError).message || 'تعذر الحفظ');
    }
  };

  return (
    <ManufacturingPageChrome
      title="تعريف البدائل"
      statusLabel={itemId ? 'تعديل' : 'جديد'}
      favoriteHref="/manufacturing/creations/item-alternatives"
      onSave={() => void handleSave()}
      savePending={saveMutation.isPending}
      canSave={Boolean(itemId) && !saveMutation.isPending}
      saveLabel="حفظ البدائل"
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <div className="mb-4 max-w-xl">
        <label className="mb-1 block text-xs font-medium text-slate-600">الصنف</label>
        <ItemSelect
          value={itemId}
          onChange={setItemId}
          emptyLabel="اختر الصنف لتعريف بدائله…"
          className={compactControlClass}
          enableQuickCreate={false}
        />
      </div>

      <MfgTableCard
        title={itemId ? 'بدائل الصنف' : 'اختر صنفاً أولاً'}
        toolbar={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!itemId}
            className="gap-1.5"
            onClick={() => setLines((p) => [...p, emptyLine()])}
          >
            <Plus className="h-4 w-4" />
            إضافة بديل
          </Button>
        }
      >
        <table className={cn(mfgTableClass, 'table-fixed')}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={mfgThIdx}>م</th>
              <th className={mfgThClass}>صنف البديل</th>
              <th className={cn(mfgThClass, 'w-32 text-center')}>الكمية</th>
              <th className={cn(mfgThClass, 'w-12')} />
            </tr>
          </thead>
          <tbody>
            {!itemId ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  اختر الصنف من الأعلى ثم أضف البدائل وكمياتها.
                </td>
              </tr>
            ) : isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  جاري التحميل…
                </td>
              </tr>
            ) : (
              lines.map((line, index) => (
                <tr key={index} className={mfgTrClass}>
                  <td className={mfgTdIdx}>{index + 1}</td>
                  <td className={mfgTdClass}>
                    <ItemSelect
                      value={line.alternativeItemId}
                      onChange={(id) => {
                        const next = [...lines];
                        next[index] = { ...next[index], alternativeItemId: id };
                        setLines(next);
                      }}
                      emptyLabel="اختر البديل"
                      className={cn(compactControlClass, 'h-8 text-sm')}
                      enableQuickCreate={false}
                      disabled={!itemId}
                    />
                  </td>
                  <td className={mfgTdClass}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      disabled={!itemId}
                      className={cn(compactNumericControlClass, 'mx-auto max-w-[8rem] text-center')}
                      value={line.quantity}
                      onChange={(e) => {
                        const next = [...lines];
                        next[index] = { ...next[index], quantity: e.target.value };
                        setLines(next);
                      }}
                    />
                  </td>
                  <td className={mfgTdClass}>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-700"
                      title="حذف"
                      onClick={() => {
                        if (lines.length <= 1) setLines([emptyLine()]);
                        else setLines(lines.filter((_, i) => i !== index));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </MfgTableCard>
    </ManufacturingPageChrome>
  );
}
