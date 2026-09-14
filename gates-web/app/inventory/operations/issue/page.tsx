'use client';

import { useState, useEffect, useRef } from 'react';
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
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  inventoryWarehouseDocHeaderFormSchema,
  inventoryReceiptLineSchema,
  type InventoryWarehouseDocHeaderFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { useIssueTourPrepare } from '@/lib/onboarding/useIssueTourPrepare';
import { consumeAiTransactionDraft } from '@/lib/ai/ai-draft-storage';
import { invoiceDateFromDraft, issueLinesFromAiDraft } from '@/lib/ai/hydrate-ai-draft';


interface Warehouse {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface Item {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface Location {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface IssueLine {
  itemId: string;
  locationId?: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
}

interface IssueDocumentDetail extends Record<string, unknown> {
  serialNumber?: string;
  description?: string;
  date?: string;
  hijriDate?: string;
  warehouseId?: string;
  record?: string;
  isPosted?: boolean;
  isApproved?: boolean;
  useBarcode?: boolean;
  hideExistingQty?: boolean;
  lines?: Record<string, unknown>[];
}

function emptyIssueFormDefaults(): InventoryWarehouseDocHeaderFormInput {
  const t = new Date().toISOString().split('T')[0];
  return {
    serialNumber: '',
    description: '',
    date: t,
    hijriDate: '',
    warehouseId: '',
    record: '',
    isPosted: false,
    isApproved: false,
    useBarcode: true,
    hideExistingQty: true,
  };
}

export default function IssuePage() {
  return (
    <DocumentModeProvider>
      <IssuePageInner />
    </DocumentModeProvider>
  );
}

function IssuePageInner() {
  const searchParams = useSearchParams();
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  useIssueTourPrepare();
  const invalidateQuery = useInvalidateQuery();

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
  } = useForm<InventoryWarehouseDocHeaderFormInput>({
    resolver: zodResolver(inventoryWarehouseDocHeaderFormSchema) as Resolver<InventoryWarehouseDocHeaderFormInput>,
    defaultValues: emptyIssueFormDefaults(),
    mode: 'onTouched',
  });

  const isPosted = watch('isPosted');
  const isApproved = watch('isApproved');

  const [issueLines, setIssueLines] = useState<IssueLine[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    () => searchParams.get('id')?.trim() || null
  );
  const fromAiDraft = searchParams.get('fromAiDraft') === '1';
  const aiDraftAppliedRef = useRef(false);

  useEffect(() => {
    if (!selectedIssueId) {
      setMode('create');
      return;
    }
    if (isPosted) lockToView();
    else setMode('edit');
  }, [isPosted, lockToView, selectedIssueId, setMode]);

  useEffect(() => {
    if (aiDraftAppliedRef.current || !fromAiDraft || selectedIssueId) return;
    const draft = consumeAiTransactionDraft('DRAFT_STOCK_ISSUE');
    if (!draft) return;
    aiDraftAppliedRef.current = true;
    const payload = draft.draftPayload;
    reset({
      ...emptyIssueFormDefaults(),
      warehouseId: String(payload.warehouseId ?? ''),
      description: typeof payload.description === 'string' ? payload.description : '',
      date: invoiceDateFromDraft(payload),
    });
    setIssueLines(issueLinesFromAiDraft(payload));
    window.history.replaceState(null, '', window.location.pathname);
  }, [fromAiDraft, reset, selectedIssueId]);

  const openIssue = (id: string | null) => {
    setSelectedIssueId(id);
    if (id) window.history.replaceState(null, '', `?id=${id}`);
    else window.history.replaceState(null, '', window.location.pathname);
  };
  const [showList, setShowList] = useState(false);

  // Fetch warehouses
  const { data: warehousesResponse, isLoading: warehousesLoading } = useApiQuery<Warehouse[]>(
    ['warehouses'],
    '/inventory/warehouses',
    { limit: 1000, isActive: true }
  );
  const warehouses = warehousesResponse?.data || [];

