'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';
import {
  ReportFilterBranchSelect,
  ReportFilterCheckbox,
  ReportFilterCombobox,
  ReportFilterCostCenterSelect,
  ReportFilterCurrencySelect,
  ReportFilterDate,
  ReportFilterDelegateSelect,
  ReportFilterField,
  ReportFilterItemGroupSelect,
  ReportFilterItemSelect,
  ReportFilterOptionsRow,
  ReportFilterPartySelect,
  ReportFilterPartyGroupSelect,
  ReportFilterSelect,
  ReportFilterWarehouseSelect,
  reportFilterInputClass,
} from '@/components/report/reportFilterFields';
import { useDocumentProfiles } from '@/lib/hooks/useDocumentProfiles';
import type { DocumentBaseType } from '@/lib/document-profiles/types';

export type InventoryReportFilterValues = {
  fromDate: string;
  toDate: string;
  warehouseId: string;
  itemId: string;
  itemGroupId: string;
  customerId: string;
  supplierId: string;
  customerCategoryId: string;
  supplierCategoryId: string;
  delegateId: string;
  sellerId: string;
  costCenterId: string;
  currencyId: string;
  branchId: string;
  fromInvoice: string;
  toInvoice: string;
  serial: string;
  unpaidOnly: boolean;
  allAccounts: boolean;
  totalReport: boolean;
  showUnposted: boolean;
  sortBy: string;
  minValue: string;
  profileId: string;
};

export type InventoryReportFilterFields = {
  dates?: 'range' | 'to' | 'none';
  warehouse?: boolean;
  item?: boolean;
  itemGroup?: boolean;
  customer?: boolean;
  supplier?: boolean;
  delegate?: boolean;
  seller?: boolean;
  costCenter?: boolean;
  currency?: boolean;
  branch?: boolean;
  invoiceRange?: boolean;
  serial?: boolean;
  unpaidOnly?: boolean;
  allAccounts?: boolean;
  totalReport?: boolean;
  showUnposted?: boolean;
  sortBy?: boolean;
  minValue?: boolean;
  profileBaseType?: DocumentBaseType;
};

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function emptyInventoryReportFilters(): InventoryReportFilterValues {
  const today = todayIso();
  return {
    fromDate: today,
    toDate: today,
    warehouseId: '',
    itemId: '',
    itemGroupId: '',
    customerId: '',
    supplierId: '',
    customerCategoryId: '',
    supplierCategoryId: '',
    delegateId: '',
    sellerId: '',
    costCenterId: '',
    currencyId: '',
    branchId: '',
    fromInvoice: '',
    toInvoice: '',
    serial: '',
    unpaidOnly: false,
    allAccounts: true,
    totalReport: true,
    showUnposted: true,
    sortBy: 'invoice-number',
    minValue: '',
    profileId: '',
  };
}

export function validateInventoryReportFilters(
  values: InventoryReportFilterValues,
  fields: InventoryReportFilterFields
): string | null {
  if (fields.dates === 'range' && (!values.fromDate || !values.toDate)) {
    return 'يرجى اختيار تاريخ البداية والنهاية';
  }
  if (fields.dates === 'to' && !values.toDate) {
    return 'يرجى اختيار التاريخ';
  }
  return null;
}

