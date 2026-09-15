'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  DocumentFormLock,
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';
import { useForm, type Resolver, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { StockMovementBottomSplit } from '@/components/inventory/stock/StockMovementBottomSplit';
import { Plus, Trash2 } from 'lucide-react';
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
import { StockDocumentsListSection } from '@/components/inventory/StockDocumentsListSection';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import { ItemSelect } from '@/components/form/ItemSelect';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  inventoryTransferHeaderFormSchema,
  inventoryStdLineSchema,
  type InventoryTransferHeaderFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';
import { onFieldErrors } from '@/lib/forms/on-field-errors';


interface TransferLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

interface TransferDocumentDetail extends Record<string, unknown> {
  serialNumber?: string;
  description?: string;
  date?: string;
  hijriDate?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  fromCostCenterId?: string;
  toCostCenterId?: string;
  isPosted?: boolean;
  items?: Record<string, unknown>[];
  lines?: Record<string, unknown>[];
}

function emptyTransferFormDefaults(): InventoryTransferHeaderFormInput {
  const t = new Date().toISOString().split('T')[0];
  return {
    serialNumber: '',
    description: '',
    date: t,
    hijriDate: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    fromCostCenterId: '',
    toCostCenterId: '',
    statusPosted: false,
    useBarcode: true,
    hideExistingQty: true,
  };
}

export default function TransferPage() {
  return (
    <DocumentModeProvider>
      <TransferPageInner />
    </DocumentModeProvider>
  );
}

function TransferPageInner() {
  const searchParams = useSearchParams();
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  const invalidateQuery = useInvalidateQuery();
  const todayStr = new Date().toISOString().split('T')[0];

  const inputCls = compactControlClass;
  const labelCls = compactLabelClass;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<InventoryTransferHeaderFormInput>({
    resolver: zodResolver(inventoryTransferHeaderFormSchema) as Resolver<InventoryTransferHeaderFormInput>,
    defaultValues: {
      serialNumber: '',
      description: '',
      date: todayStr,
      hijriDate: '',
      fromWarehouseId: '',
      toWarehouseId: '',
      fromCostCenterId: '',
      toCostCenterId: '',
      statusPosted: false,
      useBarcode: true,
      hideExistingQty: true,
    },
    mode: 'onTouched',
  });

  const statusPosted = watch('statusPosted');

  const [transferLines, setTransferLines] = useState<TransferLine[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(
    () => searchParams.get('id')?.trim() || null
  );

  useEffect(() => {
    if (!selectedTransferId) {
      setMode('create');
      return;
    }
    if (statusPosted) lockToView();
    else setMode('edit');
  }, [lockToView, selectedTransferId, setMode, statusPosted]);

  const openTransfer = (id: string | null) => {
    setSelectedTransferId(id);
    if (id) window.history.replaceState(null, '', `?id=${id}`);
    else window.history.replaceState(null, '', window.location.pathname);
  };
  const [showList, setShowList] = useState(false);

  // Fetch single transfer for editing
  const { data: transferResponse } = useApiQuery<TransferDocumentDetail>(
    ['transfer', selectedTransferId],
    `/inventory/transfers/${selectedTransferId}`,
    undefined,
    { enabled: !!selectedTransferId }
  );
  const selectedTransfer = transferResponse?.data;

  // Load transfer data when selected
  useEffect(() => {
    if (selectedTransfer) {
      reset({
        serialNumber: selectedTransfer.serialNumber || '',
        description: selectedTransfer.description || '',
        date: selectedTransfer.date
          ? new Date(selectedTransfer.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        hijriDate: selectedTransfer.hijriDate || '',
        fromWarehouseId: selectedTransfer.fromWarehouseId || '',
        toWarehouseId: selectedTransfer.toWarehouseId || '',
        fromCostCenterId: selectedTransfer.fromCostCenterId || '',
        toCostCenterId: selectedTransfer.toCostCenterId || '',
        statusPosted: selectedTransfer.isPosted || false,
        useBarcode: true,
        hideExistingQty: true,
      });
      if (selectedTransfer.items || selectedTransfer.lines) {
        const lines = selectedTransfer.items || selectedTransfer.lines || [];
        setTransferLines(
          lines.map((line: Record<string, unknown>) => ({
            itemId: String(line.itemId ?? ''),
            quantity: Number(
              line.transMainQty ??
                line.transQty ??
                line.quantity ??
                line.qty ??
                0,
            ),
            unitPrice: Number(line.unitPrice ?? line.price ?? 0),
          }))
        );
      } else {
        setTransferLines([]);
      }
    }
  }, [selectedTransfer, reset]);

  // Transfer create mutation
  const transferMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/transfers',
    'POST',
    {
      onSuccess: () => {
        invalidateQuery(['transfers']);
        handleNew();
        setSuccess('تم حفظ النقل المخزني بنجاح');
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  // Transfer update mutation
  const transferUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedTransferId ? `/inventory/transfers/${selectedTransferId}` : '/inventory/transfers',
    'PUT',
    {
      onSuccess: () => {
        invalidateQuery(['transfers']);
        handleNew();
        setSuccess('تم تحديث النقل المخزني بنجاح');
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء التحديث');
      },
    }
  );

  // Transfer delete mutation
  const transferDeleteMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedTransferId ? `/inventory/transfers/${selectedTransferId}` : '/inventory/transfers',
    'DELETE',
    {
      onSuccess: () => {
        setSuccess('تم حذف النقل المخزني بنجاح');
        invalidateQuery(['transfers']);
        setSelectedTransferId(null);
        setTransferLines([]);
        reset(emptyTransferFormDefaults());
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحذف');
      },
    }
  );

  // Post transfer mutation
  const postTransferMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedTransferId ? `/inventory/transfers/${selectedTransferId}/post` : '/inventory/transfers',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم ترحيل النقل المخزني بنجاح');
        setValue('statusPosted', true);
        invalidateQuery(['transfers']);
        invalidateQuery(['transfer', selectedTransferId]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الترحيل');
      },
    }
  );

  // Unpost transfer mutation
  const unpostTransferMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedTransferId ? `/inventory/transfers/${selectedTransferId}/unpost` : '/inventory/transfers',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم فك ترحيل النقل المخزني بنجاح');
        setValue('statusPosted', false);
        invalidateQuery(['transfers']);
        invalidateQuery(['transfer', selectedTransferId]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء فك الترحيل');
      },
    }
  );

  const loading = transferMutation.isPending || transferUpdateMutation.isPending || transferDeleteMutation.isPending;

  // Handle post/unpost
  const handlePostUnpost = async (post: boolean) => {
    if (!selectedTransferId) {
      setError('يرجى اختيار نقل أولاً');
      return;
    }

    if (post) {
      postTransferMutation.mutate({});
    } else {
      unpostTransferMutation.mutate({});
    }
  };

  // Handle delete
  const handleDelete = () => {
    if (!selectedTransferId) {
      setError('يرجى اختيار نقل أولاً');
      return;
    }

    if (window.confirm('هل أنت متأكد من حذف هذا النقل؟')) {
      transferDeleteMutation.mutate({});
    }
  };

  // Handle new transfer
  const handleNew = () => {
    openTransfer(null);
    setTransferLines([]);
    setError('');
    setSuccess('');
    reset(emptyTransferFormDefaults());
  };

  const addTransferLine = () => {
    setTransferLines([...transferLines, { itemId: '', quantity: 0, unitPrice: 0 }]);
  };

  const removeTransferLine = (index: number) => {
    setTransferLines(transferLines.filter((_, i) => i !== index));
  };

  const updateTransferLine = (index: number, field: keyof TransferLine, value: string | number) => {
    const updatedLines = [...transferLines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    setTransferLines(updatedLines);
  };

  const totalAmount = transferLines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
    0
  );

  const onSaveValid: SubmitHandler<InventoryTransferHeaderFormInput> = (values) => {
    setError('');
    setSuccess('');
    const linesParsed = z.array(inventoryStdLineSchema).min(1, 'يرجى إضافة أصناف للنقل').safeParse(transferLines);
    if (!linesParsed.success) {
      const msg = linesParsed.error.issues[0]?.message;
      setError(msg || 'تحقق من بنود الأصناف');
      return;
    }
    const requestBody = {
      serialNumber: values.serialNumber,
      description: values.description,
      date: values.date || new Date().toISOString(),
      hijriDate: values.hijriDate,
      fromWarehouseId: values.fromWarehouseId,
      toWarehouseId: values.toWarehouseId,
      fromCostCenterId: values.fromCostCenterId || undefined,
      toCostCenterId: values.toCostCenterId || undefined,
      isPosted: values.statusPosted || false,
      useBarcode: values.useBarcode,
      lines: transferLines.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    };
    if (selectedTransferId) {
      transferUpdateMutation.mutate(requestBody);
    } else {
      transferMutation.mutate(requestBody);
    }
  };

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'تحويل مخزني' },
        ]}
        title="تحويل بين المخازن"
        docNumber={watch('serialNumber') || ''}
        statusTone={statusPosted ? 'success' : 'warning'}
        statusLabel={statusPosted ? 'مرحّل' : 'مسودة'}
        saveLabel="حفظ"
        onSaveDraft={() => void handleSubmit(onSaveValid, onFieldErrors(setError))()}
        onCancel={handleNew}
        cancelLabel="تراجع"
        onPost={() => handlePostUnpost(true)}
        postTriggerId="inventory-transfer.post-click"
        savePending={loading}
        postPending={postTransferMutation.isPending}
        canPost={!!selectedTransferId && !statusPosted}
        canSave={!isReadOnly && !statusPosted}
        hideStandalonePost
        navEntity="transfer"
        currentId={selectedTransferId}
        onNavigate={openTransfer}
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        standardActions={{
          hasDocument: Boolean(selectedTransferId),
          isPosted: statusPosted,
          onEdit: () => {
            if (statusPosted) {
              setError('يجب إلغاء الترحيل أولاً للتعديل');
              return;
            }
            unlockForEdit();
          },
          onPost: () => handlePostUnpost(true),
          onUnpost: () => handlePostUnpost(false),
          onVoid: handleDelete,
          onNew: handleNew,
          newLabel: 'جديد',
        }}
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="التحويلات السابقة">
        <StockDocumentsListSection
          title=""
          apiPath="/inventory/transfers"
          listKey="transfers"
          variant="transfer"
          selectedId={selectedTransferId}
          onSelect={(id) => {
            openTransfer(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <DocumentReadOnlyBanner />
      <DocumentFormLock>
      <FormSectionCard title="بيانات التحويل" subtitle="المسلسل والتاريخ والمخازن" bodyClassName="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#0A3D5E] font-medium">الترحيل:</span>
                <div className="flex bg-gray-200 rounded-lg p-1">
                  <button 
                    onClick={() => handlePostUnpost(true)}
                    disabled={!selectedTransferId || postTransferMutation.isPending}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${statusPosted ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'} ${!selectedTransferId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {postTransferMutation.isPending ? 'جاري...' : 'ترحيل'}
                  </button>
                  <button 
                    onClick={() => handlePostUnpost(false)}
                    disabled={!selectedTransferId || unpostTransferMutation.isPending}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${!statusPosted ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'} ${!selectedTransferId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {unpostTransferMutation.isPending ? 'جاري...' : 'فك ترحيل'}
                  </button>
                </div>
              </div>
            </div>
            <StatusBadge
              variant={statusPosted ? 'success' : 'warning'}
              label={statusPosted ? 'مرحّل' : 'مسودة'}
            />
          </div>

          <CompactFormField label="المسلسل" placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
          <CompactFormField
            label="التاريخ"
            type="date"
            error={errors.date?.message}
            {...register('date')}
          />
          <CompactFormField label="الشرح" placeholder="إدخل الشرح" {...register('description')} />
          <div data-tour-id="transfer-warehouses">
            <CompactFormField label="من مخزن" error={errors.fromWarehouseId?.message}>
              <Controller
                name="fromWarehouseId"
                control={control}
                render={({ field }) => (
                  <WarehouseSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    className={`${inputCls} ${errors.fromWarehouseId ? 'border-red-400' : ''}`}
                    emptyLabel="اختر المخزن"
                  />
                )}
              />
            </CompactFormField>
          </div>
          <CompactFormField label="إلى مخزن" error={errors.toWarehouseId?.message}>
            <Controller
              name="toWarehouseId"
              control={control}
              render={({ field }) => (
                <WarehouseSelect
                  value={field.value || ''}
                  onChange={field.onChange}
                  className={`${inputCls} ${errors.toWarehouseId ? 'border-red-400' : ''}`}
                  emptyLabel="اختر المخزن"
                />
              )}
            />
          </CompactFormField>
      </FormSectionCard>
      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <CompactFormField label="من م التكلفة">
            <Controller
              name="fromCostCenterId"
              control={control}
              render={({ field }) => (
                <CostCenterSelect
                  value={field.value || ''}
                  onChange={field.onChange}
                  className={inputCls}
                  emptyLabel="اختر مركز التكلفة"
                />
              )}
            />
          </CompactFormField>
          <CompactFormField label="إلى م التكلفة">
            <Controller
              name="toCostCenterId"
              control={control}
              render={({ field }) => (
                <CostCenterSelect
                  value={field.value || ''}
                  onChange={field.onChange}
                  className={inputCls}
                  emptyLabel="اختر مركز التكلفة"
                />
              )}
            />
          </CompactFormField>
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
                  استخدام الباركود
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
        </div>
      </AdvancedFieldsSection>

      <div data-tour-id="transfer-lines-card">
      <FormSectionCard title="بنود التحويل" subtitle="الصنف والكمية والسعر" bodyClassName="space-y-3">
          {isReadOnly ? null : (
          <div className="flex items-center justify-end">
            <Button type="button" variant="primary" className="gap-2" onClick={addTransferLine}>
              <Plus className="h-4 w-4" aria-hidden />
              إضافة صنف
            </Button>
          </div>
          )}
          {transferLines.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">لا توجد أصناف. اضغط «إضافة صنف».</p>
          ) : (
            transferLines.map((line, index) => (
              <div
                key={`transfer-line-${index}`}
                className="grid grid-cols-1 gap-3 rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-3 md:grid-cols-6"
              >
                <div className="md:col-span-2">
                  <label className={labelCls}>الصنف</label>
                  <ItemSelect
                    value={line.itemId}
                    onChange={(id) => updateTransferLine(index, 'itemId', id)}
                    className={inputCls}
                    emptyLabel="اختر الصنف"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {selectedTransferId ? 'الكمية المنقولة' : 'الكمية المتاحة'}
                  </label>
                  <span className={`${inputCls} flex items-center text-slate-500`}>
                    {selectedTransferId
                      ? (line.quantity || 0).toLocaleString('ar-EG', {
                          maximumFractionDigits: 4,
                        })
                      : '—'}
                  </span>
                </div>
                <div>
                  <label className={labelCls}>الكمية المنقولة</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={line.quantity || ''}
                    onChange={(e) =>
                      updateTransferLine(index, 'quantity', parseFloat(e.target.value) || 0)
                    }
                    min={0}
                    step="0.01"
                  />
                </div>
                <div>
                  <label className={labelCls}>السعر</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={line.unitPrice || ''}
                    onChange={(e) =>
                      updateTransferLine(index, 'unitPrice', parseFloat(e.target.value) || 0)
                    }
                    min={0}
                    step="0.01"
                  />
                </div>
                {isReadOnly ? null : (
                <div className="flex items-end justify-end">
                  <IconButton
                    icon={Trash2}
                    label="حذف السطر"
                    variant="danger"
                    onClick={() => removeTransferLine(index)}
                  />
                </div>
                )}
              </div>
            ))
          )}
      </FormSectionCard>
      </div>
      </DocumentFormLock>

      {isReadOnly ? null : (
      <FormStickyFooter
        status={`${transferLines.length} بند · ${totalAmount.toLocaleString('ar-EG')} ج.م`}
      />
      )}

      <StockMovementBottomSplit
        totalAmount={totalAmount}
        lineCount={transferLines.length}
        journalEntryId={(selectedTransfer as { journalEntryId?: string })?.journalEntryId}
        documentId={selectedTransferId}
      />
    </ErpDocumentLayout>
  );
}