  // Fetch items
  const { data: itemsResponse, isLoading: itemsLoading } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 1000, isActive: true }
  );
  const items = itemsResponse?.data || [];

  // Fetch locations (if available)
  const { data: locationsResponse } = useApiQuery<Location[]>(
    ['locations'],
    '/inventory/locations',
    { limit: 1000, isActive: true }
  );
  const locations = locationsResponse?.data || [];

  // Fetch single issue for editing
  const { data: issueResponse } = useApiQuery<IssueDocumentDetail>(
    ['issue', selectedIssueId],
    `/inventory/issues/${selectedIssueId}`,
    undefined,
    { enabled: !!selectedIssueId }
  );
  const selectedIssue = issueResponse?.data;

  // Load receipt data when selected
  useEffect(() => {
    if (selectedIssue) {
      reset({
        serialNumber: selectedIssue.serialNumber || '',
        description: selectedIssue.description || '',
        date: selectedIssue.date
          ? new Date(selectedIssue.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        hijriDate: selectedIssue.hijriDate || '',
        warehouseId: selectedIssue.warehouseId || '',
        record: selectedIssue.record || '',
        isPosted: selectedIssue.isPosted || false,
        isApproved: selectedIssue.isApproved || false,
        useBarcode: selectedIssue.useBarcode ?? true,
        hideExistingQty: selectedIssue.hideExistingQty ?? true,
      });
      if (selectedIssue.lines) {
        setIssueLines(
          selectedIssue.lines.map((line: Record<string, unknown>) => ({
            itemId: String(line.itemId ?? ''),
            locationId: String(line.locationId ?? ''),
            quantity: Number(line.quantity || 0),
            unitPrice: Number(line.unitPrice || 0),
            total: Number(line.total || 0),
          }))
        );
      } else {
        setIssueLines([]);
      }
    }
  }, [selectedIssue, reset]);

  // Receipt create mutation
  const issueMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/issues',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ الصرف بنجاح');
        invalidateQuery(['issues']);
        setSelectedIssueId(null);
        setIssueLines([]);
        reset(emptyIssueFormDefaults());
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  // Receipt update mutation
  const issueUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedIssueId ? `/inventory/issues/${selectedIssueId}` : '/inventory/issues',
    'PUT',
    {
      onSuccess: () => {
        setSuccess('تم تحديث الصرف بنجاح');
        invalidateQuery(['issues']);
        invalidateQuery(['issue', selectedIssueId]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء التحديث');
      },
    }
  );

