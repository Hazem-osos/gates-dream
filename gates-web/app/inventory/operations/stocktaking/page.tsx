'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm, type Resolver, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import CrudButtons from '@/components/ui/CrudButtons';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  StatusBadge,
  Button,
  IconButton,
  compactControlClass,
  compactLabelClass,
} from '@/components/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
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

interface Warehouse {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

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

  const { data: warehousesResponse, isLoading: warehousesLoading } = useApiQuery<Warehouse[]>(
    ['warehouses'],
    '/inventory/warehouses',
    { limit: 1000, isActive: true }
  );
  const warehouses = warehousesResponse?.data || [];

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

  const stocktakingMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/stocktaking',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ تسوية الجرد بنجاح');
        invalidateQuery(['stocktaking']);
        reset(emptyStocktakingDefaults(new Date().toISOString().split('T')[0]));
        setStocktakingLines([]);
        dispatchAcademyTrigger('API_SUCCESS', 'stocktaking.save-success');
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const loading = stocktakingMutation.isPending;

  useEffect(() => {
    reset((prev) => ({ ...prev, date: prev.date || todayStr }));
  }, [todayStr, reset]);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <PageHeader
        title="تسوية جرد مخزني"
        breadcrumbs={[
          { label: 'المخزون', href: '/inventory' },
          { label: 'الحركات' },
          { label: 'تسوية جرد مخزني' },
        ]}
        className="mb-4"
      />
      <FormSectionCard title="فلتر الجرد" subtitle="المخزن والتاريخ" bodyClassName="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#0A3D5E]">الترحيل:</label>
              <Controller
                name="isPosted"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <div className="flex bg-gray-200 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => onChange(true)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${value ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                    >
                      ترحيل
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(false)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${!value ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                    >
                      فك ترحيل
                    </button>
                  </div>
                )}
              />
            </div>
            <StatusBadge
              variant={isPosted ? 'success' : 'warning'}
              label={isPosted ? 'مرحّل' : 'لم يتم تسويته'}
            />
          </div>

          <CompactFormField label="المسلسل" placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
          <CompactFormField
            label="التاريخ"
            type="date"
            error={errors.date?.message}
            {...register('date')}
          />
          <div data-tour-id="stocktaking-warehouse-select">
            <CompactFormField label="المخزن" error={errors.warehouseId?.message}>
              <select
                className={`${inputCls} ${errors.warehouseId ? 'border-red-400' : ''}`}
                {...register('warehouseId')}
                disabled={warehousesLoading}
              >
                <option value="">اختر المخزن</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.arabicName} ({warehouse.code})
                  </option>
                ))}
              </select>
            </CompactFormField>
          </div>
          <CompactFormField
            label="الشرح"
            placeholder="إدخل الشرح"
            error={errors.description?.message}
            {...register('description')}
          />
          <div className="flex items-end">
            <button type="button" className="h-9 px-4 bg-white border border-[#D6EAF3] rounded-lg text-sm font-semibold text-[#094C6B]">
              تحديث الجرد
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

      <div className="mt-6 mb-4 flex items-center gap-4">
        <button
          type="button"
          className="px-6 py-2 bg-gradient-to-r from-[#0E78AA] to-[#0A5F8A] text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-300 hover:from-[#0A5F8A] hover:to-[#084A6B]"
        >
          تسوية الجرد
        </button>
        <button
          type="button"
          className="px-6 py-2 bg-gradient-to-r from-[#0E78AA] to-[#0A5F8A] text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-300 hover:from-[#0A5F8A] hover:to-[#084A6B]"
        >
          إلغاء التسوية
        </button>
        <button
          type="button"
          className="px-6 py-2 bg-gradient-to-r from-[#0E78AA] to-[#0A5F8A] text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-300 hover:from-[#0A5F8A] hover:to-[#084A6B]"
        >
          إستعادة
        </button>
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
          <div className="overflow-x-auto rounded-xl border border-[#D6EAF3] bg-white" data-tour-id="stocktaking-items-table">
            <table className="min-w-full text-center border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="bg-[#0E78AA] text-white py-2 px-2 text-xs font-bold border-r border-white/20">م</th>
                  <th className="bg-[#0E78AA] text-white py-2 px-2 text-xs font-bold border-r border-white/20">الصنف</th>
                  <th className="bg-[#0E78AA] text-white py-2 px-2 text-xs font-bold border-r border-white/20">القيمة الدفترية</th>
                  <th className="bg-[#0E78AA] text-white py-2 px-2 text-xs font-bold border-r border-white/20">الكمية الفعلية</th>
                  <th className="bg-[#0E78AA] text-white py-2 px-2 text-xs font-bold border-r border-white/20">العجز</th>
                  <th className="bg-[#0E78AA] text-white py-2 px-2 text-xs font-bold border-r border-white/20">الزيادة</th>
                  <th className="bg-[#0E78AA] text-white py-2 px-2 text-xs font-bold border-r border-white/20">السعر</th>
                  <th className="bg-[#0E78AA] text-white py-2 px-2 text-xs font-bold border-r border-white/20">قيمة العجز</th>
                  <th className="bg-[#0E78AA] text-white py-2 px-2 text-xs font-bold border-r border-white/20">قيمة الزيادة</th>
                  <th className="bg-[#0E78AA] text-white py-2 px-2 text-xs font-bold"> </th>
                </tr>
              </thead>
              <tbody>
                {stocktakingLines.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-sm text-slate-500">
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
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={inputCls}
                          value={line.bookValue || ''}
                          onChange={(e) => {
                            const bookValue = parseFloat(e.target.value) || 0;
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
                      <td className="py-1.5 px-2 border-x border-[#D6EAF3]">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={inputCls}
                          value={line.actualValue || ''}
                          onChange={(e) => {
                            const actualValue = parseFloat(e.target.value) || 0;
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
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={inputCls}
                          value={line.unitPrice || ''}
                          onChange={(e) => {
                            const next = [...stocktakingLines];
                            next[i] = { ...next[i], unitPrice: parseFloat(e.target.value) || 0 };
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
        onCancel={() => {
          setError('');
          setSuccess('');
          setStocktakingLines([]);
          reset(emptyStocktakingDefaults(new Date().toISOString().split('T')[0]));
        }}
        onSave={() =>
          void handleSubmit((values) => {
            setError('');
            setSuccess('');
            if (stocktakingLines.length === 0) {
              setError('يرجى إضافة أصناف لتسوية الجرد');
              return;
            }
            stocktakingMutation.mutate({
              serialNumber: values.serialNumber,
              description: values.description,
              date: values.date || new Date().toISOString(),
              hijriDate: values.hijriDate,
              warehouseId: values.warehouseId,
              isPosted: values.isPosted,
              useBarcode: values.useBarcode,
              hideExistingQty: values.hideExistingQty,
              excludeZeroValue: values.excludeZeroValue,
              lines: stocktakingLines.map((line) => ({
                itemId: line.itemId,
                bookValue: line.bookValue,
                actualValue: line.actualValue,
                shortage: line.shortage,
                surplus: line.surplus,
                unitPrice: line.unitPrice,
              })),
            });
          }, onFieldErrors(setError))()
        }
        saveLoading={loading}
        saveTourId="stocktaking-save-btn"
        status={`${stocktakingLines.length} بند · زيادة ${formatMoneyAr(stockTotals.surplus)} · عجز ${formatMoneyAr(stockTotals.shortage)}`}
        extraActions={
          <CrudButtons
            onAdd={() => {
              setError('');
              setSuccess('');
              setStocktakingLines([]);
              reset(emptyStocktakingDefaults(new Date().toISOString().split('T')[0]));
            }}
            extraItems={[
              { id: 'preview', label: 'معاينة', onClick: () => {} },
              { id: 'design', label: 'تصميم', onClick: () => {} },
            ]}
          />
        }
      />
    </div>
  );
}
