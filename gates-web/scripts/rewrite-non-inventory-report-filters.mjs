#!/usr/bin/env node
/**
 * Rewrites CatalogReportFilterShell + LegacyGrid pages outside inventory
 * into ReportFilter* date/select layouts (safe full-file rewrite).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '../app');

const ROOTS = [
  'accounting/account-reports',
  'schools/reports',
  'taxes/reports',
  'manufacturing/reports',
  'real-estate-investment/reports',
  'extracts/reports',
  'electronic-invoices/reports',
  'importexport/reports',
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name === 'page.tsx') out.push(p);
  }
  return out;
}

function toComponentName(rel) {
  const base = path.basename(path.dirname(rel));
  return (
    base
      .split(/[-_/]/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('') + 'Page'
  );
}

function buildPage(file, src) {
  const urlMatch = src.match(/urlPath=["']([^"']+)["']/);
  if (!urlMatch) return null;
  const urlPath = urlMatch[1];
  const previewMatch = src.match(/router\.push\(`([^`$?]+)/);
  const previewBase = previewMatch?.[1] ?? `${urlPath}/preview`;

  const hasFrom = /fromDate/.test(src);
  const hasTo = /toDate/.test(src);
  const hasBranch = /branchId/.test(src);
  const hasCurrency = /currencyId|currencies/.test(src);
  const hasAccount = /accountId|accounts\.map/.test(src);
  const hasCostCenter = /costCenterId|costCenters/.test(src);
  const hasCustomer = /customerId/.test(src);
  const hasSupplier = /supplierId/.test(src);
  const hasUnposted = /showUnposted|غير مرح/.test(src);
  const hasStatus = /status:/.test(src) && /كليهما|status/.test(src);

  // Force rewrite when defaultFilters is missing dates but JSX uses them
  const brokenDates =
    /value=\{filters\.fromDate\}/.test(src) &&
    /const defaultFilters = \(\) => \(\{[\s\S]*?\}\);/.test(src) &&
    !/const defaultFilters = \(\) => \(\{[\s\S]*fromDate:/.test(src);
  const emptySection = /<ReportFilterSection title="المرشحات">\s*<\/ReportFilterSection>/.test(src);

  if (
    !brokenDates &&
    !emptySection &&
    !src.includes('ReportFilterLegacyGrid') &&
    !src.includes('#F6FBFD') &&
    !src.includes('#EAF6FB') &&
    src.includes('ReportFilterDate')
  ) {
    return null;
  }

  const filterKeys = [];
  // Always include date range — UI always renders التواريخ section.
  filterKeys.push("fromDate: new Date().toISOString().split('T')[0]");
  filterKeys.push("toDate: new Date().toISOString().split('T')[0]");
  if (hasBranch) filterKeys.push("branchId: ''");
  if (hasCurrency) filterKeys.push("currencyId: ''");
  if (hasAccount) filterKeys.push("accountId: ''");
  if (hasCostCenter) filterKeys.push("costCenterId: ''");
  if (hasCustomer) filterKeys.push("customerId: ''");
  if (hasSupplier) filterKeys.push("supplierId: ''");
  if (hasStatus) filterKeys.push("status: 'كليهما'");

  const imports = new Set(['ReportFilterDate', 'ReportFilterSection']);
  if (hasBranch || hasCurrency || hasAccount || hasStatus) imports.add('ReportFilterSelect');
  if (hasCostCenter) imports.add('ReportFilterCostCenterSelect');
  if (hasCustomer || hasSupplier) imports.add('ReportFilterPartySelect');
  if (hasUnposted) {
    imports.add('ReportFilterCheckbox');
    imports.add('ReportFilterOptionsRow');
  }

  const needApi = hasBranch || hasCurrency || hasAccount;
  const queries = [];
  if (hasBranch) {
    queries.push(`
  const { data: branchesResponse } = useApiQuery<{ id: string; code: string; arabicName: string }[]>(
    ['branches'],
    '/company/branches',
    { limit: 1000, isActive: true }
  );
  const branchOptions = (branchesResponse?.data ?? []).map((b) => ({
    value: b.id,
    label: b.code ? \`\${b.code} — \${b.arabicName}\` : b.arabicName,
  }));`);
  }
  if (hasCurrency) {
    queries.push(`
  const { data: currenciesResponse } = useApiQuery<{ id: string; code: string; arabicName: string }[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencyOptions = (currenciesResponse?.data ?? []).map((c) => ({
    value: c.id,
    label: \`\${c.arabicName} (\${c.code})\`,
  }));`);
  }
  if (hasAccount) {
    queries.push(`
  const { data: accountsResponse } = useApiQuery<{ id: string; code: string; arabicName: string }[]>(
    ['accounts'],
    '/accounting/accounts',
    { limit: 2000, isActive: true }
  );
  const accountOptions = (accountsResponse?.data ?? []).map((a) => ({
    value: a.id,
    label: a.code ? \`\${a.code} — \${a.arabicName}\` : a.arabicName,
  }));`);
  }

  const fields = [];
  fields.push(`        <ReportFilterSection title="التواريخ">`);
  fields.push(`          <ReportFilterDate
            label="من تاريخ"
            value={filters.fromDate}
            onChange={(fromDate) => patch({ fromDate })}
          />`);
  fields.push(`          <ReportFilterDate
            label="إلى تاريخ"
            value={filters.toDate}
            onChange={(toDate) => patch({ toDate })}
          />`);
  fields.push(`        </ReportFilterSection>`);

  const hasExtra =
    hasBranch || hasCurrency || hasAccount || hasCostCenter || hasCustomer || hasSupplier || hasStatus;
  if (hasExtra) {
    fields.push(`        <ReportFilterSection title="المرشحات">`);
    if (hasAccount) {
      fields.push(`          <ReportFilterSelect
            label="الحساب"
            value={filters.accountId}
            onChange={(accountId) => patch({ accountId })}
            options={accountOptions}
            placeholder="كل الحسابات"
          />`);
    }
    if (hasCustomer) {
      fields.push(`          <ReportFilterPartySelect
            label="العميل"
            kind="CUSTOMER"
            value={filters.customerId}
            onChange={(customerId) => patch({ customerId })}
            emptyLabel="كل العملاء"
          />`);
    }
    if (hasSupplier) {
      fields.push(`          <ReportFilterPartySelect
            label="المورد"
            kind="SUPPLIER"
            value={filters.supplierId}
            onChange={(supplierId) => patch({ supplierId })}
            emptyLabel="كل الموردين"
          />`);
    }
    if (hasCostCenter) {
      fields.push(`          <ReportFilterCostCenterSelect
            label="مركز التكلفة"
            value={filters.costCenterId}
            onChange={(costCenterId) => patch({ costCenterId })}
          />`);
    }
    if (hasCurrency) {
      fields.push(`          <ReportFilterSelect
            label="العملة"
            value={filters.currencyId}
            onChange={(currencyId) => patch({ currencyId })}
            options={currencyOptions}
            placeholder="كل العملات"
          />`);
    }
    if (hasBranch) {
      fields.push(`          <ReportFilterSelect
            label="الفرع"
            value={filters.branchId}
            onChange={(branchId) => patch({ branchId })}
            options={branchOptions}
            placeholder="كل الفروع"
          />`);
    }
    if (hasStatus) {
      fields.push(`          <ReportFilterSelect
            label="الحالة"
            value={filters.status}
            onChange={(status) => patch({ status })}
            options={[
              { value: 'كليهما', label: 'كليهما' },
              { value: 'مرحّل', label: 'مرحّل' },
              { value: 'غير مرحّل', label: 'غير مرحّل' },
            ]}
            placeholder="كليهما"
          />`);
    }
    fields.push(`        </ReportFilterSection>`);
  }

  if (hasUnposted) {
    fields.push(`        <ReportFilterOptionsRow>
          <ReportFilterCheckbox
            id="showUnposted"
            label="إظهار العمليات غير المرحّلة"
            checked={showUnposted}
            onChange={setShowUnposted}
          />
        </ReportFilterOptionsRow>`);
  }

  const previewLines = [];
  if (hasFrom || filterKeys.some((k) => k.startsWith('fromDate'))) {
    previewLines.push(`params.append('fromDate', filters.fromDate);`);
  }
  if (hasTo || filterKeys.some((k) => k.startsWith('toDate'))) {
    previewLines.push(`params.append('toDate', filters.toDate);`);
  }
  for (const key of [
    'branchId',
    'currencyId',
    'accountId',
    'costCenterId',
    'customerId',
    'supplierId',
    'status',
  ]) {
    if (filterKeys.some((k) => k.startsWith(key))) {
      previewLines.push(`if (filters.${key}) params.append('${key}', filters.${key});`);
    }
  }
  if (hasUnposted) previewLines.push(`if (showUnposted) params.append('showUnposted', 'true');`);

  const name = toComponentName(file);

  return `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';
import {
  ${[...imports].sort().join(',\n  ')},
} from '@/components/report/reportFilterFields';
${needApi ? "import { useApiQuery } from '@/lib/hooks/useApi';" : ''}

const defaultFilters = () => ({
  ${filterKeys.join(',\n  ')},
});

export default function ${name}() {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  ${hasUnposted ? 'const [showUnposted, setShowUnposted] = useState(true);' : ''}
  const [filters, setFilters] = useState(defaultFilters);

  const patch = (p: Partial<ReturnType<typeof defaultFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));
${queries.join('\n')}

  const handlePreview = () => {
    if (!filters.fromDate || !filters.toDate) {
      setError('يرجى اختيار تاريخ البداية والنهاية');
      return;
    }
    const params = new URLSearchParams();
    ${previewLines.join('\n    ')}
    router.push(\`${previewBase}?\${params.toString()}\`);
  };

  return (
    <CatalogReportFilterShell
      urlPath="${urlPath}"
      onPreview={handlePreview}
      onReset={() => {
        setFilters(defaultFilters());
        ${hasUnposted ? 'setShowUnposted(true);' : ''}
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

let n = 0;
for (const rel of ROOTS) {
  for (const file of walk(path.join(APP, rel))) {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('CatalogReportFilterShell')) continue;
    if (src.includes('ReportStubFilterPage')) continue;
    const out = buildPage(file, src);
    if (!out) continue;
    fs.writeFileSync(file, out);
    n++;
    console.log('rewrote', path.relative(APP, file));
  }
}
console.log(`non-inventory rewrite: ${n} pages`);
