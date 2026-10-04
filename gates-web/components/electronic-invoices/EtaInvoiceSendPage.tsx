'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabPathname, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import {
  Button,
  FormSectionCard,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { formatMoneyAr } from '@/lib/formatMoney';
import { useDocumentProfiles } from '@/lib/hooks/useDocumentProfiles';
import { buildSalesInvoicePatternOptions } from '@/lib/electronic-invoices/salesPatterns';
import type { DocumentBaseType } from '@/lib/document-profiles/types';
import { EtaSignAndSendDialog } from '@/components/electronic-invoices/EtaSignAndSendDialog';
import { EtaInvoiceStatusDialog } from '@/components/electronic-invoices/EtaInvoiceStatusDialog';
import {
  ReportFilterBranchSelect,
  ReportFilterCombobox,
  ReportFilterCostCenterSelect,
  ReportFilterDateRange,
  ReportFilterDelegateSelect,
  ReportFilterField,
  ReportFilterItemGroupSelect,
  ReportFilterItemSelect,
  ReportFilterPartySelect,
  ReportFilterWarehouseSelect,
  reportFilterInputClass,
  reportFilterUnifiedFieldsClass,
} from '@/components/report/reportFilterFields';

export type EtaReadinessRow = {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  delegateName?: string | null;
  branchName?: string | null;
  profileName?: string | null;
  currencyCode?: string | null;
  amountBeforeTax?: number | null;
  taxAmount?: number | null;
  netAmount: number;
  submittedNet?: number | null;
  submittedAt?: string | null;
  documentUuid?: string | null;
  etaStatus: string;
  ready: boolean;
  missing: string[];
  modifiedAfterSubmit?: boolean;
  amendmentMethod?: 'cancel-resubmit' | 'credit' | 'debit' | 'unsupported' | null;
};

const AMEND_AR: Record<string, string> = {
  'cancel-resubmit': 'إلغاء ثم إعادة إرسال (خلال 72 ساعة)',
  credit: 'إشعار خصم بالمرجع UUID',
  debit: 'إشعار إضافة بالمرجع UUID',
  unsupported: 'لا يُرسل تلقائيًا',
};

const STATUS_AR: Record<string, string> = {
  NOT_SUBMITTED: 'غير مرسلة',
  PENDING: 'معلقة',
  PROCESSING: 'قيد المعالجة',
  SUBMITTED: 'مرسلة',
  VALID: 'مقبولة',
  INVALID: 'مرفوضة',
};

function formatDate(value: string) {
  if (!value) return '—';
  return value.slice(0, 10);
}

type SendView = 'new' | 'debit' | 'credit';

function viewFromQuery(value: string | null): SendView {
  if (value === 'debit' || value === 'credit') return value;
  return 'new';
}

