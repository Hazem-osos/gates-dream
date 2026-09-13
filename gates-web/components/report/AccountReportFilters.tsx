'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';
import {
  ReportFilterAccountSelect,
  ReportFilterBranchSelect,
  ReportFilterCheckbox,
  ReportFilterCostCenterSelect,
  ReportFilterCurrencySelect,
  ReportFilterDate,
  ReportFilterField,
  ReportFilterOptionsRow,
  ReportFilterPartySelect,
  reportFilterInputClass,
} from '@/components/report/reportFilterFields';

export type AccountReportFilterValues = {
  fromDate: string;
  toDate: string;
  accountId: string;
  costCenterId: string;
  currencyId: string;
  branchId: string;
  level: string;
  fromVoucher: string;
  toVoucher: string;
  includeDetails: boolean;
  customerId: string;
  supplierId: string;
};

export type AccountReportFieldFlag =
  | boolean
  | {
      required?: boolean;
      placeholder?: string;
      tourId?: string;
    };

export type AccountReportFilterFields = {
  dates?: 'range' | 'to' | 'none';
  datesTourId?: string;
  account?: AccountReportFieldFlag;
  costCenter?: AccountReportFieldFlag;
  currency?: boolean;
  branch?: boolean;
  level?: boolean;
  voucherRange?: boolean;
  includeDetails?: boolean;
  customer?: boolean;
  supplier?: boolean;
};

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function emptyAccountReportFilters(): AccountReportFilterValues {
  const today = todayIso();
  return {
    fromDate: today,
    toDate: today,
    accountId: '',
    costCenterId: '',
    currencyId: '',
    branchId: '',
    level: '',
    fromVoucher: '',
    toVoucher: '',
    includeDetails: true,
    customerId: '',
    supplierId: '',
  };
}

function flagOn(flag?: AccountReportFieldFlag): boolean {
  return Boolean(flag);
}

function flagMeta(flag?: AccountReportFieldFlag) {
  return typeof flag === 'object' && flag ? flag : {};
}

export function validateAccountReportFilters(
  values: AccountReportFilterValues,
  fields: AccountReportFilterFields
): string | null {
  if (fields.dates === 'range' && (!values.fromDate || !values.toDate)) {
    return 'يرجى اختيار تاريخ البداية والنهاية';
  }
  if (fields.dates === 'to' && !values.toDate) {
    return 'يرجى اختيار التاريخ';
  }
  if (flagMeta(fields.account).required && !values.accountId) {
    return 'يرجى اختيار الحساب';
  }
  if (flagMeta(fields.costCenter).required && !values.costCenterId) {
    return 'يرجى اختيار مركز التكلفة';
  }
  return null;
}

export function buildAccountReportQuery(
  values: AccountReportFilterValues,
  fields: AccountReportFilterFields
): URLSearchParams {
  const params = new URLSearchParams();
  if (fields.dates === 'range') {
    if (values.fromDate) params.set('fromDate', values.fromDate);
    if (values.toDate) params.set('toDate', values.toDate);
  } else if (fields.dates === 'to') {
    if (values.toDate) params.set('toDate', values.toDate);
  }
  if (flagOn(fields.account) && values.accountId) params.set('accountId', values.accountId);
  if (flagOn(fields.costCenter) && values.costCenterId) {
    params.set('costCenterId', values.costCenterId);
  }
  if (fields.currency && values.currencyId) params.set('currencyId', values.currencyId);
  if (fields.branch !== false && values.branchId) params.set('branchId', values.branchId);
  if (fields.level && values.level) params.set('level', values.level);
  if (fields.voucherRange && values.fromVoucher) params.set('fromVoucher', values.fromVoucher);
  if (fields.voucherRange && values.toVoucher) params.set('toVoucher', values.toVoucher);
  if (fields.includeDetails) params.set('includeDetails', String(values.includeDetails));
  if (fields.customer && values.customerId) params.set('customerId', values.customerId);
  if (fields.supplier && values.supplierId) params.set('supplierId', values.supplierId);
  return params;
}

function wrapTour(tourId: string | undefined, key: string, node: ReactNode) {
  if (!tourId) return node;
  return (
    <div key={key} data-tour-id={tourId}>
      {node}
    </div>
  );
}

