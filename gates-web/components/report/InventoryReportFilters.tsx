'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';
import { UniversalReportViewer } from '@/components/report/UniversalReportViewer';
import { getReportByUrlPath } from '@/lib/reports/reportCatalog';
import { writeReportSearch } from '@/lib/reports/reportQueryUrl';
import { recalledTabSearch } from '@/lib/navigation/tab-memory';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';
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
  ReportFilterUserSelect,
  ReportFilterWarehouseSelect,
  reportFilterInputClass,
} from '@/components/report/reportFilterFields';
import type { DocumentBaseType } from '@/lib/document-profiles/types';

export type InventoryReportFilterValues = {
  fromDate: string;
  toDate: string;
  warehouseId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  itemId: string;
  itemGroupId: string;
  priceListId: string;
  customerId: string;
  supplierId: string;
  customerCategoryId: string;
  supplierCategoryId: string;
  delegateId: string;
  sellerId: string;
  driverId: string;
  distributorId: string;
  additions: string;
  otherDiscounts: string;
  withholdingTax: string;
  salesTax: string;
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
  /** exceeded = at or below the reorder point, within = still above it, all = both. */
  limitStatus: string;
  sortBy: string;
  minValue: string;
  ageFromInvoiceFrom: string;
  ageFromInvoiceTo: string;
  ageFromLastPaymentFrom: string;
  ageFromLastPaymentTo: string;
  profileId: string;
  userId: string;
  otherUnit: string;
  priceTier: string;
  /** أرباح المخزون: بطاقة الصنف أو معرّف قائمة أسعار. */
  salePriceSource: string;
  showEmpty: boolean;
  showWarehouse: boolean;
  showGroups: boolean;
  inactiveOnly: boolean;
  activeOnly: boolean;
  nonReturnableOnly: boolean;
  returnableOnly: boolean;
  noBelowCostOnly: boolean;
  belowCostOnly: boolean;
  negativeOnly: boolean;
  nonNegativeOnly: boolean;
  /** المبيعات الشهرية: إخفاء الأصناف التي لم يُبَع منها في الفترة. */
  hideUnsoldItems: boolean;
  manufacturerId: string;
  colorId: string;
  countryOfOrigin: string;
  quality: string;
  size: string;
  property1: string;
  property2: string;
  property3: string;
  property4: string;
  property5: string;
  /** الدفعات المتأخرة: الكل / متأخرة / لم تستحق / مسددة / جزئية / غير مسددة. */
  debtOrder: string;
  /** gt | gte | eq | lte | lt */
  daysLateOp: string;
  daysLateDays: string;
  /** cash | bank | cheque */
  paymentChannel: string;
};

export type ReportOptionId =
  | 'unpaidOnly'
  | 'showUnposted'
  | 'allAccounts'
  | 'totalReport'
  | 'showEmpty'
  | 'inactiveOnly'
  | 'activeOnly'
  | 'nonReturnableOnly'
  | 'returnableOnly'
  | 'noBelowCostOnly'
  | 'belowCostOnly'
  | 'negativeOnly'
  | 'nonNegativeOnly'
  | 'hideUnsoldItems';

const ITEM_CATALOG_OPTIONS: ReportOptionId[] = [
  'showEmpty',
  'inactiveOnly',
  'activeOnly',
  'nonReturnableOnly',
  'returnableOnly',
  'noBelowCostOnly',
  'belowCostOnly',
  'negativeOnly',
  'nonNegativeOnly',
];

const REPORT_OPTION_META: Record<ReportOptionId, { label: string; clear?: ReportOptionId }> = {
  unpaidOnly: { label: 'إظهار الفواتير الغير مسددة فقط' },
  showUnposted: { label: 'إظهار العمليات غير المرحّلة' },
  allAccounts: { label: 'كل الحسابات' },
  totalReport: { label: 'تقرير إجمالي' },
  showEmpty: { label: 'عرض الأصناف الفارغة' },
  inactiveOnly: { label: 'عرض الأصناف الغير نشطة فقط', clear: 'activeOnly' },
  activeOnly: { label: 'عرض الأصناف النشطة فقط', clear: 'inactiveOnly' },
  nonReturnableOnly: { label: 'عرض الأصناف التي لا يمكن إرجاعها فقط', clear: 'returnableOnly' },
  returnableOnly: { label: 'عرض الأصناف التي يمكن إرجاعها فقط', clear: 'nonReturnableOnly' },
  noBelowCostOnly: { label: 'عرض الأصناف التي لا يمكن بيعها بأقل من التكلفة', clear: 'belowCostOnly' },
  belowCostOnly: { label: 'عرض الأصناف التي يمكن بيعها بأقل من التكلفة', clear: 'noBelowCostOnly' },
  negativeOnly: { label: 'إظهار الأصناف السالبة فقط', clear: 'nonNegativeOnly' },
  nonNegativeOnly: { label: 'إظهار الأصناف الغير سالبة فقط', clear: 'negativeOnly' },
  hideUnsoldItems: { label: 'إخفاء الأصناف المرصدة' },
};