export function EtaInvoiceSendPage({ title }: { title: string }) {
  const router = useRouter();
  const pathname = useOwnTabPathname();
  const searchParams = useOwnTabSearchParams();
  const initialView = viewFromQuery(searchParams.get('view'));
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    customerId: '',
    delegateId: '',
    warehouseId: '',
    branchId: '',
    itemId: '',
    itemGroupId: '',
    costCenterId: '',
    invoiceNumber: '',
    profileId: '',
  });
  const [view, setView] = useState<SendView>(initialView);
  const invoiceKind = view === 'credit' ? 'SALE_RETURN' : 'SALE';
  const amended = view === 'debit';
  const profileBaseType: DocumentBaseType =
    invoiceKind === 'SALE_RETURN' ? 'SALES_RETURN' : 'SALES_INVOICE';
  const { data: profilesRes } = useDocumentProfiles({ baseType: profileBaseType });
  const { data: modulesRes } = useApiQuery<
    {
      id: string;
      fullCode?: string | null;
      nameAr?: string | null;
      menuNameAr?: string | null;
      isActive?: boolean;
    }[]
  >(
    ['new-modules', 'SI', 'einvoice-send'],
    '/new-modules',
    { baseType: 'SI' },
    { enabled: invoiceKind === 'SALE' }
  );
  const { data: settingsResponse } = useApiQuery<{ enabledSalesProfileIds?: string[] }>(
    ['electronic-invoice-settings'],
    '/electronic-invoices/settings'
  );
  const enabledSalesProfileIds = settingsResponse?.data?.enabledSalesProfileIds ?? [];
  const patternOptions = useMemo(() => {
    if (invoiceKind !== 'SALE') {
      return (profilesRes?.data ?? []).map((profile) => ({
        value: profile.id,
        label: profile.nameAr,
      }));
    }
    return buildSalesInvoicePatternOptions({
      profiles: profilesRes?.data ?? [],
      modules: modulesRes?.data ?? [],
    })
      .filter(
        (pattern) =>
          enabledSalesProfileIds.length === 0 || enabledSalesProfileIds.includes(pattern.id)
      )
      .map((pattern) => ({ value: pattern.id, label: pattern.label }));
  }, [enabledSalesProfileIds, invoiceKind, modulesRes?.data, profilesRes?.data]);
  const [showInvoices, setShowInvoices] = useState(initialView !== 'new');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [signingOpen, setSigningOpen] = useState(false);
  const [statusInvoiceId, setStatusInvoiceId] = useState<string | null>(null);

  const { data: listResponse, isLoading, refetch } = useApiQuery<EtaReadinessRow[]>(
    [
      'eta-invoice-readiness',
      invoiceKind,
      view,
      filters.fromDate,
      filters.toDate,
      filters.customerId,
      filters.delegateId,
      filters.warehouseId,
      filters.branchId,
      filters.itemId,
      filters.itemGroupId,
      filters.costCenterId,
      filters.invoiceNumber,
      filters.profileId,
      String(page),
    ],
    '/eta/documents/readiness',
    {
      invoiceKind,
      mode: amended ? 'amended' : 'new',
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      customerId: filters.customerId || undefined,
      delegateId: filters.delegateId || undefined,
      warehouseId: filters.warehouseId || undefined,
      branchId: filters.branchId || undefined,
      itemId: filters.itemId || undefined,
      itemGroupId: filters.itemGroupId || undefined,
      costCenterId: filters.costCenterId || undefined,
      invoiceNumber: filters.invoiceNumber.trim() || undefined,
      profileId: filters.profileId || undefined,
      page,
      limit: 200,
    },
    { enabled: showInvoices }
  );

  const rows = listResponse?.data ?? [];
  const summary = listResponse?.summary ?? {};
  const totalPages = listResponse?.pagination?.totalPages ?? 1;
  const totalCount = Number(listResponse?.pagination?.total ?? rows.length);
  const readyCount = Number(summary.ready ?? rows.filter((row) => row.ready).length);
  const missingCount = Number(summary.missing ?? rows.filter((row) => !row.ready).length);

  const sendableIds = useMemo(
    () =>
      rows
        .filter((row) =>
          amended
            ? row.ready && row.modifiedAfterSubmit && row.amendmentMethod && row.amendmentMethod !== 'unsupported'
            : row.ready && row.etaStatus !== 'VALID' && row.etaStatus !== 'SUBMITTED'
        )
        .map((row) => row.invoiceId),
    [amended, rows]
  );

  const selectedReady = useMemo(
    () => [...selected].filter((id) => sendableIds.includes(id)),
    [selected, sendableIds]
  );

  const onSubmitted = (message: string) => {
    setSuccess(message);
    setSelected(new Set());
    setSigningOpen(false);
    void refetch();
  };

  const toggle = (id: string, canSelect: boolean) => {
    if (!canSelect) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllReady = () => {
    setSelected((prev) => {
      const allSelected = sendableIds.length > 0 && sendableIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(sendableIds);
    });
  };

  const sendSelected = () => {
    if (selectedReady.length === 0) {
      setError('حدد فاتورة جاهزة واحدة على الأقل');
      return;
    }
    if (signingOpen) return;
    setError('');
    setSigningOpen(true);
  };

  const patchFilters = (next: Partial<typeof filters>) => {
    setPage(1);
    setSelected(new Set());
    setFilters((current) => ({ ...current, ...next }));
  };

  const load = (nextView: SendView) => {
    setPage(1);
    setSelected(new Set());
    setView(nextView);
    setShowInvoices(true);
    const qs = nextView === 'new' ? '' : `?view=${nextView}`;
    router.replace(`${pathname}${qs}`, { scroll: false });
  };

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/electronic-invoices', label: 'الفواتير الإلكترونية' },
          { label: title },
        ]}
        title={title}
        statusTone={amended ? 'warning' : 'info'}
        statusLabel={
          showInvoices
            ? view === 'debit'
              ? `${totalCount} إشعار مدين`
              : view === 'credit'
                ? `${totalCount} إشعار دائن`
                : `${totalCount} فاتورة`
            : 'جاهز للتحميل'
        }
        hideStandalonePost
        hideBrowseList
        hideActionMenu
        extraActions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" variant={view === 'new' ? 'primary' : 'secondary'} size="sm" onClick={() => load('new')}>
              تحميل الفواتير
            </Button>
            <Button type="button" variant={view === 'debit' ? 'primary' : 'secondary'} size="sm" onClick={() => load('debit')}>
              إشعار مدين
            </Button>
            <Button type="button" variant={view === 'credit' ? 'primary' : 'secondary'} size="sm" onClick={() => load('credit')}>
              إشعار دائن
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!showInvoices || sendableIds.length === 0}
              onClick={toggleAllReady}
            >
              تحديد الجاهزة
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={signingOpen || selectedReady.length === 0}
              onClick={sendSelected}
            >
              {signingOpen
                ? 'جاري التوقيع…'
                : view === 'debit'
                  ? `توقيع وإرسال إشعار مدين (${selectedReady.length})`
                  : view === 'credit'
                    ? `توقيع وإرسال إشعار دائن (${selectedReady.length})`
                    : `توقيع وإرسال لمصلحة الضرائب (${selectedReady.length})`}
            </Button>
          </div>
        }
      />

      <FormSectionCard title="تصفية التحميل" bodyClassName="gap-4">
        <p className="text-sm text-foreground-muted">
          {view === 'debit'
            ? 'فواتير أُرسلت ثم تعدّلت. الإرسال من هنا يصدر إشعار مدين بالمرجع.'
            : view === 'credit'
              ? 'مرتجعات المبيعات التي لم تُرسل بعد. الإرسال من هنا يصدر إشعار دائن.'
              : 'فواتير البيع المرحلة التي لم تُرسل بعد. الفاتورة الناقصة تظهر بالناقص فيها. علّم الجاهزة ثم أرسل. المرسل يظهر في التقرير.'}
        </p>
        <div
          className={`${reportFilterUnifiedFieldsClass} eta-send-filters grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}
        >
          <ReportFilterDateRange
            fromLabel="من التاريخ"
            toLabel="إلى التاريخ"
            fromValue={filters.fromDate}
            toValue={filters.toDate}
            onFromChange={(fromDate) => patchFilters({ fromDate })}
            onToChange={(toDate) => patchFilters({ toDate })}
          />
          <ReportFilterPartySelect
            label="العميل"
            kind="CUSTOMER"
            value={filters.customerId}
            onChange={(customerId) => patchFilters({ customerId })}
            emptyLabel="كل العملاء"
          />
          <ReportFilterDelegateSelect
            value={filters.delegateId}
            onChange={(delegateId) => patchFilters({ delegateId })}
          />
          <ReportFilterWarehouseSelect
            label="المخزن"
            value={filters.warehouseId}
            onChange={(warehouseId) => patchFilters({ warehouseId })}
          />
          <ReportFilterBranchSelect
            value={filters.branchId}
            onChange={(branchId) => patchFilters({ branchId })}
          />
          <ReportFilterItemSelect
            label="الصنف"
            value={filters.itemId}
            onChange={(itemId) => patchFilters({ itemId })}
          />
          <ReportFilterItemGroupSelect
            value={filters.itemGroupId}
            onChange={(itemGroupId) => patchFilters({ itemGroupId })}
          />
          <ReportFilterCostCenterSelect
            label="مركز التكلفة"
            value={filters.costCenterId}
            onChange={(costCenterId) => patchFilters({ costCenterId })}
          />
          <ReportFilterField label="رقم الفاتورة">
            <input
              className={reportFilterInputClass}
              value={filters.invoiceNumber}
              placeholder="كل الأرقام"
              onChange={(event) => patchFilters({ invoiceNumber: event.target.value })}
            />
          </ReportFilterField>
          <ReportFilterCombobox
            label="الأنماط"
            value={filters.profileId}
            onChange={(profileId) => patchFilters({ profileId })}
            options={patternOptions}
            placeholder="كل الأنماط"
          />
        </div>
        {showInvoices ? (
          <p className="mt-3 text-xs font-semibold text-foreground-muted">
            {view === 'debit'
              ? `${totalCount} إشعار مدين — جاهز ${readyCount}`
              : view === 'credit'
                ? `${totalCount} إشعار دائن — جاهز ${readyCount} — ناقص ${missingCount}`
                : `${totalCount} فاتورة — جاهز ${readyCount} — ناقص ${missingCount}`}
          </p>
        ) : null}
      </FormSectionCard>

      <FormSectionCard
        title={view === 'debit' ? 'إشعار مدين' : view === 'credit' ? 'إشعار دائن' : 'الفواتير'}
        className="mt-3"
        bodyClassName="gap-3"
      >
        {!showInvoices ? (
          <EmptyState title="اضغط «تحميل الفواتير» أو «إشعار مدين» أو «إشعار دائن»." />
        ) : isLoading ? (
          <TableSkeleton columns={amended ? 14 : 13} rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              view === 'debit'
                ? 'لا توجد فواتير أُرسلت ثم تعدّلت.'
                : view === 'credit'
                  ? 'لا توجد مرتجعات غير مرسلة في هذه الفترة.'
                  : 'لا توجد فواتير غير مرسلة في هذه الفترة.'
            }
          />
        ) : (
          <div className={denseTableWrapClass}>
            <table className={denseTableClass}>
              <thead className={denseTheadClass}>
                <tr>
                  <th className={denseThClass}>تحديد</th>
                  <th className={denseThClass}>رقم الفاتورة</th>
                  <th className={denseThClass}>التاريخ</th>
                  <th className={denseThClass}>العميل</th>
                  <th className={denseThClass}>المندوب</th>
                  <th className={denseThClass}>الفرع</th>
                  <th className={denseThClass}>النمط</th>
                  <th className={denseThClass}>العملة</th>
                  <th className={denseThClass}>القيمة بدون ضريبة</th>
                  <th className={denseThClass}>قيمة الضريبة</th>
                  <th className={denseThClass}>إجمالي القيمة</th>
                  {amended ? <th className={denseThClass}>طريقة الإرسال</th> : null}
                  <th className={denseThClass}>الحالة</th>
                  <th className={denseThClass}>البيانات الناقصة</th>
                  <th className={denseThClass}>حالة الفاتورة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const alreadySent = row.etaStatus === 'VALID' || row.etaStatus === 'SUBMITTED';
                  const canSelect = amended
                    ? Boolean(row.ready && row.amendmentMethod && row.amendmentMethod !== 'unsupported')
                    : row.ready && !alreadySent;
                  return (
                    <tr
                      key={row.invoiceId}
                      className={`${denseTrClass} ${row.ready ? 'bg-emerald-50/40' : 'bg-rose-50/40'}`}
                    >
                      <td className={`${denseTdClass} text-center`}>
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-[var(--primary)]"
                          checked={selected.has(row.invoiceId)}
                          disabled={!canSelect}
                          onChange={() => toggle(row.invoiceId, canSelect)}
                        />
                      </td>
                      <td className={`${denseTdClass} font-semibold`}>{row.invoiceNumber}</td>
                      <td className={denseTdClass}>{formatDate(row.date)}</td>
                      <td className={denseTdClass}>{row.customerName || '—'}</td>
                      <td className={denseTdClass}>{row.delegateName || '—'}</td>
                      <td className={denseTdClass}>{row.branchName || '—'}</td>
                      <td className={denseTdClass}>{row.profileName || '—'}</td>
                      <td className={denseTdClass}>{row.currencyCode || '—'}</td>
                      <td className={`${denseTdClass} tabular-nums`}>{formatMoneyAr(row.amountBeforeTax)}</td>
                      <td className={`${denseTdClass} tabular-nums`}>{formatMoneyAr(row.taxAmount)}</td>
                      <td className={`${denseTdClass} tabular-nums`}>
                        {formatMoneyAr(row.netAmount)}
                        {amended && row.submittedNet != null ? ` ← كان ${formatMoneyAr(row.submittedNet)}` : ''}
                      </td>
                      {amended ? (
                        <td className={denseTdClass}>{AMEND_AR[row.amendmentMethod || ''] || '—'}</td>
                      ) : null}
                      <td className={denseTdClass}>
                        {amended
                          ? 'مُرسل ثم تعدّل'
                          : `${row.ready ? 'جاهزة' : 'ناقصة'} — ${STATUS_AR[row.etaStatus] || row.etaStatus}`}
                      </td>
                      <td className={`${denseTdClass} text-danger`}>
                        {row.missing.length > 0 ? row.missing.join('، ') : '—'}
                      </td>
                      <td className={denseTdClass}>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setStatusInvoiceId(row.invoiceId)}
                        >
                          حالة الفاتورة الإلكترونية
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showInvoices && totalPages > 1 ? (
          <div className="mt-3 flex justify-center gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              السابق
            </Button>
            <span className="self-center text-xs text-foreground-muted">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              التالي
            </Button>
          </div>
        ) : null}
      </FormSectionCard>

      {signingOpen ? (
        <EtaSignAndSendDialog
          invoiceIds={selectedReady}
          amended={amended}
          onClose={() => setSigningOpen(false)}
          onFinished={onSubmitted}
        />
      ) : null}
      {statusInvoiceId ? (
        <EtaInvoiceStatusDialog invoiceId={statusInvoiceId} onClose={() => setStatusInvoiceId(null)} />
      ) : null}
    </ErpDocumentLayout>
  );
}
