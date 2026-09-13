'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ExternalLink, Loader2, PencilLine, Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { editHrefForActionType, storeAiTransactionDraft } from '@/lib/ai/ai-draft-storage';
import { acknowledgePendingAction, commitActionCard, extractDraftPayload } from '@/lib/ai/commit-action-card';
import { createOcrMissingItem } from '@/lib/ai/ingest-purchase-invoice';
import { formatMoneyAr } from '@/lib/formatMoney';
import type { AiPendingAction } from '@/lib/ai/types';

export type InlineActionCard = {
  actionId?: string;
  actionType: string;
  titleAr: string;
  summary?: {
    partyName?: string;
    warehouseName?: string;
    totalAmount?: number;
    itemsCount?: number;
    subtotal?: number;
    taxAmount?: number;
    netAmount?: number;
    invoiceNumber?: string;
    taxNumber?: string;
    supplierConfidence?: number;
    supplierMatched?: boolean;
  };
  draftPayload?: Record<string, unknown>;
  previewLines?: Array<{
    name: string;
    quantity?: number;
    unitPrice?: number;
    total: number;
    rawItemName?: string;
    needsCreation?: boolean;
    matchConfidence?: number;
  }>;
};

function confidenceBadge(confidence?: number, matched?: boolean) {
  if (matched === false || (confidence != null && confidence < 55)) {
    return { label: 'غير مطابق', className: 'bg-rose-100 text-rose-800' };
  }
  const score = confidence ?? 0;
  if (score >= 80) return { label: `ثقة ${score}%`, className: 'bg-emerald-100 text-emerald-800' };
  if (score >= 55) return { label: `ثقة ${score}%`, className: 'bg-amber-100 text-amber-800' };
  return { label: 'غير مطابق', className: 'bg-rose-100 text-rose-800' };
}

const DRAFT_TYPES = new Set([
  'DRAFT_SALES_INVOICE',
  'DRAFT_PURCHASE_INVOICE',
  'DRAFT_PAYMENT_VOUCHER',
  'DRAFT_STOCK_ISSUE',
  'CREATE_INVOICE',
]);

function money(value?: number, currency = 'EGP') {
  if (value == null) return '—';
  return `${formatMoneyAr(value)} ${currency}`;
}

