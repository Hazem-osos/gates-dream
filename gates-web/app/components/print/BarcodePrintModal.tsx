'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ActionButtons } from '@/app/components/ui/ActionButtons';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { useItemsQuery, formatItemLabel, type ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { renderPrintableAndOpen } from '@/app/components/print/PrintDocumentButton';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import './print-styles.css';

type LabelSize = '38x25' | '50x30';

function BarcodeSvg({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !value) return;
    let cancelled = false;
    void import(/* webpackChunkName: "jsbarcode" */ 'jsbarcode').then(({ default: JsBarcode }) => {
      if (cancelled || !el) return;
      try {
        JsBarcode(el, value, {
          format: 'CODE128',
          displayValue: true,
          fontSize: 10,
          height: 36,
          margin: 2,
        });
      } catch {
        /* invalid barcode */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value]);
  return <svg ref={svgRef} />;
}

function LabelSheet({
  companyName,
  item,
  count,
  size,
}: {
  companyName: string;
  item: ItemOption;
  count: number;
  size: LabelSize;
}) {
  const code = item.barcode || item.serial || item.code || item.id.slice(0, 12);
  let price: number | null = null;
  if (typeof item.salesPrice === 'number') price = item.salesPrice;
  const sizeClass = size === '38x25' ? 'barcode-label-38x25' : 'barcode-label-50x30';
  const labels = Array.from({ length: count }, (_, i) => i);

  return (
    <div className="barcode-label-sheet" dir="rtl">
      {labels.map((i) => (
        <div key={i} className={`barcode-label ${sizeClass}`}>
          <div className="text-[9px] font-bold truncate">{companyName}</div>
          <div className="text-[8px] truncate">{item.arabicName}</div>
          <BarcodeSvg value={code} />
          {price != null ? (
            <div className="text-[9px] font-semibold">{price.toFixed(2)} EGP</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function BarcodePrintModal({
  open,
  onClose,
  initialItemId,
  initialItemIds,
  seedItem,
}: {
  open: boolean;
  onClose: () => void;
  initialItemId?: string;
  seedItem?: ItemOption;
  /** Sales Invoice Enterprise Redesign: pre-seed the batch with every distinct
   * item on the current document's lines (deduplicated), instead of forcing
   * the user to re-pick each one from the item selector. */
  initialItemIds?: string[];
}) {
  const { profile } = useCompanyPrintProfile();
  const { data } = useItemsQuery(500);
  const items = data?.data ?? [];
  const [itemId, setItemId] = useState(initialItemId ?? seedItem?.id ?? '');
  const [labelCount, setLabelCount] = useState(1);
  const [size, setSize] = useState<LabelSize>('50x30');
  const [batchIds, setBatchIds] = useState<string[]>(initialItemIds ?? []);

  useEffect(() => {
    if (open && (initialItemId || seedItem?.id)) setItemId(initialItemId ?? seedItem?.id ?? '');
  }, [open, initialItemId, seedItem?.id]);

  useEffect(() => {
    if (open && initialItemIds?.length) setBatchIds(initialItemIds);
  }, [open, initialItemIds]);

  if (!open) return null;

  const selected =
    items.find((it) => it.id === itemId) ??
    (seedItem && seedItem.id === itemId ? seedItem : undefined);
  const resolveItem = (id: string) =>
    items.find((it) => it.id === id) ?? (seedItem?.id === id ? seedItem : undefined);

  const batchItems = batchIds.map(resolveItem).filter(Boolean) as ItemOption[];

  const addToBatch = () => {
    if (!itemId || batchIds.includes(itemId)) return;
    setBatchIds((prev) => [...prev, itemId]);
  };

  const print = () => {
    const toPrint = batchItems.length > 0 ? batchItems : selected ? [selected] : [];
    if (!toPrint.length) return;
    renderPrintableAndOpen(
      () => (
        <>
          {toPrint.map((it) => (
            <LabelSheet
              key={it.id}
              companyName={profile?.nameAr ?? 'Gates'}
              item={it}
              count={labelCount}
              size={size}
            />
          ))}
        </>
      )
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold text-[#0A3D5E]">طباعة ملصقات باركود</h2>
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            الصنف
            <ItemSelect
              value={itemId}
              onChange={setItemId}
              enableQuickCreate={false}
              fallbackLabel={seedItem && seedItem.id === itemId ? formatItemLabel(seedItem) : undefined}
            />
          </label>
          {selected ? (
            <p className="text-xs text-gray-600">{formatItemLabel(selected)}</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={addToBatch}>
              إضافة للدفعة
            </Button>
            {batchIds.length > 0 ? (
              <span className="text-sm text-[#0E78AA]">{batchIds.length} صنف في الدفعة</span>
            ) : null}
          </div>
          {batchItems.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {batchItems.map((it) => (
                <span
                  key={it.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#F6FBFD] border border-[#D6EAF3] px-2 py-1 text-xs text-[#0A3D5E]"
                >
                  {it.arabicName}
                  <button
                    type="button"
                    onClick={() => setBatchIds((prev) => prev.filter((id) => id !== it.id))}
                    className="text-red-500 hover:text-red-700"
                    aria-label="إزالة"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <label className="block text-sm font-medium">
            عدد الملصقات لكل صنف
            <input
              type="number"
              min={1}
              max={500}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              value={labelCount}
              onChange={(e) => setLabelCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <label className="block text-sm font-medium">
            مقاس الملصق
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              value={size}
              onChange={(e) => setSize(e.target.value as LabelSize)}
            >
              <option value="38x25">38 × 25 mm</option>
              <option value="50x30">50 × 30 mm</option>
            </select>
          </label>
        </div>
        <div className="mt-6">
          <ActionButtons onCancel={onClose} onSave={print} saveText="طباعة" cancelText="إلغاء" />
        </div>
      </div>
    </div>
  );
}
