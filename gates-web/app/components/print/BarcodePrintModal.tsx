'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ActionButtons } from '@/app/components/ui/ActionButtons';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { useItemsQuery, formatItemLabel, type ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { renderPrintableAndOpen } from '@/app/components/print/PrintDocumentButton';
import {
  barcodeScanValue,
  formatStickerPrice,
  itemStickerCode,
  resolveItemLabelPrice,
} from '@/lib/inventory/barcode-label';
import './print-styles.css';

type LabelSize = '38x25' | '50x30' | '60x40';

const BARCODE_OPTS: Record<LabelSize, { height: number; width: number }> = {
  '38x25': { height: 36, width: 1.5 },
  '50x30': { height: 52, width: 1.85 },
  '60x40': { height: 64, width: 2.1 },
};

function mergeItemForLabel(listItem: ItemOption | undefined, seed?: ItemOption): ItemOption | undefined {
  if (!listItem && !seed) return undefined;
  if (!listItem) return seed;
  if (!seed || listItem.id !== seed.id) return listItem;
  return {
    ...listItem,
    serial: seed.serial ?? listItem.serial,
    barcode: seed.barcode ?? listItem.barcode,
    arabicName: seed.arabicName || listItem.arabicName,
    salesPrice: seed.salesPrice ?? listItem.salesPrice,
    itemPrices: seed.itemPrices?.length ? seed.itemPrices : listItem.itemPrices,
  };
}

function BarcodeSvg({ value, size }: { value: string; size: LabelSize }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const opts = BARCODE_OPTS[size];
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !value) return;
    let cancelled = false;
    void import(/* webpackChunkName: "jsbarcode" */ 'jsbarcode').then(({ default: JsBarcode }) => {
      if (cancelled || !el) return;
      try {
        const format = /^\d{13}$/.test(value) ? 'EAN13' : 'CODE128';
        JsBarcode(el, value, {
          format,
          displayValue: false,
          lineColor: '#000000',
          background: '#ffffff',
          margin: 4,
          height: opts.height,
          width: opts.width,
        });
        el.setAttribute('width', '100%');
        el.removeAttribute('height');
        el.style.maxWidth = '100%';
        el.style.height = 'auto';
      } catch {
        try {
          JsBarcode(el, value, {
            format: 'CODE128',
            displayValue: false,
            lineColor: '#000000',
            background: '#ffffff',
            margin: 4,
            height: opts.height,
            width: opts.width,
          });
        } catch {
          /* invalid barcode */
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value, opts.height, opts.width]);
  return <svg ref={svgRef} className="barcode-label-svg" aria-hidden />;
}

function LabelSheet({
  item,
  count,
  size,
}: {
  item: ItemOption;
  count: number;
  size: LabelSize;
}) {
  const scanValue = barcodeScanValue(item);
  const stickerCode = itemStickerCode(item);
  const price = resolveItemLabelPrice(item);
  const sizeClass =
    size === '38x25'
      ? 'barcode-label-38x25'
      : size === '60x40'
        ? 'barcode-label-60x40'
        : 'barcode-label-50x30';
  const labels = Array.from({ length: count }, (_, i) => i);

  return (
    <div className="barcode-label-sheet" dir="rtl">
      {labels.map((i) => (
        <div key={i} className={`barcode-label ${sizeClass}`}>
          <div className="barcode-label-code">{stickerCode}</div>
          <div className="barcode-label-name">{item.arabicName}</div>
          <div className="barcode-label-bars">
            <BarcodeSvg value={scanValue} size={size} />
          </div>
          <div className="barcode-label-digits">{stickerCode}</div>
          {price != null ? (
            <div className="barcode-label-price">{formatStickerPrice(price)}</div>
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
  const { data } = useItemsQuery(500);
  const items = data?.data ?? [];
  const [itemId, setItemId] = useState(initialItemId ?? seedItem?.id ?? '');
  const [labelCount, setLabelCount] = useState(1);
  const [size, setSize] = useState<LabelSize>('60x40');
  const [batchIds, setBatchIds] = useState<string[]>(initialItemIds ?? []);

  useEffect(() => {
    if (!open) return;
    if (initialItemId) setItemId(initialItemId);
    else if (seedItem?.id) setItemId(seedItem.id);
  }, [open, initialItemId, seedItem?.id]);

  useEffect(() => {
    if (open && initialItemIds?.length) setBatchIds(initialItemIds);
  }, [open, initialItemIds]);

  if (!open) return null;

  const selected = mergeItemForLabel(
    items.find((it) => it.id === itemId),
    seedItem && (seedItem.id === itemId || !itemId) ? seedItem : undefined
  );
  const resolveItem = (id: string) =>
    mergeItemForLabel(
      items.find((it) => it.id === id),
      seedItem?.id === id ? seedItem : undefined
    );

  const batchItems = batchIds.map(resolveItem).filter(Boolean) as ItemOption[];

  const addToBatch = () => {
    if (!itemId || batchIds.includes(itemId)) return;
    setBatchIds((prev) => [...prev, itemId]);
  };

  const print = () => {
    const toPrint =
      batchItems.length > 0 ? batchItems : selected ? [selected] : seedItem ? [seedItem] : [];
    if (!toPrint.length) return;
    renderPrintableAndOpen(
      () => (
        <div className="barcode-label-print-root">
          {toPrint.map((it) => (
            <LabelSheet key={it.id} item={it} count={labelCount} size={size} />
          ))}
        </div>
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
            <div className="rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] p-3 text-center">
              <p className="text-sm font-bold text-[#0A3D5E]">{itemStickerCode(selected) || '—'}</p>
              <p className="text-xs text-[#094C6B] truncate">{selected.arabicName}</p>
              <p className="mt-1 text-xs font-semibold text-[#0E78AA]">
                {(() => {
                  const p = resolveItemLabelPrice(selected);
                  return p != null ? formatStickerPrice(p) : 'بدون سعر في البطاقة';
                })()}
              </p>
            </div>
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
              <option value="38x25">38 × 25 mm (صغير)</option>
              <option value="50x30">50 × 30 mm</option>
              <option value="60x40">60 × 40 mm (مُوصى به)</option>
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