export function AiActionCard({
  action,
  card,
  onChanged,
}: {
  action?: AiPendingAction;
  card?: InlineActionCard;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'confirm' | 'reject' | 'edit' | number | null>(null);
  const [local, setLocal] = useState(action);
  const [savedNumber, setSavedNumber] = useState(action?.documentNumber ?? '');
  const [savedUrl, setSavedUrl] = useState(action?.openUrl ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (action) setLocal(action);
  }, [action]);

  const actionType = local?.actionType || card?.actionType || '';
  const isDraftCard = DRAFT_TYPES.has(actionType);
  const summary = local?.summaryDisplay;
  const cardSummary = card?.summary;
  const title =
    card?.titleAr ||
    summary?.title ||
    (actionType === 'CREATE_CUSTOMER' ? 'مسودة عميل جديد' : 'مسودة حركة');
  const partyName = cardSummary?.partyName || summary?.partyName || summary?.customerName;
  const warehouseName = cardSummary?.warehouseName || summary?.warehouseName;
  const currency = summary?.currency || 'EGP';
  const ocr = summary?.ocr ?? (
    actionType === 'DRAFT_PURCHASE_INVOICE' &&
    (cardSummary?.supplierConfidence != null || cardSummary?.supplierMatched != null)
      ? {
          invoiceNumber: cardSummary.invoiceNumber,
          supplierConfidence: cardSummary.supplierConfidence,
          supplierMatched: cardSummary.supplierMatched,
        }
      : undefined
  );
  const isOcrPurchase = actionType === 'DRAFT_PURCHASE_INVOICE' && Boolean(ocr);
  const lines = useMemo(() => {
    if (summary?.lines?.length) {
      return summary.lines.map((line) => ({
        itemName: line.itemName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        rawItemName: line.rawItemName,
        needsCreation: Boolean(line.needsCreation),
        matchConfidence: line.matchConfidence,
      }));
    }
    return (card?.previewLines ?? []).map((line) => ({
      itemName: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.total,
      rawItemName: line.rawItemName,
      needsCreation: Boolean(line.needsCreation),
      matchConfidence: line.matchConfidence,
    }));
  }, [card?.previewLines, summary?.lines]);
  const unmatchedCount = lines.length
    ? lines.filter((line) => line.needsCreation).length
    : ocr?.unmatchedCount || 0;

  const subtotal = cardSummary?.subtotal ?? summary?.subtotal ?? summary?.totalAmount;
  const taxAmount = cardSummary?.taxAmount ?? summary?.taxAmount ?? 0;
  const netAmount = cardSummary?.netAmount ?? summary?.netAmount ?? cardSummary?.totalAmount ?? summary?.totalAmount;
  const expired = local?.status === 'PENDING' && new Date(local.expiresAt).getTime() <= Date.now();
  const pending = (!local || local.status === 'PENDING') && !expired && !savedNumber;
  const executed = local?.status === 'EXECUTED' || Boolean(savedNumber);
  const warnings = summary?.stockWarnings ?? [];

  const draftPayload = useMemo(() => {
    if (local?.payload) return extractDraftPayload(local);
    if (card?.draftPayload && Object.keys(card.draftPayload).length) return card.draftPayload;
    return {};
  }, [card?.draftPayload, local]);

  async function approveDraft() {
    setBusy('confirm');
    setError('');
    try {
      if (!isDraftCard && local?.id) {
        const res = await fetchConfirm(local.id);
        setLocal({ ...local, ...res });
        setSavedNumber(res.documentNumber ?? '');
        setSavedUrl(res.openUrl ?? '');
        onChanged?.();
        return;
      }
      const result = await commitActionCard(actionType, draftPayload);
      if (local?.id) {
        try {
          await acknowledgePendingAction(local.id, result);
        } catch {
          /* document already saved via the module API */
        }
      }
      setSavedNumber(result.number);
      setSavedUrl(local?.openUrl || editHrefForActionType(actionType).replace('fromAiDraft=1', ''));
      if (local) {
        setLocal({
          ...local,
          status: 'EXECUTED',
          resultingEntityId: result.id,
          documentNumber: result.number,
        });
      }
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر اعتماد المسودة');
    } finally {
      setBusy(null);
    }
  }

  async function rejectDraft() {
    if (!local?.id) {
      setLocal(local ? { ...local, status: 'REJECTED' } : local);
      return;
    }
    setBusy('reject');
    setError('');
    try {
      const { apiClient } = await import('@/lib/api/client');
      const res = await apiClient.post<AiPendingAction>(`/ai/actions/${local.id}/reject`);
      if (res.data) setLocal({ ...local, ...res.data });
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إلغاء المسودة');
    } finally {
      setBusy(null);
    }
  }

  function openForEdit() {
    setBusy('edit');
    storeAiTransactionDraft({
      actionType,
      titleAr: title,
      draftPayload,
    });
    router.push(editHrefForActionType(actionType));
  }

  async function defineMissingItem(lineIndex: number) {
    const actionId = local?.id || card?.actionId;
    if (!actionId) {
      setError('المسودة غير جاهزة بعد. انتظر ثوانٍ ثم أعد المحاولة.');
      return;
    }
    setBusy(lineIndex);
    setError('');
    try {
      const res = await createOcrMissingItem(actionId, lineIndex);
      if (res.data) setLocal({ ...(local ?? res.data), ...res.data });
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تعريف الصنف');
    } finally {
      setBusy(null);
    }
  }

  const supplierBadge = isOcrPurchase
    ? confidenceBadge(ocr?.supplierConfidence, ocr?.supplierMatched)
    : null;
  const actionId = local?.id || card?.actionId;
  const canApprove =
    pending &&
    (!isOcrPurchase ||
      ((ocr?.supplierMatched ?? true) && unmatchedCount === 0 && Boolean(draftPayload.warehouseId)));
  const confirmLabel =
    actionType === 'DRAFT_PURCHASE_INVOICE' ? 'اعتماد فاتورة مشتريات مسودة' : 'اعتماد كمسودة';

  return (
    <div className="mt-2 overflow-hidden rounded-xl border-2 border-amber-400/80 bg-white text-right shadow-sm ring-1 ring-[#0E79AA]/25">
      <div className="flex items-center justify-between gap-2 bg-gradient-to-l from-amber-50 to-[#F6FBFD] px-3 py-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
          {title}
        </span>
        <span className="text-[10px] text-slate-400">
          {executed ? 'معتمدة' : pending ? 'بانتظار الاعتماد' : local?.status ?? 'مسودة'}
        </span>
      </div>

      <div className="space-y-2 px-3 py-2.5 text-sm text-[#094C6B]">
        {partyName ? (
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500">
              {actionType === 'DRAFT_PURCHASE_INVOICE' ? 'المورد: ' : 'الطرف: '}
            </span>
            <strong>{partyName}</strong>
            {supplierBadge ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${supplierBadge.className}`}>
                {supplierBadge.label}
              </span>
            ) : null}
          </p>
        ) : null}
        {ocr?.invoiceNumber || summary?.taxNumber || cardSummary?.taxNumber || cardSummary?.invoiceNumber ? (
          <p className="text-xs text-slate-500">
            {ocr?.invoiceNumber || cardSummary?.invoiceNumber ? (
              <span>فاتورة {ocr?.invoiceNumber || cardSummary?.invoiceNumber}</span>
            ) : null}
            {(ocr?.invoiceNumber || cardSummary?.invoiceNumber) &&
            (summary?.taxNumber || cardSummary?.taxNumber)
              ? ' · '
              : null}
            {summary?.taxNumber || cardSummary?.taxNumber ? (
              <span>ضريبي {summary?.taxNumber || cardSummary?.taxNumber}</span>
            ) : null}
          </p>
        ) : null}
        {warehouseName ? <p className="text-xs text-slate-500">المخزن: {warehouseName}</p> : null}

        {lines.length ? (
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="h-8 px-1 font-medium">الصنف</th>
                <th className="h-8 px-1 font-medium">الكمية</th>
                <th className="h-8 px-1 font-medium">السعر</th>
                <th className="h-8 px-1 font-medium">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr
                  key={`${line.itemName}-${index}`}
                  className={`border-t border-[#E6F0F7] ${line.needsCreation ? 'bg-amber-50/80' : ''}`}
                >
                  <td className="px-1 py-1.5 align-top">
                    <div className="font-medium">{line.itemName}</div>
                    {line.rawItemName && line.rawItemName !== line.itemName ? (
                      <div className="text-[10px] text-slate-400">{line.rawItemName}</div>
                    ) : null}
                    {line.needsCreation ? (
                      <button
                        type="button"
                        disabled={busy != null || !actionId}
                        onClick={() => void defineMissingItem(index)}
                        className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                      >
                        {busy === index ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        تعريف كصنف جديد
                      </button>
                    ) : line.matchConfidence != null && isOcrPurchase ? (
                      <div className="text-[10px] text-emerald-700">مطابق · {line.matchConfidence}%</div>
                    ) : null}
                  </td>
                  <td className="h-8 px-1 tabular-nums">{line.quantity ?? '—'}</td>
                  <td className="h-8 px-1 tabular-nums">{money(line.unitPrice, currency)}</td>
                  <td className="h-8 px-1 tabular-nums">{money(line.lineTotal, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {actionType !== 'CREATE_CUSTOMER' ? (
          <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs leading-6">
            <div className="flex justify-between">
              <span className="text-slate-500">الإجمالي الفرعي</span>
              <strong>{money(subtotal, currency)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ضريبة القيمة المضافة</span>
              <strong>{money(taxAmount, currency)}</strong>
            </div>
            <div className="flex justify-between text-sm text-[#094C6B]">
              <span>الصافي</span>
              <strong>{money(netAmount, currency)}</strong>
            </div>
          </div>
        ) : null}

        {warnings.map((warning) => (
          <p key={warning} className="text-xs text-amber-700">
            {warning}
          </p>
        ))}
        {error ? <p className="text-xs text-rose-700">{error}</p> : null}
        {local?.executionError ? <p className="text-xs text-rose-700">{local.executionError}</p> : null}
        {expired ? <p className="text-xs text-amber-700">انتهت صلاحية المسودة.</p> : null}
      </div>

      <div className="border-t border-[#E6F0F7] px-3 py-2">
        {executed ? (
          <div className="flex items-center justify-between gap-2 text-xs text-emerald-700">
            <span className="inline-flex items-center gap-1 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              تم الحفظ بنجاح كمسودة رقم {savedNumber || local?.documentNumber || '—'}
            </span>
            {savedUrl || local?.openUrl ? (
              <a
                href={savedUrl || local?.openUrl || '#'}
                className="inline-flex items-center gap-1 text-[#0E79AA] hover:underline"
              >
                فتح المستند
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ) : local?.status === 'REJECTED' ? (
          <p className="text-xs text-slate-500">تم إلغاء المسودة.</p>
        ) : pending ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {local?.id ? (
              <Button type="button" size="sm" variant="secondary" disabled={busy != null} onClick={() => void rejectDraft()}>
                إلغاء
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy != null}
              onClick={openForEdit}
              className="border-[#0E79AA]/30 text-[#0E79AA]"
            >
              {busy === 'edit' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PencilLine className="h-3.5 w-3.5" />}
              فتح للتعديل في الشاشة
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy != null || !canApprove}
              onClick={() => void approveDraft()}
              className="bg-[#0E79AA] hover:bg-[#0A5F86]"
              title={
                !canApprove && isOcrPurchase
                  ? unmatchedCount
                    ? 'عرّف الأصناف غير المطابقة أولاً'
                    : 'طابق المورد أو افتح الشاشة لاختياره'
                  : undefined
              }
            >
              {busy === 'confirm' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {confirmLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

async function fetchConfirm(actionId: string): Promise<AiPendingAction> {
  const { apiClient } = await import('@/lib/api/client');
  const res = await apiClient.post<AiPendingAction>(`/ai/actions/${actionId}/confirm`);
  return res.data ?? { id: actionId } as AiPendingAction;
}

export { AiActionCard as ActionProposalCard };
