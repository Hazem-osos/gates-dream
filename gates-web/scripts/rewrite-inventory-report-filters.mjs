#!/usr/bin/env node
/**
 * Rewrites inventory LegacyGrid filter pages to ReportFilter* master pickers
 * (same pattern as purchase-reports / sales-reports).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../app/inventory/reports');

const SKIP = new Set([
  'sales-reports',
  'purchase-reports',
  'sales-and-purchase-tax',
  'customer-account-items',
  'item-movement-reports',
]);

function detect(src) {
  return {
    customer: /customerId|customers\.map|العميل/.test(src),
    supplier: /supplierId|suppliers\.map|المورد/.test(src),
    warehouse: /warehouseId|warehouses\.map|المخزن/.test(src),
    item: /itemId|items\.map|الصنف/.test(src) && !/itemGroupOnly/.test(src),
    costCenter: /costCenterId|costCenters\.map|مركز التكلفة/.test(src),
    delegate: /delegateId|delegates\.map|المندوب/.test(src),
    itemGroup: /itemGroupId|item-groups|المجموعة/.test(src),
    currency: /currencyId|currencies\.map|العملة/.test(src),
    fromDate: /fromDate/.test(src),
    toDate: /toDate/.test(src),
    unpaidOnly: /unpaidOnly|غير مسددة/.test(src),
    allAccounts: /allAccounts|كل الحسابات/.test(src),
    showUnposted: /showUnposted|غير مرح/.test(src),
    branch: /branchId|الفرع/.test(src),
    fromInvoice: /fromInvoice|من فاتورة/.test(src),
    toInvoice: /toInvoice|إلى فاتورة/.test(src),
    minValue: /minValue|من القيمة/.test(src),
  };
}

function extractUrlPath(src, dir) {
  const m = src.match(/urlPath=["']([^"']+)["']/);
  return m?.[1] ?? `/inventory/reports/${dir}`;
}

function extractPreviewPush(src, dir) {
  const m = src.match(/router\.push\(`([^`]+)`\)/);
  if (m) return m[1].replace(/\$\{params\.toString\(\)\}/, '');
  const m2 = src.match(/router\.push\(['"]([^'"]+)['"]/);
  return m2?.[1] ?? `/inventory/reports/${dir}/preview`;
}

function buildPage(dir, src) {
  const d = detect(src);
  const urlPath = extractUrlPath(src, dir);
  const previewBase = extractPreviewPush(src, dir).replace(/\?.*$/, '');
  const componentName =
    dir
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('') + 'Page';

  const filterKeys = [];
  if (d.customer) filterKeys.push("customerId: ''");
  if (d.supplier) filterKeys.push("supplierId: ''");
  if (d.delegate) filterKeys.push("delegateId: ''");
  if (d.warehouse) filterKeys.push("warehouseId: ''");
  if (d.itemGroup) filterKeys.push("itemGroupId: ''");
  if (d.item) filterKeys.push("itemId: ''");
  if (d.costCenter) filterKeys.push("costCenterId: ''");
  if (d.fromInvoice) filterKeys.push("fromInvoice: ''");
  if (d.toInvoice) filterKeys.push("toInvoice: ''");
  if (d.fromDate) filterKeys.push("fromDate: new Date().toISOString().split('T')[0]");
  if (d.toDate) filterKeys.push("toDate: new Date().toISOString().split('T')[0]");
  if (d.currency) filterKeys.push("currencyId: ''");
  if (d.branch) filterKeys.push("branchId: ''");
  if (d.minValue) filterKeys.push("minValue: ''");

  const imports = new Set([
    'ReportFilterDate',
    'ReportFilterSection',
    'ReportFilterSelect',
  ]);
  if (d.customer || d.supplier) imports.add('ReportFilterPartySelect');
  if (d.warehouse) imports.add('ReportFilterWarehouseSelect');
  if (d.item) imports.add('ReportFilterItemSelect');
  if (d.costCenter) imports.add('ReportFilterCostCenterSelect');
  if (d.delegate || d.itemGroup) imports.add('ReportFilterCombobox');
  if (d.unpaidOnly || d.allAccounts || d.showUnposted) {
    imports.add('ReportFilterCheckbox');
    imports.add('ReportFilterOptionsRow');
  }
  if (d.fromInvoice || d.toInvoice || d.minValue) {
    imports.add('ReportFilterField');
    imports.add('reportFilterInputClass');
  }

  const needMemo = d.currency || d.delegate || d.itemGroup;
  const queries = [];
  if (d.delegate) {
    queries.push(`
  const { data: delegatesResponse, isLoading: delegatesLoading } = useApiQuery<MasterRow[]>(
    ['delegates'],
    '/accounting/delegates',
    { limit: 1000, isActive: true }
  );
  const delegates = delegatesResponse?.data ?? [];
  const delegateOptions = useMemo(
    () => [
      { value: '', label: 'كل المندوبين' },
      ...delegates.map((r) => ({
        value: r.id,
        label: r.code ? \`\${r.code} — \${r.arabicName}\` : r.arabicName,
      })),
    ],
    [delegates]
  );`);
  }
  if (d.itemGroup) {
    queries.push(`
  const { data: itemGroupsResponse, isLoading: groupsLoading } = useApiQuery<MasterRow[]>(
    ['item-groups'],
    '/inventory/item-groups',
    { limit: 1000, isActive: true }
  );
  const itemGroups = itemGroupsResponse?.data ?? [];
  const itemGroupOptions = useMemo(
    () => [
      { value: '', label: 'كل المجموعات' },
      ...itemGroups.map((r) => ({
        value: r.id,
        label: r.code ? \`\${r.code} — \${r.arabicName}\` : r.arabicName,
      })),
    ],
    [itemGroups]
  );`);
  }
  if (d.currency) {
    queries.push(`
  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = currenciesResponse?.data ?? [];
  const currencyOptions = useMemo(
    () =>
      currencies.map((c) => ({
        value: c.id,
        label: \`\${c.arabicName} (\${c.code})\`,
      })),
    [currencies]
  );`);
  }

  const previewParams = [];
  if (d.fromDate) previewParams.push(`params.append('fromDate', filters.fromDate);`);
  if (d.toDate) previewParams.push(`params.append('toDate', filters.toDate);`);
  for (const key of [
    'customerId',
    'supplierId',
    'delegateId',
    'warehouseId',
    'itemGroupId',
    'itemId',
    'costCenterId',
    'fromInvoice',
    'toInvoice',
    'currencyId',
    'branchId',
    'minValue',
  ]) {
    if (filterKeys.some((k) => k.startsWith(key))) {
      previewParams.push(`if (filters.${key}) params.append('${key}', filters.${key});`);
    }
  }
  if (d.unpaidOnly) previewParams.push(`if (unpaidOnly) params.append('unpaidOnly', 'true');`);
  if (d.allAccounts) previewParams.push(`if (allAccounts) params.append('allAccounts', 'true');`);
  if (d.showUnposted) previewParams.push(`if (showUnposted) params.append('showUnposted', 'true');`);

  const fields = [];
  if (d.customer || d.supplier || d.delegate) {
    fields.push(`        <ReportFilterSection title="الأطراف">`);
    if (d.customer) {
      fields.push(`          <ReportFilterPartySelect
            label="العميل"
            kind="CUSTOMER"
            value={filters.customerId}
            onChange={(customerId) => patch({ customerId })}
            emptyLabel="كل العملاء"
          />`);
    }
    if (d.supplier) {
      fields.push(`          <ReportFilterPartySelect
            label="المورد"
            kind="SUPPLIER"
            value={filters.supplierId}
            onChange={(supplierId) => patch({ supplierId })}
            emptyLabel="كل الموردين"
          />`);
    }
    if (d.delegate) {
      fields.push(`          <ReportFilterCombobox
            label="المندوب"
            value={filters.delegateId}
            onChange={(delegateId) => patch({ delegateId })}
            options={delegateOptions}
            placeholder="كل المندوبين"
            loading={delegatesLoading}
          />`);
    }
    fields.push(`        </ReportFilterSection>`);
  }

  if (d.allAccounts) {
    fields.push(`        <ReportFilterOptionsRow>
          <ReportFilterCheckbox
            id="allAccounts-${dir}"
            label="كل الحسابات"
            checked={allAccounts}
            onChange={setAllAccounts}
          />
        </ReportFilterOptionsRow>`);
  }

  if (d.warehouse || d.item || d.itemGroup || d.costCenter) {
    fields.push(`        <ReportFilterSection title="المحتوى">`);
    if (d.warehouse) {
      fields.push(`          <ReportFilterWarehouseSelect
            label="المخزن"
            value={filters.warehouseId}
            onChange={(warehouseId) => patch({ warehouseId })}
          />`);
    }
    if (d.itemGroup) {
      fields.push(`          <ReportFilterCombobox
            label="المجموعة"
            value={filters.itemGroupId}
            onChange={(itemGroupId) => patch({ itemGroupId })}
            options={itemGroupOptions}
            placeholder="كل المجموعات"
            loading={groupsLoading}
          />`);
    }
    if (d.item) {
      fields.push(`          <ReportFilterItemSelect
            label="الصنف"
            value={filters.itemId}
            onChange={(itemId) => patch({ itemId })}
          />`);
    }
    if (d.costCenter) {
      fields.push(`          <ReportFilterCostCenterSelect
            label="مركز التكلفة"
            value={filters.costCenterId}
            onChange={(costCenterId) => patch({ costCenterId })}
          />`);
    }
    fields.push(`        </ReportFilterSection>`);
  }

  if (d.unpaidOnly || d.showUnposted) {
    fields.push(`        <ReportFilterOptionsRow>`);
    if (d.unpaidOnly) {
      fields.push(`          <ReportFilterCheckbox
            id="unpaidOnly-${dir}"
            label="إظهار الفواتير الغير مسددة فقط"
            checked={unpaidOnly}
            onChange={setUnpaidOnly}
          />`);
    }
    if (d.showUnposted) {
      fields.push(`          <ReportFilterCheckbox
            id="showUnposted-${dir}"
            label="إظهار العمليات غير المرحّلة"
            checked={showUnposted}
            onChange={setShowUnposted}
          />`);
    }
    fields.push(`        </ReportFilterOptionsRow>`);
  }

  if (d.fromInvoice || d.toInvoice) {
    fields.push(`        <ReportFilterSection title="الفواتير">`);
    if (d.fromInvoice) {
      fields.push(`          <ReportFilterField label="من فاتورة">
            <input
              type="number"
              className={\`\${reportFilterInputClass} text-center\`}
              value={filters.fromInvoice}
              onChange={(e) => patch({ fromInvoice: e.target.value })}
            />
          </ReportFilterField>`);
    }
    if (d.toInvoice) {
      fields.push(`          <ReportFilterField label="إلى فاتورة">
            <input
              type="number"
              className={\`\${reportFilterInputClass} text-center\`}
              value={filters.toInvoice}
              onChange={(e) => patch({ toInvoice: e.target.value })}
            />
          </ReportFilterField>`);
    }
    fields.push(`        </ReportFilterSection>`);
  }

  if (d.fromDate || d.toDate) {
    fields.push(`        <ReportFilterSection title="التواريخ">`);
    if (d.fromDate) {
      fields.push(`          <ReportFilterDate
            label="من تاريخ"
            value={filters.fromDate}
            onChange={(fromDate) => patch({ fromDate })}
          />`);
    }
    if (d.toDate) {
      fields.push(`          <ReportFilterDate
            label="إلى تاريخ"
            value={filters.toDate}
            onChange={(toDate) => patch({ toDate })}
          />`);
    }
    fields.push(`        </ReportFilterSection>`);
  }

  fields.push(`        <ReportFilterSection title="إعدادات أخرى">`);
  if (d.currency) {
    fields.push(`          <ReportFilterSelect
            label="العملة"
            value={filters.currencyId}
            onChange={(currencyId) => patch({ currencyId })}
            options={currencyOptions}
            placeholder="كل العملات"
          />`);
  }
  if (d.branch) {
    fields.push(`          <ReportFilterSelect
            label="الفرع"
            value={filters.branchId}
            onChange={(branchId) => patch({ branchId })}
            options={[{ value: '', label: 'كل الفروع' }]}
            placeholder="كل الفروع"
          />`);
  }
  if (d.minValue) {
    fields.push(`          <ReportFilterField label="من القيمة">
            <input
              type="number"
              className={reportFilterInputClass}
              value={filters.minValue}
              onChange={(e) => patch({ minValue: e.target.value })}
            />
          </ReportFilterField>`);
  }
  if (!d.currency && !d.branch && !d.minValue) {
    fields.push(`          <ReportFilterSelect
            label="الفرع"
            value=""
            onChange={() => {}}
            options={[{ value: '', label: 'كل الفروع' }]}
            placeholder="كل الفروع"
          />`);
  }
  fields.push(`        </ReportFilterSection>`);

  const dateGuard =
    d.fromDate && d.toDate
      ? `
    if (!filters.fromDate || !filters.toDate) {
      setError('يرجى اختيار تاريخ البداية والنهاية');
      return;
    }`
      : '';

  return `'use client';

import { ${needMemo ? 'useMemo, ' : ''}useState } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';
import {
  ${[...imports].sort().join(',\n  ')},
} from '@/components/report/reportFilterFields';
${d.currency || d.delegate || d.itemGroup ? "import { useApiQuery } from '@/lib/hooks/useApi';" : ''}
${
  d.delegate || d.itemGroup
    ? `
interface MasterRow {
  id: string;
  code: string;
  arabicName: string;
}
`
    : ''
}${
  d.currency
    ? `
interface Currency {
  id: string;
  code: string;
  arabicName: string;
}
`
    : ''
}
const defaultFilters = () => ({
  ${filterKeys.join(',\n  ')},
});

export default function ${componentName}() {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  ${d.allAccounts ? 'const [allAccounts, setAllAccounts] = useState(true);' : ''}
  ${d.unpaidOnly ? 'const [unpaidOnly, setUnpaidOnly] = useState(false);' : ''}
  ${d.showUnposted ? 'const [showUnposted, setShowUnposted] = useState(true);' : ''}
  const [filters, setFilters] = useState(defaultFilters);

  const patch = (p: Partial<ReturnType<typeof defaultFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));
${queries.join('\n')}

  const handlePreview = () => {${dateGuard}
    const params = new URLSearchParams();
    ${previewParams.join('\n    ')}
    router.push(\`${previewBase}?\${params.toString()}\`);
  };

  return (
    <CatalogReportFilterShell
      urlPath="${urlPath}"
      onPreview={handlePreview}
      onReset={() => {
        setFilters(defaultFilters());
        ${d.allAccounts ? 'setAllAccounts(true);' : ''}
        ${d.unpaidOnly ? 'setUnpaidOnly(false);' : ''}
        ${d.showUnposted ? 'setShowUnposted(true);' : ''}
      }}
      error={error}
      onClearError={() => setError('')}
      settingsOpen={showSettings}
      onSettingsOpenChange={setShowSettings}
    >
${fields.join('\n')}
    </CatalogReportFilterShell>
  );
}
`;
}

let rewritten = 0;
for (const ent of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!ent.isDirectory() || SKIP.has(ent.name) || ent.name === 'preview') continue;
  const page = path.join(ROOT, ent.name, 'page.tsx');
  if (!fs.existsSync(page)) continue;
  const src = fs.readFileSync(page, 'utf8');
  if (!src.includes('ReportFilterLegacyGrid') && !src.includes('const inputCls')) continue;
  if (src.includes('ReportFilterPartySelect') || src.includes('ReportFilterSection')) continue;
  // skip stubs
  if (src.includes('ReportStubFilterPage') || src.includes('redirect(')) continue;

  const out = buildPage(ent.name, src);
  fs.writeFileSync(page, out);
  rewritten++;
  console.log('rewrote', ent.name);
}

console.log(`inventory rewrite: ${rewritten} pages`);