function uniqueOptionIds(ids: ReportOptionId[]): ReportOptionId[] {
  return [...new Set(ids)];
}

export type InventoryReportFilterFields = {
  dates?: 'range' | 'to' | 'none';
  warehouse?: boolean;
  /** من مخزن وإلى مخزن، كل واحد على حدة. */
  fromToWarehouse?: boolean;
  /** `all` includes header warehouses; the report then includes their child stores. */
  warehouseScope?: 'posting' | 'all';
  item?: boolean;
  itemGroup?: boolean;
  priceList?: boolean;
  customer?: boolean;
  supplier?: boolean;
  delegate?: boolean;
  seller?: boolean;
  driver?: boolean;
  distributor?: boolean;
  /** الكل / يوجد / لا يوجد for additions, other discounts, withholding, and sales tax. */
  financialPresence?: boolean;
  costCenter?: boolean;
  currency?: boolean;
  branch?: boolean;
  invoiceRange?: boolean;
  /** الدفعات المتأخرة: شرط أمر الدين، أيام التأخير، وطريقة السداد. */
  debtSchedule?: boolean;
  serial?: boolean;
  unpaidOnly?: boolean;
  allAccounts?: boolean;
  totalReport?: boolean;
  showUnposted?: boolean;
  /** أصناف حد الطلب: تعدى الحد، لم يتعد، أو الكل. */
  limitStatus?: boolean;
  sortBy?: boolean;
  minValue?: boolean;
  /** أعمار الديون: من/إلى لعمر الفاتورة وعمر آخر سداد. */
  debtAgeRanges?: boolean;
  profileBaseType?: DocumentBaseType;
  /** أرباح المخزون: التسعير، الوحدة الأخرى، وخيارات الأصناف. */
  stockProfit?: boolean;
  /** جرد الأصناف: الوحدة الأخرى، خصائص الصنف، وخيارات العرض. */
  stockCount?: boolean;
  /** `true` = خيارات الأصناف كاملة. أو قائمة مخصّصة لتقرير معيّن. */
  reportOptions?: boolean | ReportOptionId[];
  /** عرض بالمجموعات / عرض بالمخازن جنب زرار الخيارات. */
  groupByLayout?: boolean;
  /** المستخدم الذي أنشأ المستند. الافتراضي إظهاره. */
  user?: boolean;
};

export function resolveInventoryReportOptions(fields: InventoryReportFilterFields): ReportOptionId[] {
  const documentOptions: ReportOptionId[] = [];
  if (fields.unpaidOnly) documentOptions.push('unpaidOnly');
  if (fields.showUnposted !== false) documentOptions.push('showUnposted');
  if (fields.allAccounts) documentOptions.push('allAccounts');
  if (fields.totalReport) documentOptions.push('totalReport');

  if (Array.isArray(fields.reportOptions)) {
    return uniqueOptionIds([...documentOptions, ...fields.reportOptions]);
  }
  if (fields.stockCount || fields.stockProfit || fields.reportOptions === true) {
    return uniqueOptionIds([...documentOptions, ...ITEM_CATALOG_OPTIONS]);
  }
  return uniqueOptionIds(documentOptions);
}

