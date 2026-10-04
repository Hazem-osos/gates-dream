'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';
import { UniversalReportViewer } from '@/components/report/UniversalReportViewer';
import { AccountsBalanceSheet } from '@/components/report/AccountsBalanceSheet';
import { BalanceSheetStatement } from '@/components/report/BalanceSheetStatement';
import { TradingAccountSheet } from '@/components/report/TradingAccountSheet';
import { AccountBalancesSheet } from '@/components/report/AccountBalancesSheet';
import { getReportByUrlPath } from '@/lib/reports/reportCatalog';
import { writeReportSearch } from '@/lib/reports/reportQueryUrl';
import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';
import { recalledTabSearch } from '@/lib/navigation/tab-memory';
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
  ReportFilterFiscalYearSelect,
  ReportFilterUserSelect,
  ReportFilterPartyGroupSelect,
  ReportFilterEntitySelect,
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
  customerCategoryId: string;
  supplierCategoryId: string;
  entityId: string;
  entityName: string;
  description: string;
  counterpartAccountId: string;
  accountView: string;
  amountOp: string;
  amount: string;
  amountTo: string;
  userId: string;
  compareFiscalYearId: string;
  allAccounts: boolean;
  showUnposted: boolean;
  showIdleAccounts: boolean;
  withBudgetOnly: boolean;
};

export type AccountReportOptionId =
  | 'allAccounts'
  | 'includeDetails'
  | 'showUnposted'
  | 'showIdleAccounts'
  | 'withBudgetOnly';

const ACCOUNT_REPORT_OPTION_META: Record<AccountReportOptionId, { label: string }> = {
  allAccounts: { label: 'كل الحسابات' },
  includeDetails: { label: 'عرض التفاصيل' },
  showUnposted: { label: 'قراءة القيود غير المرحلة' },
  showIdleAccounts: { label: 'إظهار الحسابات بدون حركة' },
  withBudgetOnly: { label: 'إظهار ما له موازنة فقط' },
};

export type AccountReportFieldFlag =
  | boolean
  | {
      required?: boolean;
      placeholder?: string;
      tourId?: string;
      label?: string;
    };

export type AccountReportFilterFields = {
  dates?: 'range' | 'to' | 'none';
  datesTourId?: string;
  account?: AccountReportFieldFlag;
  costCenter?: AccountReportFieldFlag;
  currency?: boolean;
  branch?: boolean;
  level?: AccountReportFieldFlag;
  description?: boolean;
  counterpartAccount?: boolean;
  voucherRange?: boolean;
  accountView?: boolean;
  amountCompare?: boolean;
  includeDetails?: boolean;
  customer?: boolean;
  supplier?: boolean;
  entity?: boolean;
  compareYear?: boolean;
  /** Extra checkboxes. كل الحسابات تُضاف وحدها لو التقرير فيه اختيار حساب. */
  reportOptions?: AccountReportOptionId[];
};

