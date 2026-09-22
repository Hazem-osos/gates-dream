'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm, type Resolver, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  Button,
  IconButton,
  compactControlClass,
  compactLabelClass,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  inventoryStocktakingPageFormSchema,
  type InventoryStocktakingPageFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { dispatchAcademyTrigger } from '@/lib/onboarding/tourCheckpoints';

import { formatMoneyAr } from '@/lib/formatMoney';
import { itemLabel } from '@/lib/inventory/itemDisplay';

interface StocktakingLine {
  itemId: string;
  bookValue: number;
  actualValue: number;
  shortage: number;
  surplus: number;
  unitPrice: number;
}

interface Item {
  id: string;
  code: string;
  arabicName: string;
}

function emptyStocktakingDefaults(today: string): InventoryStocktakingPageFormInput {
  return {
    serialNumber: '',
    description: '',
    date: today,
    hijriDate: '',
    warehouseId: '',
    isPosted: false,
    isApproved: false,
    useBarcode: true,
    hideExistingQty: true,
    excludeZeroValue: true,
  };
}

export default function StocktakingPage() {
  const invalidateQuery = useInvalidateQuery();
  const todayStr = new Date().toISOString().split('T')[0];

  const inputCls = compactControlClass;
  const labelCls = compactLabelClass;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<InventoryStocktakingPageFormInput>({
    resolver: zodResolver(inventoryStocktakingPageFormSchema) as Resolver<InventoryStocktakingPageFormInput>,
    defaultValues: emptyStocktakingDefaults(todayStr),
    mode: 'onTouched',
  });

  const isPosted = watch('isPosted');

  const [stocktakingLines, setStocktakingLines] = useState<StocktakingLine[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const warehouseId = watch('warehouseId');
  const excludeZeroValue = watch('excludeZeroValue');
  const hideExistingQty = watch('hideExistingQty');

  const { data: itemsResponse } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 2000, isActive: true }
  );
  const items = itemsResponse?.data ?? [];

  const stockTotals = useMemo(() => {
    let surplus = 0;
    let shortage = 0;
    for (const line of stocktakingLines) {
      surplus += (line.surplus ?? 0) * line.unitPrice;
      shortage += (line.shortage ?? 0) * line.unitPrice;
    }
    return { surplus, shortage };
  }, [stocktakingLines]);

  const postAfterSaveRef = useRef(false);
  const stocktakingMutation = useApiMutation<{ id?: string }, Record<string, unknown>>(
    '/inventory/stocktaking',
    'POST',
    {
      onSuccess: (res) => {
        const createdId = res.data?.id;
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        const finish = (message: string) => {
          setSuccess(message);
          invalidateQuery(['stocktaking']);
          reset(emptyStocktakingDefaults(new Date().toISOString().split('T')[0]));
          setStocktakingLines([]);
          dispatchAcademyTrigger('API_SUCCESS', 'stocktaking.save-success');
        };
        if (shouldPost && createdId) {
          void apiClient
            .post(`/inventory/stocktaking/${createdId}/post`)
            .then(() => finish('تم ترحيل الجرد بنجاح'))
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'تم الحفظ وتعذر الترحيل');
              invalidateQuery(['stocktaking']);
            });
          return;
        }
        finish('تم حفظ تسوية الجرد بنجاح');
      },
      onError: (error: ApiError) => {
        postAfterSaveRef.current = false;
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const loading = stocktakingMutation.isPending;

  useEffect(() => {
    reset((prev) => ({ ...prev, date: prev.date || todayStr }));
  }, [todayStr, reset]);

  const handleNew = () => {
    setError('');
    setSuccess('');
    setStocktakingLines([]);
    reset(emptyStocktakingDefaults(new Date().toISOString().split('T')[0]));
  };

  const handleRefreshStock = async () => {
    setError('');
    setSuccess('');
    if (!warehouseId) {
      setError('يرجى اختيار المخزن أولاً');
      return;
    }
    setRefreshing(true);
    try {
      const res = await apiClient.get<
        { itemId?: string; quantity?: number | string; quantityOnHand?: number | string; item?: { averageCost?: unknown; lastPurchasePrice?: unknown } }[]
      >(`/inventory/item-quantities/warehouse/${warehouseId}`);
      const rows = Array.isArray(res.data) ? res.data : [];
      const next = rows
        .map((row) => {
          const bookValue = Number(row.quantityOnHand ?? row.quantity) || 0;
          const cost = Number(row.item?.averageCost ?? row.item?.lastPurchasePrice);
          return {
            itemId: String(row.itemId ?? ''),
            bookValue,
            actualValue: bookValue,
            shortage: 0,
            surplus: 0,
            unitPrice: Number.isFinite(cost) && cost > 0 ? cost : 0,
          };
        })
        .filter((line) => line.itemId && (!excludeZeroValue || line.bookValue !== 0));
      setStocktakingLines(next);
      if (!next.length) {
        setError('لا يوجد رصيد في هذا المخزن');
        return;
      }
      setSuccess('تم تحميل أرصدة المخزن');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل أرصدة المخزن');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = () =>
    void handleSubmit((values) => {
      setError('');
      setSuccess('');
      const filled = stocktakingLines.filter((line) => line.itemId);
      if (filled.length === 0) {
        setError('يرجى إضافة أصناف لتسوية الجرد');
        return;
      }
      stocktakingMutation.mutate({
        serial: values.serialNumber || undefined,
        description: values.description,
        date: new Date(values.date).toISOString(),
        hijriDate: values.hijriDate,
        warehouseId: values.warehouseId,
        lines: filled.map((line) => ({
          itemId: line.itemId,
          warehouseId: values.warehouseId,
          bookQuantity: line.bookValue,
          actualQuantity: line.actualValue,
          unitPrice: line.unitPrice,
          shortageQuantity: line.shortage,
          increaseQuantity: line.surplus,
        })),
      });
    }, onFieldErrors(setError))();

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <ErpDocumentPageHeader
        compact
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'جرد مخزني' },
        ]}
        title="جرد مخزني"
        docNumber={watch('serialNumber') || ''}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحّل' : 'مسودة'}
        saveLabel="حفظ"
        onSaveDraft={handleSave}
        savePending={loading}
        canSave={!loading}
        hideStandalonePost
        hideBrowseList
        favoriteHref="/inventory/operations/stocktaking"
        standardActions={{
          hasDocument: stocktakingLines.length > 0,
          isPosted: Boolean(isPosted),
          onPost: () => {
            postAfterSaveRef.current = true;
            handleSave();
          },
          onUnpost: () => setValue('isPosted', false),
          onNew: handleNew,
          newLabel: 'جديد',
        }}
      />
      <FormSectionCard title="فلتر الجرد" subtitle="المخزن والتاريخ">
          <CompactFormField label="المسلسل" placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
          <CompactFormField
            label="التاريخ"
            type="date"
            error={errors.date?.message}
            {...register('date')}
          />
          <div data-tour-id="stocktaking-warehouse-select">
            <CompactFormField label="المخزن" error={errors.warehouseId?.message}>
              <Controller
                name="warehouseId"
                control={control}
                render={({ field }) => (
                  <WarehouseSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    className={`${inputCls} ${errors.warehouseId ? 'border-red-400' : ''}`}
                    emptyLabel="اختر المخزن"
                  />
                )}
              />
            </CompactFormField>
          </div>
          <CompactFormField
            label="الشرح"
            placeholder="إدخل الشرح"
            error={errors.description?.message}
            {...register('description')}
          />
          <div className="flex items-end">
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void handleRefreshStock()}
              className="h-9 px-4 bg-white border border-[#D6EAF3] rounded-lg text-sm font-semibold text-[#094C6B] disabled:opacity-50"
            >
              {refreshing ? 'جاري التحميل…' : 'تحديث الجرد'}
            </button>
          </div>
      </FormSectionCard>
      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <CompactFormField label="المجموعة" defaultValue="1010101" />
          <CompactFormField label="الصنف" defaultValue="1010101" />
          <div className="flex flex-col justify-end gap-2">
            <Controller
              name="useBarcode"
              control={control}
              render={({ field: { value, onChange } }) => (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#094C6B]">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-[#0E78AA]/50"
                  />
                  جرد بالباركود
                </label>
              )}
            />
            <Controller
              name="excludeZeroValue"
              control={control}
              render={({ field: { value, onChange } }) => (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#094C6B]">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-[#0E78AA]/50"
                  />
                  عدم احتساب القيمة الصفرية
                </label>
              )}
            />
            <Controller
              name="hideExistingQty"
              control={control}
              render={({ field: { value, onChange } }) => (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#094C6B]">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-[#0E78AA]/50"
                  />
                  عدم إظهار الكمية الموجودة
                </label>
              )}
            />
          </div>
          <div className="col-span-full">
            <p className={labelCls}>التجميع</p>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#094C6B]">
              <label className="flex items-center gap-2">
                <input type="radio" name="sum" defaultChecked /> الجميع
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="sum" /> السالبة فقط
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="sum" /> أصناف لها رصيد فقط
              </label>
            </div>
          </div>
          <div className="col-span-full grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-4 text-xs font-semibold text-[#094C6B]">
                <label className="flex items-center gap-2">
                  <input type="radio" name="scanMode" defaultChecked /> الباركود
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="scanMode" /> رقم الصنف
                </label>
              </div>
              <input className={inputCls} placeholder="أدخل الباركود أو رقم الصنف" />
            </div>
          </div>
        </div>
      </AdvancedFieldsSection>

      <div className="mb-4 mt-6 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            postAfterSaveRef.current = true;
            handleSave();
          }}
          disabled={loading}
        >
          تسوية الجرد
        </Button>
        <Button type="button" variant="secondary" onClick={handleNew}>
          إلغاء التسوية
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleRefreshStock()}
          disabled={refreshing}
        >
          إستعادة
        </Button>
      </div>

      <FormSectionCard title="فروقات الجرد" subtitle="جدول إدخال — الكمية الفعلية تُحسب منها العجز/الزيادة وتُرسل مع الحفظ" bodyClassName="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="gap-2"
              onClick={() =>
                setStocktakingLines([
                  ...stocktakingLines,
                  { itemId: '', bookValue: 0, actualValue: 0, shortage: 0, surplus: 0, unitPrice: 0 },
                ])
              }
            >
              <Plus className="h-4 w-4" aria-hidden />
              إضافة صنف
            </Button>
          </div>
          <div className={denseTableWrapClass} data-tour-id="stocktaking-items-table">
            <table className={denseTableClass}>
              <thead className={denseTheadClass}>
                <tr>
                  <th className={denseThClass}>م</th>
                  <th className={denseThClass}>الصنف</th>
                  {hideExistingQty ? null : <th className={denseThClass}>القيمة الدفترية</th>}
                  <th className={denseThClass}>الكمية الفعلية</th>
                  <th className={denseThClass}>العجز</th>
                  <th className={denseThClass}>الزيادة</th>
                  <th className={denseThClass}>السعر</th>
                  <th className={denseThClass}>قيمة العجز</th>
                  <th className={denseThClass}>قيمة الزيادة</th>
                  <th className={denseThClass}> </th>
                </tr>
              </thead>
              <tbody>
                {stocktakingLines.length === 0 ? (
                  <tr>
                    <td colSpan={hideExistingQty ? 9 : 10} className="py-6 text-sm text-slate-500">
                      لا توجد بنود جرد — أضف صنفاً وأدخل الكمية الفعلية قبل الحفظ.
                    </td>
                  </tr>
                ) : (
                  stocktakingLines.map((line, i) => (
                    <tr key={`st-${i}`} className={i % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">{i + 1}</td>
                      <td className="min-w-[12rem] py-1.5 px-2 border-x border-[#D6EAF3]">
                        <select
                          className={inputCls}
                          value={line.itemId}
                          onChange={(e) => {
                            const next = [...stocktakingLines];
                            next[i] = { ...next[i], itemId: e.target.value };
                            setStocktakingLines(next);
                          }}
                        >
                          <option value="">اختر الصنف</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {itemLabel(items, item.id)}
                            </option>
                          ))}
                        </select>
                      </td>
                      {hideExistingQty ? null : (
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <TableNumberInput
                          className={inputCls}
                          value={line.bookValue}
                          onValueCommit={(bookValue) => {
                            const actualValue = stocktakingLines[i].actualValue;
                            const delta = actualValue - bookValue;
                            const next = [...stocktakingLines];
                            next[i] = {
                              ...next[i],
                              bookValue,
                              shortage: delta < 0 ? -delta : 0,
                              surplus: delta > 0 ? delta : 0,
                            };
                            setStocktakingLines(next);
                          }}
                        />
                      </td>
                      )}
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <TableNumberInput
                          className={inputCls}
                          value={line.actualValue}
                          onValueCommit={(actualValue) => {
                            const bookValue = stocktakingLines[i].bookValue;
                            const delta = actualValue - bookValue;
                            const next = [...stocktakingLines];
                            next[i] = {
                              ...next[i],
                              actualValue,
                              shortage: delta < 0 ? -delta : 0,
                              surplus: delta > 0 ? delta : 0,
                            };
                            setStocktakingLines(next);
                          }}
                        />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <input className={inputCls} value={line.shortage} readOnly />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <input className={inputCls} value={line.surplus} readOnly />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <TableNumberInput
                          className={inputCls}
                          value={line.unitPrice}
                          onValueCommit={(unitPrice) => {
                            const next = [...stocktakingLines];
                            next[i] = { ...next[i], unitPrice };
                            setStocktakingLines(next);
                          }}
                        />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <input className={inputCls} value={formatMoneyAr(line.shortage * line.unitPrice)} readOnly />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <input className={inputCls} value={formatMoneyAr(line.surplus * line.unitPrice)} readOnly />
                      </td>
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <IconButton
                          icon={Trash2}
                          label="حذف السطر"
                          variant="danger"
                          onClick={() => setStocktakingLines(stocktakingLines.filter((_, idx) => idx !== i))}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      </FormSectionCard>

      <FormSectionCard title="الإجمالي" bodyClassName="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <CompactFormField label="إجمالى الزيادة" value={formatMoneyAr(stockTotals.surplus)} readOnly />
          <CompactFormField label="إجمالى العجز" value={formatMoneyAr(stockTotals.shortage)} readOnly />
          <div className="flex items-end gap-2">
            <button type="button" className="h-9 px-4 bg-white border border-[#D6EAF3] rounded-lg text-sm font-semibold text-[#094C6B]">
              رقم القيد
            </button>
            <input className={`${inputCls} w-40`} />
          </div>
          <div className="col-span-full flex flex-wrap gap-2">
            <button
              type="button"
              className="h-9 px-4 bg-[#0E78AA] text-white rounded-lg text-sm font-semibold"
            >
              تحميل الإكسيل
            </button>
            <button
              type="button"
              className="h-9 px-4 bg-[#0E78AA] text-white rounded-lg text-sm font-semibold"
            >
              حفظ الإكسيل
            </button>
          </div>
      </FormSectionCard>

      <FormStickyFooter
        status={`${stocktakingLines.length} بند · زيادة ${formatMoneyAr(stockTotals.surplus)} · عجز ${formatMoneyAr(stockTotals.shortage)}`}
      />
    </ErpDocumentLayout>
  );
}