export function renderAccountReportFields(
  values: AccountReportFilterValues,
  patch: (p: Partial<AccountReportFilterValues>) => void,
  fields: AccountReportFilterFields
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const accountMeta = flagMeta(fields.account);
  const costCenterMeta = flagMeta(fields.costCenter);

  if (fields.dates === 'range') {
    const dates = (
      <div key="dates" className="contents" data-tour-id={fields.datesTourId}>
        <ReportFilterDate
          label="من تاريخ"
          value={values.fromDate}
          onChange={(fromDate) => patch({ fromDate })}
        />
        <ReportFilterDate
          label="إلى تاريخ"
          value={values.toDate}
          onChange={(toDate) => patch({ toDate })}
        />
      </div>
    );
    nodes.push(dates);
  } else if (fields.dates === 'to') {
    nodes.push(
      wrapTour(
        fields.datesTourId,
        'to-date',
        <ReportFilterDate
          key="to-date"
          label="إلى تاريخ"
          value={values.toDate}
          onChange={(toDate) => patch({ toDate })}
        />
      )
    );
  }

  if (flagOn(fields.account)) {
    nodes.push(
      wrapTour(
        accountMeta.tourId,
        'account',
        <ReportFilterAccountSelect
          key="account"
          label="الحساب"
          value={values.accountId}
          onChange={(accountId) => patch({ accountId })}
          emptyLabel={accountMeta.placeholder ?? 'كل الحسابات'}
          placeholder={accountMeta.placeholder ?? 'ابحث عن حساب…'}
        />
      )
    );
  }

  if (flagOn(fields.costCenter)) {
    nodes.push(
      <ReportFilterCostCenterSelect
        key="cost-center"
        label="مركز التكلفة"
        value={values.costCenterId}
        onChange={(costCenterId) => patch({ costCenterId })}
        emptyLabel={costCenterMeta.placeholder ?? 'كل مراكز التكلفة'}
      />
    );
  }

  if (fields.customer) {
    nodes.push(
      <ReportFilterPartySelect
        key="customer"
        label="العميل"
        kind="CUSTOMER"
        value={values.customerId}
        onChange={(customerId) => patch({ customerId })}
        emptyLabel="كل العملاء"
      />
    );
  }

  if (fields.supplier) {
    nodes.push(
      <ReportFilterPartySelect
        key="supplier"
        label="المورد"
        kind="SUPPLIER"
        value={values.supplierId}
        onChange={(supplierId) => patch({ supplierId })}
        emptyLabel="كل الموردين"
      />
    );
  }

  if (fields.currency) {
    nodes.push(
      <ReportFilterCurrencySelect
        key="currency"
        value={values.currencyId}
        onChange={(currencyId) => patch({ currencyId })}
      />
    );
  }

  if (fields.branch !== false) {
    nodes.push(
      <ReportFilterBranchSelect
        key="branch"
        value={values.branchId}
        onChange={(branchId) => patch({ branchId })}
      />
    );
  }

  if (fields.level) {
    nodes.push(
      <ReportFilterField key="level" label="المستوى">
        <input
          type="number"
          min={1}
          className={reportFilterInputClass}
          placeholder="كل المستويات"
          value={values.level}
          onChange={(e) => patch({ level: e.target.value })}
        />
      </ReportFilterField>
    );
  }

  if (fields.voucherRange) {
    nodes.push(
      <ReportFilterField key="from-voucher" label="من قيد">
        <input
          type="number"
          min={1}
          className={reportFilterInputClass}
          value={values.fromVoucher}
          onChange={(e) => patch({ fromVoucher: e.target.value })}
        />
      </ReportFilterField>,
      <ReportFilterField key="to-voucher" label="إلى قيد">
        <input
          type="number"
          min={1}
          className={reportFilterInputClass}
          value={values.toVoucher}
          onChange={(e) => patch({ toVoucher: e.target.value })}
        />
      </ReportFilterField>
    );
  }

  if (fields.includeDetails) {
    nodes.push(
      <ReportFilterOptionsRow key="details">
        <ReportFilterCheckbox
          id="includeDetails"
          label="عرض التفاصيل"
          checked={values.includeDetails}
          onChange={(includeDetails) => patch({ includeDetails })}
        />
      </ReportFilterOptionsRow>
    );
  }

  return nodes;
}

export function AccountReportFilterPage({
  urlPath,
  previewPath,
  icon,
  subtitle,
  fields,
}: {
  urlPath: string;
  previewPath?: string;
  icon?: string;
  subtitle?: string;
  fields: AccountReportFilterFields;
}) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(emptyAccountReportFilters);

  const patch = (p: Partial<AccountReportFilterValues>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const handlePreview = () => {
    const message = validateAccountReportFilters(filters, fields);
    if (message) {
      setError(message);
      return;
    }
    const qs = buildAccountReportQuery(filters, fields).toString();
    const target = previewPath ?? `${urlPath}/preview`;
    router.push(qs ? `${target}?${qs}` : target);
  };

  return (
    <CatalogReportFilterShell
      urlPath={urlPath}
      icon={icon}
      subtitle={subtitle}
      onPreview={handlePreview}
      onReset={() => {
        setFilters(emptyAccountReportFilters());
        setError('');
      }}
      error={error}
      onClearError={() => setError('')}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
    >
      {renderAccountReportFields(filters, patch, fields)}
    </CatalogReportFilterShell>
  );
}