export function emptyInventoryReportFilters(urlPath?: string): InventoryReportFilterValues {
  const range = reportDefaultDateRange(urlPath);
  return {
    fromDate: range.fromDate,
    toDate: range.toDate,
    warehouseId: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    itemId: '',
    itemGroupId: '',
    priceListId: '',
    customerId: '',
    supplierId: '',
    customerCategoryId: '',
    supplierCategoryId: '',
    delegateId: '',
    sellerId: '',
    driverId: '',
    distributorId: '',
    additions: '',
    otherDiscounts: '',
    withholdingTax: '',
    salesTax: '',
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
    limitStatus: 'exceeded',
    sortBy: 'invoice-number',
    minValue: '',
    ageFromInvoiceFrom: '',
    ageFromInvoiceTo: '',
    ageFromLastPaymentFrom: '',
    ageFromLastPaymentTo: '',
    profileId: '',
    userId: '',
    otherUnit: '2',
    priceTier: 'wholesale',
    salePriceSource: 'item_card',
    showEmpty: false,
    showWarehouse: false,
    showGroups: false,
    inactiveOnly: false,
    activeOnly: false,
    nonReturnableOnly: false,
    returnableOnly: false,
    noBelowCostOnly: false,
    belowCostOnly: false,
    negativeOnly: false,
    nonNegativeOnly: false,
    hideUnsoldItems: false,
    manufacturerId: '',
    colorId: '',
    countryOfOrigin: '',
    quality: '',
    size: '',
    property1: '',
    property2: '',
    property3: '',
    property4: '',
    property5: '',
    debtOrder: '',
    daysLateOp: '',
    daysLateDays: '',
    paymentChannel: '',
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
  if (fields.fromToWarehouse && values.fromWarehouseId) params.set('fromWarehouseId', values.fromWarehouseId);
  if (fields.fromToWarehouse && values.toWarehouseId) params.set('toWarehouseId', values.toWarehouseId);
  if (fields.item && values.itemId) params.set('itemId', values.itemId);
  if (fields.itemGroup && values.itemGroupId) params.set('itemGroupId', values.itemGroupId);
  if (fields.priceList && values.priceListId) params.set('priceListId', values.priceListId);
  if (fields.customer && values.customerId) params.set('customerId', values.customerId);
  if (fields.supplier && values.supplierId) params.set('supplierId', values.supplierId);
  if (fields.customer && values.customerCategoryId) {
    params.set('customerCategoryId', values.customerCategoryId);
  }
  if (fields.supplier && values.supplierCategoryId) {
    params.set('supplierCategoryId', values.supplierCategoryId);
  }
  if (fields.delegate && values.delegateId) params.set('delegateId', values.delegateId);
  if (fields.driver && values.driverId) params.set('driverId', values.driverId);
  if (fields.distributor && values.distributorId) params.set('distributorId', values.distributorId);
  if (fields.seller && values.sellerId) params.set('sellerId', values.sellerId);
  if (fields.costCenter && values.costCenterId) params.set('costCenterId', values.costCenterId);
  if (fields.currency && values.currencyId) params.set('currencyId', values.currencyId);
  if (fields.stockProfit || fields.stockCount || fields.reportOptions) {
    if (fields.stockCount) params.set('otherUnit', values.otherUnit || '2');
    if (fields.stockProfit) params.set('salePriceSource', values.salePriceSource || 'item_card');
    params.set('showEmpty', values.showEmpty ? 'true' : 'false');
    params.set('inactiveOnly', values.inactiveOnly ? 'true' : 'false');
    params.set('activeOnly', values.activeOnly ? 'true' : 'false');
    params.set('nonReturnableOnly', values.nonReturnableOnly ? 'true' : 'false');
    params.set('returnableOnly', values.returnableOnly ? 'true' : 'false');
    params.set('noBelowCostOnly', values.noBelowCostOnly ? 'true' : 'false');
    params.set('belowCostOnly', values.belowCostOnly ? 'true' : 'false');
    params.set('negativeOnly', values.negativeOnly ? 'true' : 'false');
    params.set('nonNegativeOnly', values.nonNegativeOnly ? 'true' : 'false');
  }
  if (fields.groupByLayout || fields.stockCount) {
    params.set('showWarehouse', values.showWarehouse && !values.showGroups ? 'true' : 'false');
    params.set('showGroups', values.showGroups ? 'true' : 'false');
  }
  if (fields.stockCount) {
    const textKeys = [
      'manufacturerId',
      'colorId',
      'countryOfOrigin',
      'quality',
      'size',
      'property1',
      'property2',
      'property3',
      'property4',
      'property5',
    ] as const;
    for (const key of textKeys) {
      const text = values[key].trim();
      if (text) params.set(key, text);
    }
  }
  if (fields.branch && values.branchId) params.set('branchId', values.branchId);
  if (values.userId) params.set('userId', values.userId);
  if (fields.invoiceRange && values.fromInvoice) params.set('fromInvoice', values.fromInvoice);
  if (fields.invoiceRange && values.toInvoice) params.set('toInvoice', values.toInvoice);
  if (fields.serial && values.serial) params.set('serial', values.serial);
  if (fields.debtSchedule) {
    if (values.debtOrder) params.set('debtOrder', values.debtOrder);
    if (values.daysLateDays.trim()) {
      params.set('daysLateDays', values.daysLateDays.trim());
      params.set('daysLateOp', values.daysLateOp || 'gte');
    }
    if (values.paymentChannel) params.set('paymentChannel', values.paymentChannel);
  }
  if (fields.unpaidOnly && values.unpaidOnly) params.set('unpaidOnly', 'true');
  if (fields.allAccounts && values.allAccounts) params.set('allAccounts', 'true');
  if (fields.totalReport && values.totalReport) params.set('totalReport', 'true');
  if (fields.showUnposted && values.showUnposted) params.set('showUnposted', 'true');
  if (
    (Array.isArray(fields.reportOptions) ? fields.reportOptions : []).includes('hideUnsoldItems') &&
    values.hideUnsoldItems
  ) {
    params.set('hideUnsoldItems', 'true');
  }
  if (fields.limitStatus && values.limitStatus) params.set('limitStatus', values.limitStatus);
  if (fields.sortBy && values.sortBy) params.set('sortBy', values.sortBy);
  if (fields.minValue && values.minValue) params.set('minValue', values.minValue);
  if (fields.debtAgeRanges) {
    if (values.ageFromInvoiceFrom) params.set('ageFromInvoiceFrom', values.ageFromInvoiceFrom);
    if (values.ageFromInvoiceTo) params.set('ageFromInvoiceTo', values.ageFromInvoiceTo);
    if (values.ageFromLastPaymentFrom) params.set('ageFromLastPaymentFrom', values.ageFromLastPaymentFrom);
    if (values.ageFromLastPaymentTo) params.set('ageFromLastPaymentTo', values.ageFromLastPaymentTo);
  }
  if (fields.profileBaseType && values.profileId) params.set('profileId', values.profileId);
  if (fields.financialPresence) {
    if (values.additions === 'yes' || values.additions === 'no') params.set('additions', values.additions);
    if (values.otherDiscounts === 'yes' || values.otherDiscounts === 'no') {
      params.set('otherDiscounts', values.otherDiscounts);
    }
    if (values.withholdingTax === 'yes' || values.withholdingTax === 'no') {
      params.set('withholdingTax', values.withholdingTax);
    }
    if (values.salesTax === 'yes' || values.salesTax === 'no') params.set('salesTax', values.salesTax);
  }
  return params;
}

function ReportFilterPriceListSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data, isLoading } = useApiQuery<{ id: string; code?: string | null; arabicName: string }[]>(
    ['report-filter-price-lists'],
    '/inventory/price-lists',
    { limit: 200, isActive: true }
  );
  const options = useMemo(
    () =>
      (data?.data ?? []).map((row) => ({
        value: row.id,
        label: row.code ? `${row.code} — ${row.arabicName}` : row.arabicName,
      })),
    [data?.data]
  );
  return (
    <ReportFilterCombobox
      label="قائمة الأسعار"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="كل القوائم"
      loading={isLoading}
    />
  );
}

function ReportFilterSalePriceSourceSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data, isLoading } = useApiQuery<{ id: string; code?: string | null; arabicName: string }[]>(
    ['report-filter-price-lists'],
    '/inventory/price-lists',
    { limit: 200, isActive: true }
  );
  const options = useMemo(
    () => [
      { value: 'item_card', label: 'بطاقة الصنف' },
      ...(data?.data ?? []).map((row) => ({
        value: row.id,
        label: row.code ? `${row.code} — ${row.arabicName}` : row.arabicName,
      })),
    ],
    [data?.data]
  );
  return (
    <ReportFilterCombobox
      label="سعر البيع المحدد"
      value={value || 'item_card'}
      onChange={onChange}
      options={options}
      placeholder="بطاقة الصنف"
      loading={isLoading}
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

  if (fields.customer) {
    nodes.push(
      <ReportFilterPartySelect
        key="customer"
        label="العميل"
        kind="CUSTOMER"
        value={values.customerId}
        onChange={(customerId) => patch({ customerId })}
        emptyLabel="كل العملاء"
        includeAllAccounts={values.allAccounts}
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
        includeAllAccounts={values.allAccounts}
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
  if (fields.driver) {
    nodes.push(
      <ReportFilterDelegateSelect
        key="driver"
        label="السائق"
        value={values.driverId}
        onChange={(driverId) => patch({ driverId })}
        emptyLabel="كل السائقين"
        role="DRIVER"
      />
    );
  }
  if (fields.distributor) {
    nodes.push(
      <ReportFilterDelegateSelect
        key="distributor"
        label="الموزع"
        value={values.distributorId}
        onChange={(distributorId) => patch({ distributorId })}
        emptyLabel="كل الموزعين"
        role="DISTRIBUTOR"
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
        leafOnly={fields.warehouseScope !== 'all'}
      />
    );
  }
  if (fields.fromToWarehouse) {
    nodes.push(
      <ReportFilterWarehouseSelect
        key="from-warehouse"
        label="من مخزن"
        value={values.fromWarehouseId}
        onChange={(fromWarehouseId) => patch({ fromWarehouseId })}
        leafOnly={fields.warehouseScope !== 'all'}
      />,
      <ReportFilterWarehouseSelect
        key="to-warehouse"
        label="إلى مخزن"
        value={values.toWarehouseId}
        onChange={(toWarehouseId) => patch({ toWarehouseId })}
        leafOnly={fields.warehouseScope !== 'all'}
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
  if (fields.priceList) {
    nodes.push(
      <ReportFilterPriceListSelect
        key="price-list"
        value={values.priceListId}
        onChange={(priceListId) => patch({ priceListId })}
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
  if (fields.stockCount) {
    nodes.push(
      <ReportFilterSelect
        key="other-unit"
        label="الوحدة الأخرى"
        value={values.otherUnit}
        onChange={(otherUnit) => patch({ otherUnit })}
        options={[
          { value: '1', label: 'وحدة رقم 1' },
          { value: '2', label: 'وحدة رقم 2' },
          { value: '3', label: 'وحدة رقم 3' },
          { value: '4', label: 'وحدة رقم 4' },
        ]}
      />
    );
  }
  if (fields.stockProfit) {
    nodes.push(
      <ReportFilterSalePriceSourceSelect
        key="sale-price-source"
        value={values.salePriceSource}
        onChange={(salePriceSource) => patch({ salePriceSource })}
      />
    );
  }
  if (fields.stockCount) {
    const property = (key: keyof InventoryReportFilterValues, label: string) => (
      <ReportFilterField key={key} label={label}>
        <input
          className={reportFilterInputClass}
          value={String(values[key] ?? '')}
          onChange={(event) => patch({ [key]: event.target.value } as Partial<InventoryReportFilterValues>)}
        />
      </ReportFilterField>
    );
    nodes.push(
      property('manufacturerId', 'المصنع'),
      property('colorId', 'اللون'),
      property('countryOfOrigin', 'بلد المنشأ'),
      property('quality', 'النوعية'),
      property('size', 'المقاس'),
      property('property1', 'خاصية 1'),
      property('property2', 'خاصية 2'),
      property('property3', 'خاصية 3'),
      property('property4', 'خاصية 4'),
      property('property5', 'خاصية 5')
    );
  }
  if (fields.user !== false) {
    nodes.push(
      <ReportFilterUserSelect
        key="user"
        value={values.userId}
        onChange={(userId) => patch({ userId })}
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
  if (fields.debtAgeRanges) {
    nodes.push(
      <ReportFilterField key="age-inv-from" label="عمر الدين للفاتورة من">
        <input
          type="number"
          min={0}
          className={`${reportFilterInputClass} text-center`}
          value={values.ageFromInvoiceFrom}
          onChange={(e) => patch({ ageFromInvoiceFrom: e.target.value })}
        />
      </ReportFilterField>,
      <ReportFilterField key="age-inv-to" label="عمر الدين للفاتورة إلى">
        <input
          type="number"
          min={0}
          className={`${reportFilterInputClass} text-center`}
          value={values.ageFromInvoiceTo}
          onChange={(e) => patch({ ageFromInvoiceTo: e.target.value })}
        />
      </ReportFilterField>,
      <ReportFilterField key="age-pay-from" label="عمر الدين لآخر سداد من">
        <input
          type="number"
          min={0}
          className={`${reportFilterInputClass} text-center`}
          value={values.ageFromLastPaymentFrom}
          onChange={(e) => patch({ ageFromLastPaymentFrom: e.target.value })}
        />
      </ReportFilterField>,
      <ReportFilterField key="age-pay-to" label="عمر الدين لآخر سداد إلى">
        <input
          type="number"
          min={0}
          className={`${reportFilterInputClass} text-center`}
          value={values.ageFromLastPaymentTo}
          onChange={(e) => patch({ ageFromLastPaymentTo: e.target.value })}
        />
      </ReportFilterField>
    );
  }
  if (fields.debtSchedule) {
    nodes.push(
      <ReportFilterSelect
        key="debt-order"
        label="شرط أمر الدين"
        value={values.debtOrder}
        onChange={(debtOrder) => patch({ debtOrder })}
        options={[
          { value: 'overdue', label: 'المتأخرة' },
          { value: 'notDue', label: 'لم تستحق' },
          { value: 'unpaid', label: 'غير المسددة' },
          { value: 'partial', label: 'المسددة جزئياً' },
          { value: 'paid', label: 'المسددة بالكامل' },
        ]}
        placeholder="الكل"
      />,
      <ReportFilterSelect
        key="days-late-op"
        label="شرط أيام التأخير"
        value={values.daysLateOp}
        onChange={(daysLateOp) => patch({ daysLateOp })}
        options={[
          { value: 'gt', label: 'أكبر من' },
          { value: 'gte', label: 'أكبر أو يساوي' },
          { value: 'eq', label: 'يساوي' },
          { value: 'lte', label: 'أصغر أو يساوي' },
          { value: 'lt', label: 'أصغر من' },
        ]}
        placeholder="أكبر أو يساوي"
      />,
      <ReportFilterField key="days-late" label="أيام التأخير">
        <input
          type="number"
          min={0}
          className={`${reportFilterInputClass} text-center`}
          value={values.daysLateDays}
          onChange={(e) => patch({ daysLateDays: e.target.value })}
        />
      </ReportFilterField>,
      <ReportFilterSelect
        key="payment-channel"
        label="طريقة السداد"
        value={values.paymentChannel}
        onChange={(paymentChannel) => patch({ paymentChannel })}
        options={[
          { value: 'cash', label: 'نقدي' },
          { value: 'bank', label: 'بنك' },
          { value: 'cheque', label: 'شيك' },
        ]}
        placeholder="الكل"
      />
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
  const optionIds = resolveInventoryReportOptions(fields);
  if (fields.limitStatus) {
    nodes.push(
      <ReportFilterSelect
        key="limitStatus"
        label="الحالة"
        value={values.limitStatus}
        onChange={(limitStatus) => patch({ limitStatus })}
        options={[
          { value: 'exceeded', label: 'تعدى حد الطلب' },
          { value: 'within', label: 'لم يتعد حد الطلب' },
          { value: 'all', label: 'الكل' },
        ]}
        placeholder="تعدى حد الطلب"
      />
    );
  }
  if (optionIds.length || fields.financialPresence || fields.groupByLayout || fields.stockCount) {
    checks.push(
      <ReportOptionsControl
        key="report-options"
        values={values}
        patch={patch}
        optionIds={optionIds}
        financialPresence={Boolean(fields.financialPresence)}
        groupByLayout={Boolean(fields.groupByLayout || fields.stockCount)}
      />
    );
  }
  if (checks.length) {
    nodes.push(<ReportFilterOptionsRow key="flags">{checks}</ReportFilterOptionsRow>);
  }

  return nodes;
}

function reportOption(
  id: ReportOptionId,
  values: InventoryReportFilterValues,
  patch: (next: Partial<InventoryReportFilterValues>) => void
) {
  const meta = REPORT_OPTION_META[id];
  return (
    <ReportFilterCheckbox
      key={id}
      id={id}
      label={meta.label}
      checked={Boolean(values[id])}
      onChange={(on) => {
        const next: Partial<InventoryReportFilterValues> = { [id]: on };
        if (on && meta.clear) next[meta.clear] = false;
        patch(next);
      }}
    />
  );
}

function ReportOptionsControl({
  values,
  patch,
  optionIds,
  financialPresence,
  groupByLayout,
}: {
  values: InventoryReportFilterValues;
  patch: (next: Partial<InventoryReportFilterValues>) => void;
  optionIds: ReportOptionId[];
  financialPresence: boolean;
  groupByLayout: boolean;
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

  const groupedByWarehouses = values.showWarehouse && !values.showGroups;
  const groupedByGroups = values.showGroups;

  return (
    <div ref={boxRef} className="relative flex flex-wrap items-center gap-2">
      {optionIds.length || financialPresence ? (
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
      ) : null}
      {groupByLayout ? (
        <>
          <ReportFilterCheckbox
            id="groupByGroups"
            label="عرض بالمجموعات"
            checked={groupedByGroups}
            onChange={(on) => patch({ showGroups: on, showWarehouse: on ? false : values.showWarehouse })}
          />
          <ReportFilterCheckbox
            id="groupByWarehouses"
            label="عرض بالمخازن"
            checked={groupedByWarehouses}
            onChange={(on) => patch({ showWarehouse: on, showGroups: on ? false : values.showGroups })}
          />
        </>
      ) : null}
      {open && (optionIds.length || financialPresence) ? (
        <div className="absolute top-full right-0 z-30 mt-2 w-[min(36rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">خيارات التقرير</div>
          {optionIds.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {optionIds.map((id) => reportOption(id, values, patch))}
            </div>
          ) : null}
          {financialPresence ? (
            <div className={`grid gap-2 sm:grid-cols-2 ${optionIds.length ? 'mt-3 border-t border-slate-100 pt-3 dark:border-slate-800' : ''}`}>
              {(
                [
                  { key: 'additions' as const, label: 'الإضافات' },
                  { key: 'otherDiscounts' as const, label: 'الخصومات الأخرى' },
                  { key: 'withholdingTax' as const, label: 'ضريبة خصم المنبع' },
                  { key: 'salesTax' as const, label: 'ضريبة المبيعات' },
                ] as const
              ).map((field) => (
                <ReportFilterSelect
                  key={field.key}
                  label={field.label}
                  value={values[field.key]}
                  onChange={(next) => patch({ [field.key]: next })}
                  options={[
                    { value: 'yes', label: 'يوجد' },
                    { value: 'no', label: 'لا يوجد' },
                  ]}
                  placeholder="الكل"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function InventoryReportFilterPage({
  urlPath,
  icon,
  subtitle,
  fields: pageFields,
  defaults,
}: {
  urlPath: string;
  previewPath?: string;
  icon?: string;
  subtitle?: string;
  fields: InventoryReportFilterFields;
  defaults?: Partial<InventoryReportFilterValues>;
}) {
  const fields: InventoryReportFilterFields = {
    ...pageFields,
    showUnposted: pageFields.showUnposted !== false,
  };
  const entry = getReportByUrlPath(urlPath);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<InventoryReportFilterValues>(() => ({
    ...emptyInventoryReportFilters(urlPath),
    ...defaults,
  }));
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const path = normalizeAppPath(window.location.pathname);
    const fromWindow = window.location.search.replace(/^\?/, '');
    const search = fromWindow || recalledTabSearch(path);
    if (!search) return;
    const entries = Object.fromEntries(new URLSearchParams(search));
    const next = { ...emptyInventoryReportFilters(urlPath), ...defaults };
    for (const key of Object.keys(next) as Array<keyof InventoryReportFilterValues>) {
      const value = entries[key];
      if (value == null || value === '') continue;
      if (typeof next[key] === 'boolean') {
        (next[key] as boolean) = value === 'true';
      } else {
        (next as Record<string, string | boolean>)[key] = value;
      }
    }
    if ((fields.groupByLayout || fields.stockCount) && next.showGroups) next.showWarehouse = false;
    const query = Object.fromEntries(buildInventoryReportQuery(next, fields));
    if (!query.fromDate && !query.toDate) return;
    setFilters(next);
    setPreviewQuery(query);
    const built = new URLSearchParams(query).toString();
    if (built !== fromWindow) writeReportSearch(query);
    // Restore once. Tab clicks open the bare path, so the last preview is in tab memory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (p: Partial<InventoryReportFilterValues>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const handlePreview = () => {
    const message = validateInventoryReportFilters(filters, fields);
    if (message) {
      setError(message);
      return;
    }
    const params = Object.fromEntries(buildInventoryReportQuery(filters, fields));
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
        setFilters({ ...emptyInventoryReportFilters(urlPath), ...defaults });
        setError('');
        setPreviewQuery(null);
        writeReportSearch(null);
      }}
      error={error}
      onClearError={() => setError('')}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
      below={
        entry && previewQuery ? (
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
      {renderInventoryReportFields(filters, patch, fields)}
    </CatalogReportFilterShell>
  );
}
