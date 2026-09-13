'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { AppTable, Button, CompactFormField, compactControlClass } from '@/components/ui';
import { apiClient } from '@/lib/api/client';

type PriceOp = 'none' | 'eq' | 'gt' | 'lt' | 'between';

type FinderRow = {
  itemId: string;
  itemName: string;
  itemCode: string;
  barcode: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  [key: string]: unknown;
};

const OPS: { id: PriceOp; label: string }[] = [
  { id: 'none', label: 'بدون شرط' },
  { id: 'eq', label: 'يساوي' },
  { id: 'gt', label: 'أكبر من' },
  { id: 'lt', label: 'أصغر من' },
  { id: 'between', label: 'بين' },
];

export function ItemFinderModal({
  open,
  onClose,
  initialBarcode = '',
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  initialBarcode?: string;
  onPick: (itemId: string) => void;
}) {
  const [barcode, setBarcode] = useState(initialBarcode);
  const [itemName, setItemName] = useState('');
  const [purchaseOp, setPurchaseOp] = useState<PriceOp>('none');
  const [purchaseFrom, setPurchaseFrom] = useState('');
  const [purchaseTo, setPurchaseTo] = useState('');
  const [saleOp, setSaleOp] = useState<PriceOp>('none');
  const [saleFrom, setSaleFrom] = useState('');
  const [saleTo, setSaleTo] = useState('');
  const [rows, setRows] = useState<FinderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setBarcode(initialBarcode);
  }, [open, initialBarcode]);

  if (!open) return null;

  const search = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.get<FinderRow[]>('/inventory/items/finder', {
        barcode: barcode.trim() || undefined,
        name: itemName.trim() || undefined,
        purchaseOp,
        purchaseFrom: purchaseFrom || undefined,
        purchaseTo: purchaseTo || undefined,
        saleOp,
        saleFrom: saleFrom || undefined,
        saleTo: saleTo || undefined,
        limit: 50,
      });
      setRows(res.data ?? []);
      if (!(res.data ?? []).length) setError('لا توجد أصناف مطابقة');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر البحث');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-finder-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E6F0F7] px-5 py-3">
          <h2 id="item-finder-title" className="text-lg font-bold text-[#0A3D5E]">
            بحث عن الصنف
          </h2>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          <CompactFormField
            label="الباركود"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <fieldset className="rounded-xl border border-[#E6F0F7] p-3">
              <legend className="px-1 text-sm font-semibold text-[#0A3D5E]">سعر الشراء</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <CompactFormField label="الشرط">
                  <select
                    className={compactControlClass}
                    value={purchaseOp}
                    onChange={(e) => setPurchaseOp(e.target.value as PriceOp)}
                  >
                    {OPS.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </CompactFormField>
                <CompactFormField
                  label="من القيمة"
                  type="number"
                  min={0}
                  value={purchaseFrom}
                  onChange={(e) => setPurchaseFrom(e.target.value)}
                />
                <CompactFormField
                  label="إلى القيمة"
                  type="number"
                  min={0}
                  value={purchaseTo}
                  onChange={(e) => setPurchaseTo(e.target.value)}
                />
              </div>
            </fieldset>
            <fieldset className="rounded-xl border border-[#E6F0F7] p-3">
              <legend className="px-1 text-sm font-semibold text-[#0A3D5E]">شرط البيع</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <CompactFormField label="الشرط">
                  <select
                    className={compactControlClass}
                    value={saleOp}
                    onChange={(e) => setSaleOp(e.target.value as PriceOp)}
                  >
                    {OPS.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </CompactFormField>
                <CompactFormField
                  label="من القيمة"
                  type="number"
                  min={0}
                  value={saleFrom}
                  onChange={(e) => setSaleFrom(e.target.value)}
                />
                <CompactFormField
                  label="إلى القيمة"
                  type="number"
                  min={0}
                  value={saleTo}
                  onChange={(e) => setSaleTo(e.target.value)}
                />
              </div>
            </fieldset>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <CompactFormField
                label="اسم الصنف"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void search();
                  }
                }}
              />
            </div>
            <Button type="button" onClick={() => void search()} disabled={loading}>
              <Search className="h-4 w-4" />
              بحث
            </Button>
          </div>
          {error ? <p className="text-sm text-amber-700">{error}</p> : null}

          <AppTable<FinderRow>
            isLoading={loading}
            data={rows}
            getRowKey={(r) => `${r.itemId}-${r.warehouseId}`}
            emptyTitle="لا توجد نتائج"
            emptyDescription="اكتب الباركود أو الاسم أو شرط السعر ثم اضغط بحث."
            columns={[
              { id: 'item', header: 'الصنف', cell: (r) => r.itemName },
              { id: 'warehouse', header: 'المخزن', cell: (r) => r.warehouseName || '—' },
              {
                id: 'qty',
                header: 'الكمية',
                align: 'center',
                cell: (r) => r.quantity.toLocaleString('ar-EG'),
              },
              {
                id: 'pick',
                header: '',
                align: 'center',
                cell: (r) => (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onPick(r.itemId);
                      onClose();
                    }}
                  >
                    فتح
                  </Button>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