export function resolveAccountReportOptions(fields: AccountReportFilterFields): AccountReportOptionId[] {
  const ids: AccountReportOptionId[] = ['showUnposted'];
  if (flagOn(fields.account) || fields.counterpartAccount) ids.push('allAccounts');
  if (fields.includeDetails) ids.push('includeDetails');
  for (const id of fields.reportOptions ?? []) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function emptyAccountReportFilters(urlPath?: string): AccountReportFilterValues {
  const range = reportDefaultDateRange(urlPath);
  return {
    fromDate: range.fromDate,
    toDate: range.toDate,
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
    customerCategoryId: '',
    supplierCategoryId: '',
    entityId: '',
    entityName: '',
    description: '',
    counterpartAccountId: '',
    accountView: 'both',
    amountOp: '',
    amount: '',
    amountTo: '',
    userId: '',
    compareFiscalYearId: '',
    allAccounts: true,
    showUnposted: false,
    showIdleAccounts: false,
    withBudgetOnly: false,
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
  if (fields.amountCompare && values.amountOp) {
    if (!values.amount.trim()) return 'يرجى إدخال المبلغ';
    if (values.amountOp === 'between' && !values.amountTo.trim()) return 'يرجى إدخال المبلغ الثاني';
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
  if (values.userId) params.set('userId', values.userId);
  if (fields.compareYear && values.compareFiscalYearId) {
    params.set('compareFiscalYearId', values.compareFiscalYearId);
  }
  if (flagOn(fields.level) && values.level) params.set('level', values.level);
  if (fields.description && values.description.trim()) {
    params.set('description', values.description.trim());
  }
  if (fields.counterpartAccount && values.counterpartAccountId) {
    params.set('counterpartAccountId', values.counterpartAccountId);
  }
  if (fields.voucherRange && values.fromVoucher) params.set('fromVoucher', values.fromVoucher);
  if (fields.voucherRange && values.toVoucher) params.set('toVoucher', values.toVoucher);
  if (fields.accountView && values.accountView) params.set('accountView', values.accountView);
  if (fields.amountCompare && values.amountOp && values.amount.trim()) {
    params.set('amountOp', values.amountOp);
    params.set('amount', values.amount.trim());
    if (values.amountOp === 'between' && values.amountTo.trim()) {
      params.set('amountTo', values.amountTo.trim());
    }
  }
  const optionIds = resolveAccountReportOptions(fields);
  if (optionIds.includes('includeDetails')) params.set('includeDetails', String(values.includeDetails));
  if (optionIds.includes('showUnposted') && values.showUnposted) params.set('showUnposted', 'true');
  if (optionIds.includes('showIdleAccounts') && values.showIdleAccounts) {
    params.set('showIdleAccounts', 'true');
  }
  if (optionIds.includes('withBudgetOnly') && values.withBudgetOnly) {
    params.set('withBudgetOnly', 'true');
  }
  if (fields.customer && values.customerId) params.set('customerId', values.customerId);
  if (fields.supplier && values.supplierId) params.set('supplierId', values.supplierId);
  if (fields.customer && values.customerCategoryId) {
    params.set('customerCategoryId', values.customerCategoryId);
  }
  if (fields.supplier && values.supplierCategoryId) {
    params.set('supplierCategoryId', values.supplierCategoryId);
  }
  if (fields.entity && values.entityId) params.set('entityId', values.entityId);
  if (optionIds.includes('allAccounts') && values.allAccounts) params.set('allAccounts', 'true');
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

  const accountField = flagOn(fields.account) ? (
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
        leafOnly={!values.allAccounts}
      />
    )
  ) : null;

  const costCenterField = flagOn(fields.costCenter) ? (
    <ReportFilterCostCenterSelect
      key="cost-center"
      label={costCenterMeta.required ? 'مركز التكلفة *' : 'مركز التكلفة'}
      value={values.costCenterId}
      onChange={(costCenterId) => patch({ costCenterId })}
      emptyLabel={costCenterMeta.placeholder ?? (costCenterMeta.required ? 'اختر مركز التكلفة' : 'كل مراكز التكلفة')}
      allowEmpty={!costCenterMeta.required}
    />
  ) : null;

  if (costCenterMeta.required) {
    if (costCenterField) nodes.push(costCenterField);
    if (accountField) nodes.push(accountField);
  } else {
    if (accountField) nodes.push(accountField);
    if (costCenterField) nodes.push(costCenterField);
  }

  const optionIds = resolveAccountReportOptions(fields);
  if (optionIds.length) {
    nodes.push(
      <ReportFilterOptionsRow key="report-options">
        <AccountReportOptionsControl values={values} patch={patch} optionIds={optionIds} />
      </ReportFilterOptionsRow>
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
      />,
      <ReportFilterPartyGroupSelect
        key="customer-group"
        kind="CUSTOMER"
        value={values.customerCategoryId}
        onChange={(customerCategoryId) => patch({ customerCategoryId })}
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
      />,
      <ReportFilterPartyGroupSelect
        key="supplier-group"
        kind="SUPPLIER"
        value={values.supplierCategoryId}
        onChange={(supplierCategoryId) => patch({ supplierCategoryId })}
      />
    );
  }

  if (fields.entity) {
    nodes.push(
      <ReportFilterEntitySelect
        key="entity"
        value={values.entityId}
        valueLabel={values.entityName}
        onChange={(entityId, entityName) => patch({ entityId, entityName: entityName || '' })}
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

  if (fields.compareYear) {
    nodes.push(
      <ReportFilterFiscalYearSelect
        key="compare-year"
        value={values.compareFiscalYearId}
        onChange={(compareFiscalYearId) => patch({ compareFiscalYearId })}
      />
    );
  }
  nodes.push(
    <ReportFilterUserSelect
      key="user"
      value={values.userId}
      onChange={(userId) => patch({ userId })}
    />
  );
  if (fields.branch !== false) {
    nodes.push(
      <ReportFilterBranchSelect
        key="branch"
        value={values.branchId}
        onChange={(branchId) => patch({ branchId })}
      />
    );
  }

  if (flagOn(fields.level)) {
    const levelMeta = flagMeta(fields.level);
    nodes.push(
      <ReportFilterField key="level" label={levelMeta.label ?? 'المستوى'}>
        <input
          type="number"
          min={1}
          className={reportFilterInputClass}
          placeholder={levelMeta.placeholder ?? 'كل المستويات'}
          value={values.level}
          onChange={(e) => patch({ level: e.target.value })}
        />
      </ReportFilterField>
    );
  }

  if (fields.description) {
    nodes.push(
      <ReportFilterField key="description" label="الشرح">
        <input
          className={reportFilterInputClass}
          placeholder="بحث في الشرح"
          value={values.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </ReportFilterField>
    );
  }

  if (fields.counterpartAccount) {
    nodes.push(
      <ReportFilterAccountSelect
        key="counterpart-account"
        label="الحساب المقابل"
        value={values.counterpartAccountId}
        onChange={(counterpartAccountId) => patch({ counterpartAccountId })}
        emptyLabel="كل الحسابات المقابلة"
        placeholder="ابحث عن الحساب المقابل…"
        leafOnly={!values.allAccounts}
      />
    );
  }

  if (fields.accountView) {
    nodes.push(
      <ReportFilterField key="account-view" label="إظهار الحسابات">
        <select
          className={reportFilterInputClass}
          value={values.accountView}
          onChange={(e) => patch({ accountView: e.target.value })}
        >
          <option value="both">الرئيسية والأستاذ</option>
          <option value="main">الحسابات الرئيسية فقط</option>
          <option value="ledger">حسابات الأستاذ فقط</option>
        </select>
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

  if (fields.amountCompare) {
    nodes.push(
      <ReportFilterField key="amount-op" label="مبلغ القيد">
        <select
          className={reportFilterInputClass}
          value={values.amountOp}
          onChange={(e) => patch({ amountOp: e.target.value })}
        >
          <option value="">كل المبالغ</option>
          <option value="eq">يساوي</option>
          <option value="gt">أكبر من</option>
          <option value="gte">أكبر من أو يساوي</option>
          <option value="lt">أصغر من</option>
          <option value="lte">أصغر من أو يساوي</option>
          <option value="between">من إلى</option>
        </select>
      </ReportFilterField>,
      <ReportFilterField key="amount" label={values.amountOp === 'between' ? 'من مبلغ' : 'المبلغ'}>
        <input
          type="number"
          min={0}
          step="0.01"
          className={reportFilterInputClass}
          value={values.amount}
          onChange={(e) => patch({ amount: e.target.value })}
          disabled={!values.amountOp}
        />
      </ReportFilterField>
    );
    if (values.amountOp === 'between') {
      nodes.push(
        <ReportFilterField key="amount-to" label="إلى مبلغ">
          <input
            type="number"
            min={0}
            step="0.01"
            className={reportFilterInputClass}
            value={values.amountTo}
            onChange={(e) => patch({ amountTo: e.target.value })}
          />
        </ReportFilterField>
      );
    }
  }

  return nodes;
}

function AccountReportOptionsControl({
  values,
  patch,
  optionIds,
}: {
  values: AccountReportFilterValues;
  patch: (next: Partial<AccountReportFilterValues>) => void;
  optionIds: AccountReportOptionId[];
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`report-filter-option inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition ${
          open
            ? 'border-[#B7D7E8] bg-[#F4FAFC] text-[#094C6B] dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100'
            : 'border-[#D6EAF3] bg-white text-slate-600 hover:bg-[#F6FBFD] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        خيارات التقرير
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-30 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">خيارات التقرير</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {optionIds.map((id) => (
              <ReportFilterCheckbox
                key={id}
                id={id}
                label={ACCOUNT_REPORT_OPTION_META[id].label}
                checked={Boolean(values[id])}
                onChange={(on) => patch({ [id]: on })}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type FiscalYearRow = {
  startDate?: string;
  status?: string | null;
  isActive?: boolean;
};

/** 1 Jan through 23 Dec of the open fiscal year (latest defined year if none is open). */
export function ledgerDefaultDateRange(
  rows: FiscalYearRow[]
): { fromDate: string; toDate: string } | null {
  const dated = rows.filter((row) => /^\d{4}/.test(String(row.startDate ?? '')));
  const open = dated.filter((row) => {
    const status = String(row.status ?? '').toLowerCase();
    return status === 'open' || row.isActive === true;
  });
  const pool = (open.length ? open : dated).slice().sort((a, b) =>
    String(b.startDate).localeCompare(String(a.startDate))
  );
  const year = String(pool[0]?.startDate ?? '').slice(0, 4);
  if (!/^\d{4}$/.test(year)) return null;
  return { fromDate: `${year}-01-01`, toDate: `${year}-12-23` };
}

export function AccountReportFilterPage({
  urlPath,
  icon,
  subtitle,
  fields,
}: {
  urlPath: string;
  previewPath?: string;
  icon?: string;
  subtitle?: string;
  fields: AccountReportFilterFields;
  /** دفتر الأستاذ: 1/1 → 23/12 of the open (or last defined) fiscal year. */
  defaultDatesFromOpenFiscalYear?: boolean;
  /** ميزان المراجعة الشهري: 1/1 → 31/12 of the current year. */
  defaultFullCalendarYear?: boolean;
}) {
  const entry = getReportByUrlPath(urlPath);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => emptyAccountReportFilters(urlPath));
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const live = window.location.search.replace(/^\?/, '');
    const remembered = recalledTabSearch(urlPath);
    const params = new URLSearchParams(live || remembered);
    if (!params.toString()) return;
    const entries = Object.fromEntries(params);
    setFilters((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as Array<keyof AccountReportFilterValues>) {
        const value = entries[key];
        if (value == null || value === '') continue;
        if (typeof next[key] === 'boolean') {
          (next[key] as boolean) = value === 'true';
        } else {
          (next as Record<string, string | boolean>)[key] = value;
        }
      }
      return next;
    });
    setPreviewQuery(entries);
  }, []);

  const patch = (p: Partial<AccountReportFilterValues>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const handlePreview = () => {
    const message = validateAccountReportFilters(filters, fields);
    if (message) {
      setError(message);
      return;
    }
    const params = Object.fromEntries(buildAccountReportQuery(filters, fields));
    setPreviewQuery(params);
    writeReportSearch(params);
    setError('');
  };

  useEffect(() => {
    if (!previewQuery) return;
    document.getElementById('report-inline-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [previewQuery]);

  return (
    <CatalogReportFilterShell
      urlPath={urlPath}
      icon={icon}
      subtitle={subtitle}
      onPreview={handlePreview}
      onReset={() => {
        setFilters(emptyAccountReportFilters(urlPath));
        setError('');
        setPreviewQuery(null);
        writeReportSearch(null);
      }}
      error={error}
      onClearError={() => setError('')}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
      below={
        entry && previewQuery && entry.reportKey === 'financial-position-statement' ? (
          <div id="report-inline-results">
            <BalanceSheetStatement query={previewQuery} />
          </div>
        ) : entry && previewQuery && entry.reportKey === 'accounts-balance' ? (
          <div id="report-inline-results">
            <AccountsBalanceSheet query={previewQuery} />
          </div>
        ) : entry && previewQuery && entry.reportKey === 'account-balances' ? (
          <div id="report-inline-results">
            <AccountBalancesSheet query={previewQuery} />
          </div>
        ) : entry && previewQuery && entry.reportKey === 'trading-account' ? (
          <div id="report-inline-results">
            <TradingAccountSheet query={previewQuery} />
          </div>
        ) : entry && previewQuery ? (
          <div id="report-inline-results">
            <UniversalReportViewer
              embedded
              queryOverride={previewQuery}
              registryPath={entry.registryPath}
              reportKey={entry.reportKey}
              title={entry.titleAr}
              exportFileName={entry.reportKey}
            />
          </div>
        ) : null
      }
    >
      {renderAccountReportFields(filters, patch, fields)}
    </CatalogReportFilterShell>
  );
}