  // Receipt delete mutation
  const issueDeleteMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedIssueId ? `/inventory/issues/${selectedIssueId}` : '/inventory/issues',
    'DELETE',
    {
      onSuccess: () => {
        setSuccess('تم حذف الصرف بنجاح');
        invalidateQuery(['issues']);
        setSelectedIssueId(null);
        setIssueLines([]);
        reset(emptyIssueFormDefaults());
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحذف');
      },
    }
  );

  // Post receipt mutation
  const postIssueMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedIssueId ? `/inventory/issues/${selectedIssueId}/post` : '/inventory/issues',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم ترحيل الصرف بنجاح');
        setValue('isPosted', true);
        invalidateQuery(['issues']);
        invalidateQuery(['issue', selectedIssueId]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الترحيل');
      },
    }
  );

  // Unpost receipt mutation
  const unpostIssueMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedIssueId ? `/inventory/issues/${selectedIssueId}/unpost` : '/inventory/issues',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم فك ترحيل الصرف بنجاح');
        setValue('isPosted', false);
        invalidateQuery(['issues']);
        invalidateQuery(['issue', selectedIssueId]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء فك الترحيل');
      },
    }
  );

  const loading = issueMutation.isPending || issueUpdateMutation.isPending || issueDeleteMutation.isPending || warehousesLoading || itemsLoading;

  // Handle post/unpost
  const handlePostUnpost = async (post: boolean) => {
    if (!selectedIssueId) {
      setError('يرجى اختيار صرف أولاً');
      return;
    }

    if (post) {
      postIssueMutation.mutate({});
    } else {
      unpostIssueMutation.mutate({});
    }
  };

  // Handle delete
  const handleDelete = () => {
    if (!selectedIssueId) {
      setError('يرجى اختيار صرف أولاً');
      return;
    }

    if (window.confirm('هل أنت متأكد من حذف هذا الصرف؟')) {
      issueDeleteMutation.mutate({});
    }
  };

  // Handle new receipt
  const handleNew = () => {
    setSelectedIssueId(null);
    setIssueLines([]);
    setError('');
    setSuccess('');
    reset(emptyIssueFormDefaults());
  };

  const onSaveValid: SubmitHandler<InventoryWarehouseDocHeaderFormInput> = (values) => {
    setError('');
    setSuccess('');
    const linesParsed = z
      .array(inventoryReceiptLineSchema)
      .min(1, 'يرجى إضافة أصناف للصرف')
      .safeParse(issueLines);
    if (!linesParsed.success) {
      const msg = linesParsed.error.issues[0]?.message;
      setError(msg || 'تحقق من بنود الأصناف');
      return;
    }
    const requestBody = {
      serial: values.serialNumber || undefined,
      description: values.description || undefined,
      date: new Date(values.date).toISOString(),
      hijriDate: values.hijriDate || undefined,
      warehouseId: values.warehouseId,
      record: values.record || undefined,
      isPosted: values.isPosted || false,
      isApproved: values.isApproved || false,
      lines: issueLines.map((line) => ({
        itemId: line.itemId,
        locationId: line.locationId || undefined,
        quantity: line.quantity,
        unitPrice: line.unitPrice || undefined,
        total: line.total || undefined,
      })),
    };
    if (selectedIssueId) {
      issueUpdateMutation.mutate(requestBody);
    } else {
      issueMutation.mutate(requestBody);
    }
  };

  // Add receipt line
  const addIssueLine = () => {
    setIssueLines([...issueLines, {
      itemId: '',
      locationId: '',
      quantity: 0,
      unitPrice: 0,
      total: 0,
    }]);
  };

  // Remove receipt line
  const removeIssueLine = (index: number) => {
    setIssueLines(issueLines.filter((_, i) => i !== index));
  };

  // Update receipt line
  const updateIssueLine = (index: number, field: keyof IssueLine, value: string | number) => {
    const updatedLines = [...issueLines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    
    // Calculate total if quantity or unitPrice changed
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? parseFloat(String(value)) || 0 : updatedLines[index].quantity || 0;
      const unitPrice = field === 'unitPrice' ? parseFloat(String(value)) || 0 : updatedLines[index].unitPrice || 0;
      updatedLines[index].total = quantity * unitPrice;
    }
    
    setIssueLines(updatedLines);
  };

  // Calculate totals
  const totalAmount = issueLines.reduce((sum, line) => sum + (line.total || 0), 0);

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'إذن صرف' },
        ]}
        title="إذن صرف مخزني"
        docNumber={watch('serialNumber') || ''}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحّل' : 'مسودة'}
        saveLabel="حفظ"
        onSaveDraft={() => void handleSubmit(onSaveValid, onFieldErrors(setError))()}
        onCancel={handleNew}
        cancelLabel="تراجع"
        onPost={() => handlePostUnpost(true)}
        savePending={loading}
        postPending={postIssueMutation.isPending}
        canPost={!!selectedIssueId && !isPosted}
        canSave={!isReadOnly && !isPosted}
        hideStandalonePost
        navEntity="issue"
        currentId={selectedIssueId}
        onNavigate={openIssue}
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        standardActions={{
          hasDocument: Boolean(selectedIssueId),
          isPosted,
          onEdit: () => {
            if (isPosted) {
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

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="أذون الصرف السابقة">
        <StockDocumentsListSection
          title=""
          apiPath="/inventory/issues"
          listKey="issues"
          variant="issue"
          selectedId={selectedIssueId}
          onSelect={(id) => {
            openIssue(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <DocumentReadOnlyBanner />
      <DocumentFormLock>
      <FormSectionCard title="بيانات الإذن" subtitle="المخزن والتاريخ والمرجع" bodyClassName="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2" data-tour="stock-movement-types">
                <span className="text-sm text-[#0A3D5E] font-medium">الترحيل:</span>
                <div className="flex bg-gray-200 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => handlePostUnpost(true)}
                    disabled={!selectedIssueId || postIssueMutation.isPending}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${isPosted ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'} ${!selectedIssueId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {postIssueMutation.isPending ? 'جاري...' : 'ترحيل'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePostUnpost(false)}
                    disabled={!selectedIssueId || unpostIssueMutation.isPending}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${!isPosted ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'} ${!selectedIssueId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {unpostIssueMutation.isPending ? 'جاري...' : 'فك ترحيل'}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#0A3D5E] font-medium">الموافقة:</span>
                <div className="flex bg-gray-200 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setValue('isApproved', true)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${isApproved ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                  >
                    موافق
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('isApproved', false)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${!isApproved ? 'bg-[#0E78AA] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                  >
                    غير موافق
                  </button>
                </div>
              </div>
            </div>
            <StatusBadge
              variant={isPosted ? 'success' : 'warning'}
              label={isPosted ? 'مرحّل' : 'مسودة'}
            />
          </div>

          <CompactFormField label="المسلسل" placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
          <CompactFormField
            label="التاريخ"
            type="date"
            error={errors.date?.message}
            {...register('date')}
          />
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
          <CompactFormField label="الشرح" placeholder="إدخل الشرح" {...register('description')} />
      </FormSectionCard>
      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CompactFormField label="رقم القيد" placeholder="إدخل رقم القيد" {...register('record')} />
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

      <FormSectionCard title="بنود الصرف" subtitle="الصنف والكمية والسعر" bodyClassName="space-y-3">
          {isReadOnly ? null : (
          <div className="flex items-center justify-end">
            <Button type="button" variant="primary" className="gap-2" onClick={addIssueLine}>
              <Plus className="h-4 w-4" aria-hidden />
              إضافة صنف
            </Button>
          </div>
          )}
          {issueLines.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">لا توجد أصناف. اضغط «إضافة صنف».</p>
          ) : (
            issueLines.map((line, index) => (
              <div
                key={`issue-line-${index}`}
                className="grid grid-cols-1 gap-3 rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-3 md:grid-cols-6"
              >
                <div className="md:col-span-2">
                  <label className={labelCls}>الصنف</label>
                  <select
                    className={inputCls}
                    value={line.itemId}
                    onChange={(e) => updateIssueLine(index, 'itemId', e.target.value)}
                    disabled={itemsLoading}
                  >
                    <option value="">اختر الصنف</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.arabicName} ({item.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>الموقع</label>
                  {locations.length > 0 ? (
                    <select
                      className={inputCls}
                      value={line.locationId || ''}
                      onChange={(e) => updateIssueLine(index, 'locationId', e.target.value)}
                    >
                      <option value="">اختر</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.arabicName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </div>
                <div>
                  <label className={labelCls}>الكمية</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={line.quantity || ''}
                    onChange={(e) => updateIssueLine(index, 'quantity', parseFloat(e.target.value) || 0)}
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
                    onChange={(e) => updateIssueLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
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
                    onClick={() => removeIssueLine(index)}
                  />
                </div>
                )}
              </div>
            ))
          )}
      </FormSectionCard>
      </DocumentFormLock>

      {isReadOnly ? null : (
      <FormStickyFooter
        status={`${issueLines.length} بند · ${totalAmount.toLocaleString('ar-EG')} ج.م`}
      />
      )}

      <StockMovementBottomSplit
        totalAmount={totalAmount}
        lineCount={issueLines.length}
        journalEntryId={(selectedIssue as { journalEntryId?: string })?.journalEntryId}
        documentId={selectedIssueId}
      />
    </ErpDocumentLayout>
  );
}

