'use client';

import React, { useState } from 'react';
import { ActionButtons, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiMutation, useApiQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateMasterDataClient } from '@/lib/hooks/invalidateMasterData';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { findDefaultPieceUnitId } from '@/lib/inventory/item-units';
import { ItemGroupSelect } from '@/components/form/ItemGroupSelect';
import { queryKeys } from '@/lib/query/query-keys';

export type QuickCreatedItem = {
  id: string;
  arabicName: string;
  serial?: string | null;
  salesPrice?: number;
  unitId?: string;
  /** Sales Invoice Enterprise Redesign: tax profile, so a line created from
   * this item can be pre-filled the same way a picked catalog item is. */
  defaultTaxPercent?: number | string | null;
  taxExemptionReason?: string | null;
};

type QuickCreateItemModalProps = {
  open: boolean;
  initialName: string;
  initialCode?: string;
  onClose: () => void;
  onCreated: (item: QuickCreatedItem) => void;
};

type UnitRow = { id: string; arabicName: string; code?: string | null };
type CategoryRow = { id: string; arabicName: string; code?: string | null };

export function QuickCreateItemModal({
  open,
  initialName,
  initialCode,
  onClose,
  onCreated,
}: QuickCreateItemModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: unitsResponse } = useApiQuery<UnitRow[]>(
    ['units', { limit: 100 }],
    '/inventory/units',
    { limit: 100, isActive: true },
    { enabled: open }
  );
  const units = unitsResponse?.data ?? [];
  const { data: categoriesResponse } = useApiQuery<CategoryRow[]>(
    queryKeys.itemCategories({ limit: 200 }),
    '/inventory/item-categories',
    { limit: 200, isActive: true },
    { enabled: open }
  );
  const categories = Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : [];

  React.useEffect(() => {
    if (open) {
      setName(initialName);
      setCode(initialCode ?? '');
      setCategoryId('');
      setSalePrice('');
      setPurchaseCost('');
      setUnitId('');
      setError('');
    }
  }, [open, initialName, initialCode]);

  React.useEffect(() => {
    if (open && units.length > 0 && !unitId) {
      setUnitId(findDefaultPieceUnitId(units) || units[0].id);
    }
  }, [open, units, unitId]);

  const itemMutation = useApiMutation<{ id: string; arabicName: string; serial?: string }, Record<string, unknown>>(
    '/inventory/items',
    'POST',
    { showSuccessToast: false }
  );

  if (!open) return null;

  const submit = async () => {
    setError('');
    if (!name.trim()) {
      setError('اسم الصنف مطلوب');
      return;
    }
    setSaving(true);
    try {
      const linkedUnitId = unitId || findDefaultPieceUnitId(units);
      const linkedUnitLabel = units.find((u) => u.id === linkedUnitId)?.arabicName;
      const body: Record<string, unknown> = {
        arabicName: name.trim(),
        serial: code.trim() || undefined,
        categoryId: categoryId || undefined,
        itemType: 'normal',
        isAssembly: false,
        baseUnitId: linkedUnitId || undefined,
      };
      if (purchaseCost.trim()) {
        const c = Number(purchaseCost);
        if (Number.isFinite(c)) body.beginningCostPrice = c;
      }
      const created = await itemMutation.mutateAsync(body);
      const itemId = created.data?.id;
      if (!itemId) throw new Error('لم يُرجَع معرّف الصنف');

      invalidateMasterDataClient(queryClient);

      const priceNum = salePrice.trim() ? Number(salePrice) : NaN;
      const quickItem: QuickCreatedItem = {
        id: itemId,
        arabicName: name.trim(),
        serial: code.trim() || created.data?.serial,
        salesPrice: Number.isFinite(priceNum) ? priceNum : undefined,
        unitId: linkedUnitId || undefined,
      };

      queryClient.setQueriesData<{ data?: ItemOption[] }>({ queryKey: ['items'] }, (old) => {
        if (!old?.data) return old;
        const unitLink = linkedUnitId
          ? [
              {
                unitId: linkedUnitId,
                isBaseUnit: true,
                unit: {
                  id: linkedUnitId,
                  arabicName: linkedUnitLabel ?? 'الوحدة',
                },
              },
            ]
          : [];
        const row: ItemOption = {
          id: itemId,
          arabicName: name.trim(),
          serial: code.trim() || created.data?.serial,
          units: unitLink,
        };
        return { ...old, data: [row, ...old.data.filter((i) => i.id !== itemId)] };
      });

      onCreated(quickItem);
      onClose();
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as ApiError).message)
          : 'تعذر إنشاء الصنف';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-item-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <h2 id="quick-item-title" className="mb-4 text-lg font-bold text-[#0A3D5E]">
          إضافة صنف سريع
        </h2>
        <FormSectionCard title="بيانات الصنف" bodyClassName="sm:grid-cols-1 lg:grid-cols-1">
          <CompactFormField
            label="اسم الصنف"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <CompactFormField
            label="المسلسل"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="اختياري"
          />
          <CompactFormField label="المجموعة">
            <ItemGroupSelect
              value={categoryId}
              onChange={setCategoryId}
              groups={categories}
              emptyLabel="بدون مجموعة"
            />
          </CompactFormField>
          <CompactFormField
            label="سعر البيع"
            type="number"
            min={0}
            step="0.01"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
          />
          <CompactFormField
            label="تكلفة الشراء"
            type="number"
            min={0}
            step="0.01"
            value={purchaseCost}
            onChange={(e) => setPurchaseCost(e.target.value)}
          />
          <CompactFormField label="الوحدة الافتراضية">
            <select className={compactControlClass} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {units.length === 0 ? <option value="">جاري تحميل الوحدات…</option> : null}
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code ? `[${u.code}] ` : ''}
                  {u.arabicName}
                </option>
              ))}
            </select>
          </CompactFormField>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </FormSectionCard>
        <div className="mt-2">
          <ActionButtons
            onCancel={onClose}
            onSave={() => void submit()}
            saveText={saving ? 'جاري الحفظ…' : 'حفظ'}
            cancelText="إلغاء"
            saveDisabled={saving}
          />
        </div>
      </div>
    </div>
  );
}