export function buildInventoryReportQuery(
  values: InventoryReportFilterValues,
  fields: InventoryReportFilterFields
): URLSearchParams {
  const params = new URLSearchParams();
  if (fields.dates === 'range') {
    if (values.fromDate) params.set('fromDate', values.fromDate);
    if (values.toDate) params.set('toDate', values.toDate);
  } else if (fields.dates === 'to') {
    if (values.toDate) params.set('toDate', values.toDate);
  }
  if (fields.warehouse && values.warehouseId) params.set('warehouseId', values.warehouseId);
  if (fields.item && values.itemId) params.set('itemId', values.itemId);
  if (fields.itemGroup && values.itemGroupId) params.set('itemGroupId', values.itemGroupId);
  if (fields.customer && values.customerId) params.set('customerId', values.customerId);
  if (fields.supplier && values.supplierId) params.set('supplierId', values.supplierId);
  if (fields.customer && values.customerCategoryId) {
    params.set('customerCategoryId', values.customerCategoryId);
  }
  if (fields.supplier && values.supplierCategoryId) {
    params.set('supplierCategoryId', values.supplierCategoryId);
  }
  if (fields.delegate && values.delegateId) params.set('delegateId', values.delegateId);
  if (fields.seller && values.sellerId) params.set('sellerId', values.sellerId);
  if (fields.costCenter && values.costCenterId) params.set('costCenterId', values.costCenterId);
  if (fields.currency && values.currencyId) params.set('currencyId', values.currencyId);
  if (fields.branch && values.branchId) params.set('branchId', values.branchId);
  if (fields.invoiceRange && values.fromInvoice) params.set('fromInvoice', values.fromInvoice);
  if (fields.invoiceRange && values.toInvoice) params.set('toInvoice', values.toInvoice);
  if (fields.serial && values.serial) params.set('serial', values.serial);
  if (fields.unpaidOnly && values.unpaidOnly) params.set('unpaidOnly', 'true');
  if (fields.allAccounts && values.allAccounts) params.set('allAccounts', 'true');
  if (fields.totalReport && values.totalReport) params.set('totalReport', 'true');
  if (fields.showUnposted && values.showUnposted) params.set('showUnposted', 'true');
  if (fields.sortBy && values.sortBy) params.set('sortBy', values.sortBy);
  if (fields.minValue && values.minValue) params.set('minValue', values.minValue);
  if (fields.profileBaseType && values.profileId) params.set('profileId', values.profileId);
  return params;
}

function ProfileSelect({
  baseType,
  value,
  onChange,
}: {
  baseType: DocumentBaseType;
  value: string;
  onChange: (id: string) => void;
}) {
  const { data } = useDocumentProfiles({ baseType });
  const options = useMemo(
    () => (data?.data ?? []).map((p) => ({ value: p.id, label: p.nameAr })),
    [data?.data]
  );
  return (
    <ReportFilterCombobox
      label="نمط الفاتورة"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="كل الأنماط"
    />
  );
}

