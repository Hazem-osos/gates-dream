'use client';

import { useState, useEffect, useMemo } from 'react';
import { Banknote, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import {
  AppTable,
  CompactFormField,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { formatMoneyAr } from '@/lib/formatMoney';
import {
  exportExtractReportRows,
  EXTRACT_PAYMENT_EXPORT_COLUMNS,
  printExtractPaymentReport,
} from '@/lib/reports/simpleReportActions';
import type { ApiError } from '@/lib/api/types';

type ExtractProjectOption = {
  id: string;
  arabicName?: string;
  serial?: string;
};

type ExtractContractorOption = {
  id: string;
  arabicName?: string;
  serial?: string | null;
};

type ExtractPaymentRow = {
  id: string;
  notes?: string | null;
  paymentAmount?: number | string | null;
  itemGroup?: string | null;
  description?: string | null;
  extract?: { extractNumber?: string | null };
  contractor?: { arabicName?: string; serial?: string | null };
};

export default function ExtractPaymentPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [formData, setFormData] = useState({
    serial: '',
    description: '',
    projectId: '',
    contractorId: '',
    date: '',
    amount: '',
    chequeNumber: '',
  });

  const { data: projectsResponse } = useApiQuery<ExtractProjectOption[]>(
    ['projects'],
    '/extracts/projects',
    { limit: 1000, isActive: true }
  );
  const projects = projectsResponse?.data ?? [];

  const { data: contractorsResponse } = useApiQuery<ExtractContractorOption[]>(
    ['contractors'],
    '/extracts/contractors',
    { limit: 1000, isActive: true }
  );
  const contractors = contractorsResponse?.data ?? [];

  const paymentListParams = useMemo(() => {
    if (!formData.projectId) return undefined;
    const p: Record<string, string | number> = { page, limit: pageSize };
    if (formData.projectId) p.projectId = formData.projectId;
    if (formData.contractorId) p.contractorId = formData.contractorId;
    return p;
  }, [formData.projectId, formData.contractorId, page, pageSize]);

  const { data: paymentsResponse, isLoading: paymentsLoading } = useApiQuery<ExtractPaymentRow[]>(
    ['extract-payments', paymentListParams, page],
    '/extracts/payments',
    paymentListParams,
    { enabled: !!formData.projectId }
  );
  const paymentRows = paymentsResponse?.data ?? [];
  const paymentRowsTotal = paymentsResponse?.pagination?.total ?? paymentsResponse?.meta?.total ?? paymentRows.length;

  useEffect(() => {
    setPage(1);
  }, [formData.projectId, formData.contractorId]);

  const paymentTotal = useMemo(() => {
    let sum = 0;
    for (const row of paymentRows) {
      const n =
        typeof row.paymentAmount === 'string'
          ? parseFloat(row.paymentAmount)
          : Number(row.paymentAmount);
      if (!Number.isNaN(n)) sum += n;
    }
    return sum;
  }, [paymentRows]);

  const paymentMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/extracts/payments',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ سداد المستخلص بنجاح');
        invalidateQuery(['extract-payments']);
        handleCancel();
      },
      onError: (apiError: ApiError) => {
        setError(apiError.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, date: today }));
  }, []);

  const handleSave = () => {
    setError('');
    setSuccess('');

    if (!formData.projectId) {
      setError('يرجى اختيار المشروع');
      return;
    }

    if (!formData.contractorId) {
      setError('يرجى اختيار المقاول');
      return;
    }

    if (!formData.date) {
      setError('يرجى تحديد التاريخ');
      return;
    }

    paymentMutation.mutate({
      serial: formData.serial || undefined,
      description: formData.description || undefined,
      projectId: formData.projectId,
      contractorId: formData.contractorId,
      date: new Date(formData.date).toISOString(),
      amount: formData.amount ? parseFloat(formData.amount) : undefined,
    });
  };

  const handleCancel = () => {
    setFormData({
      serial: '',
      description: '',
      projectId: '',
      contractorId: '',
      date: new Date().toISOString().split('T')[0],
      amount: '',
      chequeNumber: '',
    });
    setSelectedPaymentIds([]);
    setError('');
    setSuccess('');
  };

  const handleAddNew = () => {
    setFormData((prev) => ({
      serial: '',
      description: '',
      projectId: prev.projectId,
      contractorId: prev.contractorId,
      date: new Date().toISOString().split('T')[0],
      amount: '',
      chequeNumber: '',
    }));
    setSelectedPaymentIds([]);
    setError('');
  };

  const handleEditSelected = () => {
    if (selectedPaymentIds.length !== 1) {
      setError('اختر سجل سداد واحد للتعديل');
      return;
    }
    const row = paymentRows.find((r) => r.id === selectedPaymentIds[0]);
    if (!row) return;
    setFormData((prev) => ({
      ...prev,
      serial: row.notes ?? '',
      description: row.description ?? '',
      amount:
        row.paymentAmount != null && row.paymentAmount !== ''
          ? String(row.paymentAmount)
          : '',
    }));
    setError('');
  };

  const rowsForExport = useMemo(() => {
    if (!selectedPaymentIds.length) return paymentRows;
    const set = new Set(selectedPaymentIds);
    return paymentRows.filter((r) => set.has(r.id));
  }, [paymentRows, selectedPaymentIds]);

  const handlePrint = () => {
    if (!paymentRows.length) {
      setError('لا توجد سجلات للطباعة');
      return;
    }
    printExtractPaymentReport('سداد المستخلص');
  };

  const handleExport = async () => {
    if (!rowsForExport.length) {
      setError('لا توجد سجلات للتصدير');
      return;
    }
    await exportExtractReportRows(
      'extract-payments',
      EXTRACT_PAYMENT_EXPORT_COLUMNS,
      rowsForExport as unknown as Record<string, unknown>[]
    );
  };

  return (
    <ExtractsPageChrome
      title="سداد المستخلص"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'سداد المستخلص' },
      ]}
      onSave={handleSave}
      savePending={paymentMutation.isPending}
      onNew={handleAddNew}
      statusLabel={formData.projectId ? 'تعديل' : 'جديد'}
      favoriteHref="/extracts/operations/extract-payment"
      currentId={selectedPaymentIds[0] ?? null}
      browseList={{
        title: 'سندات السداد السابقة',
        apiPath: '/extracts/payments',
        listKey: 'extract-payments-browse',
        selectedId: selectedPaymentIds[0] ?? null,
        columns: [
          { id: 'extract', header: 'المستخلص', getValue: (r) => String((r.extract as { extractNumber?: string } | undefined)?.extractNumber || r.id) },
          { id: 'amount', header: 'المبلغ', getValue: (r) => String(r.paymentAmount ?? '—') },
          { id: 'notes', header: 'البيان', getValue: (r) => String(r.description || r.notes || '—') },
        ],
        onSelect: (id, row) => {
          setSelectedPaymentIds([id]);
          setFormData((prev) => ({
            ...prev,
            serial: String(row.notes ?? ''),
            description: String(row.description ?? ''),
            amount: row.paymentAmount != null && row.paymentAmount !== '' ? String(row.paymentAmount) : '',
          }));
        },
      }}
      extraActions={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={handleEditSelected}>
            تعديل المحدد
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void handleExport()}>
            تصدير
          </Button>
          <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />
            طباعة
          </Button>
        </>
      }
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard title="بيانات السداد" subtitle="المشروع والمقاول وقيمة السند" icon={Banknote}>
        <CompactFormField
          label="الكود"
          placeholder="تلقائي"
          value={formData.serial}
          onChange={(e) => setFormData((p) => ({ ...p, serial: e.target.value }))}
        />
        <CompactFormField
          label="التاريخ"
          type="date"
          value={formData.date}
          onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
        />
        <CompactFormField label="المشروع" required>
          <select
            className={compactControlClass}
            value={formData.projectId}
            onChange={(e) => setFormData((p) => ({ ...p, projectId: e.target.value }))}
          >
            <option value="">— اختر مشروعاً —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.arabicName ?? p.serial ?? p.id}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField label="المقاول" required>
          <select
            className={compactControlClass}
            value={formData.contractorId}
            onChange={(e) => setFormData((p) => ({ ...p, contractorId: e.target.value }))}
          >
            <option value="">— اختر مقاولاً —</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.arabicName ?? c.serial ?? c.id}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField
          label="قيمة السند"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={formData.amount}
          onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
        />
        <CompactFormField
          label="رقم الشيك"
          placeholder="إدخل رقم الشيك"
          value={formData.chequeNumber}
          onChange={(e) => setFormData((p) => ({ ...p, chequeNumber: e.target.value }))}
        />
        <CompactFormField label="الشرح" className="sm:col-span-2">
          <textarea
            placeholder="إدخل الشرح"
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            className={`${compactControlClass} h-20 max-w-none resize-none py-2`}
          />
        </CompactFormField>
      </FormSectionCard>

      <AppTable
        columns={[
          { id: 'idx', header: 'م', cell: (_row, index) => index + 1 },
          { id: 'extract', header: 'المستخلص', cell: (row) => row.extract?.extractNumber ?? '—' },
          { id: 'contractorSerial', header: 'المقاول', cell: (row) => row.contractor?.serial ?? '—' },
          { id: 'contractorName', header: 'إسم المقاول', cell: (row) => row.contractor?.arabicName ?? '—' },
          { id: 'group', header: 'مجموعة البند', accessor: 'itemGroup' },
          {
            id: 'value',
            header: 'القيمة',
            numeric: true,
            cell: (row) => {
              const amount =
                typeof row.paymentAmount === 'string'
                  ? parseFloat(row.paymentAmount)
                  : Number(row.paymentAmount);
              return formatMoneyAr(amount);
            },
          },
          { id: 'notes', header: 'ملاحظات', cell: (row) => row.notes ?? row.description ?? '—' },
        ]}
        data={paymentRows}
        getRowKey={(row) => row.id}
        isLoading={paymentsLoading}
        emptyTitle={!formData.projectId ? 'اختر المشروع (والمقاول) لعرض سجلات السداد.' : 'لا توجد دفعات مسجلة لهذا الاختيار.'}
        exportFileName="extract-payments"
        onRowClick={(row) =>
          setSelectedPaymentIds((prev) =>
            prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]
          )
        }
        rowClassName={(row) => (selectedPaymentIds.includes(row.id) ? 'bg-[#E8F4FA]' : undefined)}
        pagination={{
          page,
          pageSize,
          totalItems: paymentRowsTotal,
          onPageChange: setPage,
        }}
      />

      <FormSectionCard title="الإجماليات">
        <CompactFormField label="إجمالي المستخلصات" readOnly value={formatMoneyAr(paymentTotal)} />
        <CompactFormField label="إجمالي المدفوع سابقاً" readOnly value={formatMoneyAr(paymentTotal)} />
        <CompactFormField
          label="إجمالي السند"
          readOnly
          value={formData.amount ? formatMoneyAr(parseFloat(formData.amount)) : '—'}
        />
      </FormSectionCard>
    </ExtractsPageChrome>
  );
}