export function renderInventoryReportFields(
  values: InventoryReportFilterValues,
  patch: (p: Partial<InventoryReportFilterValues>) => void,
  fields: InventoryReportFilterFields
): ReactNode[] {
  const nodes: ReactNode[] = [];

  if (fields.dates === 'range') {
    nodes.push(
      <ReportFilterDate
        key="from"
        label="من تاريخ"
        value={values.fromDate}
        onChange={(fromDate) => patch({ fromDate })}
      />,
      <ReportFilterDate
        key="to"
        label="إلى تاريخ"
        value={values.toDate}
        onChange={(toDate) => patch({ toDate })}
      />
    );
  } else if (fields.dates === 'to') {
    nodes.push(
      <ReportFilterDate
        key="to"
        label="إلى تاريخ"
        value={values.toDate}
        onChange={(toDate) => patch({ toDate })}
      />
    );
  }

  if (fields.profileBaseType) {
    nodes.push(
      <ProfileSelect
        key="profile"
        baseType={fields.profileBaseType}
        value={values.profileId}
        onChange={(profileId) => patch({ profileId })}
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
  if (fields.delegate) {
    nodes.push(
      <ReportFilterDelegateSelect
        key="delegate"
        value={values.delegateId}
        onChange={(delegateId) => patch({ delegateId })}
      />
    );
  }
  if (fields.seller) {
    nodes.push(
      <ReportFilterDelegateSelect
        key="seller"
        label="البائع"
        value={values.sellerId}
        onChange={(sellerId) => patch({ sellerId })}
        emptyLabel="كل البائعين"
      />
    );
  }
  if (fields.warehouse) {
    nodes.push(
      <ReportFilterWarehouseSelect
        key="warehouse"
        label="المخزن"
        value={values.warehouseId}
        onChange={(warehouseId) => patch({ warehouseId })}
      />
    );
  }
  if (fields.itemGroup) {
    nodes.push(
      <ReportFilterItemGroupSelect
        key="group"
        value={values.itemGroupId}
        onChange={(itemGroupId) => patch({ itemGroupId })}
      />
    );
  }
  if (fields.item) {
    nodes.push(
      <ReportFilterItemSelect
        key="item"
        label="الصنف"
        value={values.itemId}
        onChange={(itemId) => patch({ itemId })}
      />
    );
  }
  if (fields.costCenter) {
    nodes.push(
      <ReportFilterCostCenterSelect
        key="cc"
        label="مركز التكلفة"
        value={values.costCenterId}
        onChange={(costCenterId) => patch({ costCenterId })}
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
  if (fields.branch) {
    nodes.push(
      <ReportFilterBranchSelect
        key="branch"
        value={values.branchId}
        onChange={(branchId) => patch({ branchId })}
      />
    );
  }
  if (fields.invoiceRange) {
    nodes.push(
      <ReportFilterField key="from-inv" label="من فاتورة">
        <input
          type="number"
          className={`${reportFilterInputClass} text-center`}
          value={values.fromInvoice}
          onChange={(e) => patch({ fromInvoice: e.target.value })}
        />
      </ReportFilterField>,
      <ReportFilterField key="to-inv" label="إلى فاتورة">
        <input
          type="number"
          className={`${reportFilterInputClass} text-center`}
          value={values.toInvoice}
          onChange={(e) => patch({ toInvoice: e.target.value })}
        />
      </ReportFilterField>
    );
  }
  if (fields.serial) {
    nodes.push(
      <ReportFilterField key="serial" label="المسلسل">
        <input
          className={reportFilterInputClass}
          placeholder="رقم المسلسل"
          value={values.serial}
          onChange={(e) => patch({ serial: e.target.value })}
        />
      </ReportFilterField>
    );
  }
  if (fields.minValue) {
    nodes.push(
      <ReportFilterField key="min" label="الحد الأدنى">
        <input
          type="number"
          className={reportFilterInputClass}
          value={values.minValue}
          onChange={(e) => patch({ minValue: e.target.value })}
        />
      </ReportFilterField>
    );
  }
  if (fields.sortBy) {
    nodes.push(
      <ReportFilterSelect
        key="sort"
        label="فرز ب"
        value={values.sortBy}
        onChange={(sortBy) => patch({ sortBy })}
        options={[{ value: 'invoice-number', label: 'رقم الفاتورة' }]}
        placeholder="رقم الفاتورة"
      />
    );
  }

  const checks: ReactNode[] = [];
  if (fields.unpaidOnly) {
    checks.push(
      <ReportFilterCheckbox
        key="unpaid"
        id="unpaidOnly"
        label="إظهار الفواتير الغير مسددة فقط"
        checked={values.unpaidOnly}
        onChange={(unpaidOnly) => patch({ unpaidOnly })}
      />
    );
  }
  if (fields.allAccounts) {
    checks.push(
      <ReportFilterCheckbox
        key="allAcc"
        id="allAccounts"
        label="كل الحسابات"
        checked={values.allAccounts}
        onChange={(allAccounts) => patch({ allAccounts })}
      />
    );
  }
  if (fields.totalReport) {
    checks.push(
      <ReportFilterCheckbox
        key="total"
        id="totalReport"
        label="تقرير إجمالي"
        checked={values.totalReport}
        onChange={(totalReport) => patch({ totalReport })}
      />
    );
  }
  if (fields.showUnposted) {
    checks.push(
      <ReportFilterCheckbox
        key="unposted"
        id="showUnposted"
        label="إظهار العمليات غير المرحّلة"
        checked={values.showUnposted}
        onChange={(showUnposted) => patch({ showUnposted })}
      />
    );
  }
  if (checks.length) {
    nodes.push(<ReportFilterOptionsRow key="flags">{checks}</ReportFilterOptionsRow>);
  }

  return nodes;
}

export function InventoryReportFilterPage({
  urlPath,
  previewPath,
  icon,
  subtitle,
  fields,
  defaults,
}: {
  urlPath: string;
  previewPath?: string;
  icon?: string;
  subtitle?: string;
  fields: InventoryReportFilterFields;
  defaults?: Partial<InventoryReportFilterValues>;
}) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<InventoryReportFilterValues>(() => ({
    ...emptyInventoryReportFilters(),
    ...defaults,
  }));

  const patch = (p: Partial<InventoryReportFilterValues>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const handlePreview = () => {
    const message = validateInventoryReportFilters(filters, fields);
    if (message) {
      setError(message);
      return;
    }
    const qs = buildInventoryReportQuery(filters, fields).toString();
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
        setFilters({ ...emptyInventoryReportFilters(), ...defaults });
        setError('');
      }}
      error={error}
      onClearError={() => setError('')}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
    >
      {renderInventoryReportFields(filters, patch, fields)}
    </CatalogReportFilterShell>
  );
}
