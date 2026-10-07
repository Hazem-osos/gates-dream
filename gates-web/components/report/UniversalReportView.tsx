'use client';

import '@/styles/print-report.css';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReportMetricCards } from '@/components/report/ReportMetricCards';
import { CustomerAccountReportBanner } from '@/components/report/CustomerAccountReportBanner';
import { ReportColumnPicker } from '@/components/report/ReportColumnPicker';
import { ReportPageShell } from '@/components/erp/ReportPageHeader';
import type { ReportBreadcrumb } from '@/lib/reports/reportPageBreadcrumbs';
import {
  getReportColumnsForPath,
  getRowCellValue,
  ledgerFooterFigures,
  parseSummaryCurrencies,
  partyCurrencyStatementColumns,
  type ReportColumnDef,
} from '@/lib/reportEngine/reportColumns';
import { useReportColumnVisibility } from '@/lib/reportEngine/useReportColumnVisibility';
import { formatReportCell, parseReportNumber } from '@/lib/reportEngine/reportFormatters';
import type { ReportFilterBadge } from '@/lib/reportEngine/reportFilterBadges';
import { exportTableToExcel } from '@/lib/export/export-utils';
import { printDom } from '@/lib/print/printHtml';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { formatUserDisplayName, type UserProfile } from '@/lib/user/profile';
import {
  accountLedgerHref,
  financialPaperHref,
  invoiceNumberHref,
  isAccountCodeColumn,
  isInvoiceNumberColumn,
  isItemCodeColumn,
  isItemNameColumn,
  isJournalNumberColumn,
  isPaperNumberColumn,
  operationNumberHref,
  itemMovementHref,
  journalEntryHref,
} from '@/lib/reportEngine/reportRowHref';
import { DailyTreasuryBook } from '@/components/report/DailyTreasuryBook';
import { BankMonthlyStatement } from '@/components/report/BankMonthlyStatement';
import { IncomeStatementSheet } from '@/components/report/IncomeStatementSheet';
import { ExpensesAnalysisSheet } from '@/components/report/ExpensesAnalysisSheet';
import { DailyJournalSheet } from '@/components/report/DailyJournalSheet';
import { MonthlyReviewSheet } from '@/components/report/MonthlyReviewSheet';
import { CostCenterReviewSheet } from '@/components/report/CostCenterReviewSheet';
import { BudgetSheet } from '@/components/report/BudgetSheet';
import { ProfitLossSheet } from '@/components/report/ProfitLossSheet';
import { ItemMovementSheet } from '@/components/report/ItemMovementSheet';
import { ExpiryDateSheet } from '@/components/report/ExpiryDateSheet';
import { MonthlyItemSalesSheet } from '@/components/report/MonthlyItemSalesSheet';
import { ColumnValueMenu } from '@/components/grid/ColumnValueMenu';
import {
  ItemsAnalyticalMovementSheet,
  readItemsAnalyticalSheet,
} from '@/components/report/ItemsAnalyticalMovementSheet';
import { StockTransferSheet } from '@/components/report/StockTransferSheet';
import { ReportScrollViewport } from '@/components/report/ReportScrollViewport';

export type UniversalReportViewProps = {
  title: string;
  reportKey: string;
  registryPath: string;
  rows: Record<string, unknown>[];
  summary?: unknown;
  filterBadges?: ReportFilterBadge[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  exportFileName?: string;
  columnDefs?: ReportColumnDef[];
  breadcrumbs?: ReportBreadcrumb[];
  /** Render under the filter form instead of as a standalone page. */
  embedded?: boolean;
  dataKey?: string;
  /** Current report filters, forwarded into account-code links on ميزان المراجعة. */
  drillQuery?: Record<string, string>;
  compareRows?: Record<string, unknown>[];
  compareSummary?: unknown;
  currentYearLabel?: string;
  compareYearLabel?: string;
  compareLoading?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    onPage: (page: number) => void;
  };
};

type ColumnFilter =
  | { mode: 'values'; selected: string[]; query?: string }
  | { mode: 'text'; query: string }
  | { mode: 'number'; min: string; max: string }
  | { mode: 'date'; from: string; to: string };

type ColumnSort = { columnId: string; direction: 'asc' | 'desc' };
function cellText(row: Record<string, unknown>, col: ReportColumnDef): string {
  const raw = getRowCellValue(row, col);
  const currency = typeof row.currencyCode === 'string' ? row.currencyCode : 'ج.م';
  const { text, badge } = formatReportCell(raw, col.format ?? 'text', {
    currencyCode: currency === 'EGP' ? 'ج.م' : currency,
    badgeMap: col.badgeMap,
  });
  return (badge?.label ?? text ?? '').trim();
}

function cellNumber(row: Record<string, unknown>, col: ReportColumnDef): number | null {
  return parseReportNumber(getRowCellValue(row, col));
}

function rowTimestamp(row: Record<string, unknown>): number | null {
  const keys = [
    'date',
    'invoiceDate',
    'documentDate',
    'dueDate',
    'postedAt',
    'createdAt',
    'effectiveAt',
    'lastPaymentDate',
    'lastInvoiceDate',
    'lastCollectionDate',
    'oldestDueDate',
    'expiryDate',
    'settlementDate',
    'transferDate',
  ];
  for (const key of keys) {
    const value = row[key];
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }
  }
  return null;
}

function compareReportRows(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  col: ReportColumnDef,
  direction: 'asc' | 'desc'
): number {
  const sign = direction === 'asc' ? 1 : -1;
  const numA = cellNumber(a, col);
  const numB = cellNumber(b, col);
  if (numA != null && numB != null) return (numA - numB) * sign;
  const timeA = cellTime(a, col);
  const timeB = cellTime(b, col);
  if (timeA != null && timeB != null) return (timeA - timeB) * sign;
  return cellText(a, col).localeCompare(cellText(b, col), 'ar') * sign;
}

function compareRowsByDateTime(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const timeA = rowTimestamp(a);
  const timeB = rowTimestamp(b);
  if (timeA != null && timeB != null && timeA !== timeB) return timeA - timeB;
  if (timeA != null && timeB == null) return -1;
  if (timeA == null && timeB != null) return 1;
  return 0;
}

function sortReportRows(
  rows: Record<string, unknown>[],
  columns: ReportColumnDef[],
  sort: ColumnSort | null
): Record<string, unknown>[] {
  const col = sort ? columns.find((column) => column.id === sort.columnId) : undefined;
  const grouped = rows.some((row) => {
    const accountPath = typeof row.accountPath === 'string' ? row.accountPath : '';
    const groupKey = typeof row.groupKey === 'string' ? row.groupKey : '';
    return Boolean(accountPath || (groupKey && groupKey !== 'all'));
  });
  const sorted = (list: Record<string, unknown>[]) =>
    [...list].sort((a, b) => {
      if (col && sort) {
        const byColumn = compareReportRows(a, b, col, sort.direction);
        if (byColumn !== 0) return byColumn;
      }
      return compareRowsByDateTime(a, b);
    });
  const pinAccountFooter = (list: Record<string, unknown>[]) => {
    const hasFooter = list.some((row) => row.rowKind === 'opening' || row.rowKind === 'total');
    if (!hasFooter) return sorted(list);
    const opening = list.filter((row) => row.rowKind === 'opening');
    const total = list.filter((row) => row.rowKind === 'total');
    const body = list.filter((row) => row.rowKind !== 'opening' && row.rowKind !== 'total');
    return [...opening, ...sorted(body), ...total];
  };
  const pinGroupBanners = (list: Record<string, unknown>[]) => {
    if (!list.some((row) => row.isGroup === true)) return pinAccountFooter(list);
    const sections: Record<string, unknown>[] = [];
    let banner: Record<string, unknown> | null = null;
    let body: Record<string, unknown>[] = [];
    const flush = () => {
      if (banner) sections.push(banner);
      sections.push(...pinAccountFooter(body));
      banner = null;
      body = [];
    };
    for (const row of list) {
      if (row.isGroup === true) {
        flush();
        banner = row;
        continue;
      }
      body.push(row);
    }
    flush();
    return sections;
  };
  if (!grouped) return pinGroupBanners(rows);
  const order: string[] = [];
  const buckets = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const accountPath = typeof row.accountPath === 'string' ? row.accountPath : '';
    const groupKey = typeof row.groupKey === 'string' && row.groupKey !== 'all' ? row.groupKey : '';
    const key = accountPath || groupKey;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(row);
  }
  return order.flatMap((key) => pinGroupBanners(buckets.get(key)!));
}

function cellTime(row: Record<string, unknown>, col: ReportColumnDef): number | null {
  const raw = getRowCellValue(row, col);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.getTime();
  if (typeof raw === 'string' && raw.trim()) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return null;
}

function cellDay(row: Record<string, unknown>, col: ReportColumnDef): string | null {
  const raw = getRowCellValue(row, col);
  if (typeof raw === 'string') {
    const match = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const time = cellTime(row, col);
  if (time == null) return null;
  return new Date(time).toISOString().slice(0, 10);
}

function uniqueColumnValues(rows: Record<string, unknown>[], col: ReportColumnDef): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const text = cellText(row, col);
    if (text && text !== '—') values.add(text);
  }
  return [...values].sort((a, b) => a.localeCompare(b, 'ar'));
}

function selectedValues(filter: ColumnFilter | undefined): string[] {
  return filter?.mode === 'values' ? filter.selected : [];
}

function columnFilterActive(filter: ColumnFilter): boolean {
  if (filter.mode === 'text') return filter.query.trim().length > 0;
  if (filter.mode === 'values') return filter.selected.length > 0 || Boolean(filter.query?.trim());
  if (filter.mode === 'number') return filter.min.trim() !== '' || filter.max.trim() !== '';
  return Boolean(filter.from || filter.to);
}

function cellMatchesText(row: Record<string, unknown>, col: ReportColumnDef, query: string): boolean {
  const shown = cellText(row, col);
  const raw = getRowCellValue(row, col);
  const rawText = raw == null || typeof raw === 'object' ? '' : String(raw);
  const hay = `${shown} ${rawText}`.toLowerCase();
  const q = query.trim().toLowerCase();
  if (hay.includes(q)) return true;
  if (!/^\d+$/.test(q)) return false;
  const suffix = (rawText || shown).match(/(\d+)\s*$/);
  return suffix != null && Number(suffix[1]) === Number(q);
}

function rowPassesColumn(
  row: Record<string, unknown>,
  col: ReportColumnDef,
  filter: ColumnFilter
): boolean {
  if (filter.mode === 'values') {
    const query = filter.query?.trim() ?? '';
    if (filter.selected.length && !filter.selected.includes(cellText(row, col))) return false;
    if (query && !cellMatchesText(row, col, query)) return false;
    return true;
  }
  if (filter.mode === 'text') {
    const query = filter.query.trim();
    if (!query) return true;
    return cellMatchesText(row, col, query);
  }
  if (filter.mode === 'number') {
    const value = cellNumber(row, col);
    const min = parseReportNumber(filter.min);
    const max = parseReportNumber(filter.max);
    if (value == null) return min == null && max == null;
    if (min != null && value < min) return false;
    if (max != null && value > max) return false;
    return true;
  }
  const day = cellDay(row, col);
  if (!day) return !filter.from && !filter.to;
  if (filter.from && day < filter.from) return false;
  if (filter.to && day > filter.to) return false;
  return true;
}

function readServerColumnTotals(summary: unknown): Record<string, number> | null {
  if (!summary || typeof summary !== 'object') return null;
  const raw = (summary as { columnTotals?: unknown }).columnTotals;
  if (!raw || typeof raw !== 'object') return null;
  const totals: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const amount = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(amount)) totals[key] = amount;
  }
  return Object.keys(totals).length ? totals : null;
}

function columnTotal(rows: Record<string, unknown>[], col: ReportColumnDef): number | null {
  if (col.totalMode === 'none') return null;
  if (col.totalMode === 'withOpening' || col.totalMode === 'net') {
    const figures = ledgerFooterFigures(rows);
    if (!figures) return null;
    if (col.totalMode === 'net') return figures.balance;
    const creditColumn = col.id === 'creditBase' || col.accessor === 'creditBase' || col.id === 'credit' || col.accessor === 'credit';
    return creditColumn ? figures.credit : figures.debit;
  }
  if (col.format !== 'money' && col.format !== 'number') return null;
  if (col.totalMode === 'last') {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (rows[index].rowKind === 'total' || rows[index].isGroup === true) continue;
      const value = cellNumber(rows[index], col);
      if (value != null) return value;
    }
    return null;
  }
  let sum = 0;
  let any = false;
  for (const row of rows) {
    if (row.rowKind === 'opening' || row.rowKind === 'total' || row.isGroup === true) continue;
    any = true;
    const value = cellNumber(row, col);
    if (value == null) continue;
    sum += value;
  }
  return any ? sum : null;
}

function ReportTable({
  rows,
  sourceRows,
  columns,
  filters,
  sort,
  onFilter,
  onSort,
  journalBook = false,
  separateEntries = false,
  linkAccountCodes = false,
  linkPaperNumbers = false,
  linkItemMovement = false,
  registryPath = '',
  drillQuery,
  moneyLabel,
  serverTotals,
}: {
  rows: Record<string, unknown>[];
  sourceRows: Record<string, unknown>[];
  columns: ReportColumnDef[];
  filters: Record<string, ColumnFilter>;
  sort: ColumnSort | null;
  onFilter: (columnId: string, next: ColumnFilter | null) => void;
  onSort: (next: ColumnSort | null) => void;
  journalBook?: boolean;
  separateEntries?: boolean;
  linkAccountCodes?: boolean;
  linkPaperNumbers?: boolean;
  linkItemMovement?: boolean | 'code';
  registryPath?: string;
  drillQuery?: Record<string, string>;
  moneyLabel?: string;
  serverTotals?: Record<string, number> | null;
}) {
  const router = useRouter();
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const valuesByColumn = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const col of columns) map.set(col.id, uniqueColumnValues(sourceRows, col));
    return map;
  }, [columns, sourceRows]);

  if (!columns.length) {
    return <p className="text-center text-slate-600 py-6">لا توجد أعمدة للعرض.</p>;
  }

  const openCol = columns.find((col) => col.id === openColumn) ?? null;
  const totals = columns.map((col) => {
    if (serverTotals && Object.prototype.hasOwnProperty.call(serverTotals, col.id)) {
      const value = serverTotals[col.id];
      return Number.isFinite(value) ? value : null;
    }
    return columnTotal(rows, col);
  });
  const totalLabelIndex = totals.findIndex((value) => value == null);

  const rowSurface = (row: Record<string, unknown>, i: number) => {
    if (row.rowKind === 'total') return 'bg-slate-100';
    if (row.rowKind === 'opening') return 'bg-amber-50';
    if (row.isGroup === true) return 'bg-sky-50';
    return i % 2 === 0 ? 'bg-slate-50' : 'bg-white';
  };

  return (
    <div>
    <ReportScrollViewport className="rounded-xl border border-slate-200 bg-white report-print-table-wrap">
      <table className="w-full text-sm text-center report-print-table">
        <thead>
          <tr>
            {columns.map((col, colIndex) => {
              const active = filters[col.id] ? columnFilterActive(filters[col.id]) : false;
              const sortedMark = sort?.columnId === col.id ? (sort.direction === 'asc' ? '↑' : '↓') : '';
              const columnValues = valuesByColumn.get(col.id) ?? [];
              return (
                <th
                  key={col.id}
                  className={`bg-[#1787B8] p-0 font-medium whitespace-nowrap text-white no-print:bg-[#1787B8] ${
                    colIndex === 0 ? 'min-w-[7rem]' : ''
                  }`}
                >
                  {columnValues.length ? (
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-1 px-2 py-2"
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setAnchor({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
                        setOpenColumn((current) => (current === col.id ? null : col.id));
                      }}
                    >
                      <span>{col.label}</span>
                      {sortedMark ? <span className="text-[10px] text-amber-200">{sortedMark}</span> : null}
                      <span className={`text-[10px] ${active ? 'text-amber-200' : 'text-white/70'}`}>▾</span>
                    </button>
                  ) : (
                    <span className="inline-flex w-full items-center justify-center gap-1 px-2 py-2">
                      <span>{col.label}</span>
                      {sortedMark ? <span className="text-[10px] text-amber-200">{sortedMark}</span> : null}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const entryHref = journalEntryHref(row);
            const path = typeof row.accountPath === 'string' ? row.accountPath : '';
            const previous = i > 0 && typeof rows[i - 1]?.accountPath === 'string' ? String(rows[i - 1].accountPath) : '';
            const showGroup = Boolean(path) && path !== previous;
            const entryId = String(row.journalEntryId ?? '');
            const previousEntry = i > 0 ? String(rows[i - 1]?.journalEntryId ?? '') : '';
            const entryBreak = separateEntries && Boolean(entryId) && entryId !== previousEntry;
            return (
              <Fragment key={i}>
              {showGroup ? (
                <tr className="bg-sky-100">
                  <td colSpan={columns.length} className="px-3 py-2 text-right text-xs font-semibold text-sky-950">
                    {path}
                  </td>
                </tr>
              ) : null}
              {entryBreak && i > 0 ? (
                <tr aria-hidden>
                  <td colSpan={columns.length} className="h-3 border-t-2 border-slate-300 bg-slate-200/70 p-0" />
                </tr>
              ) : null}
              <tr
                className={
                  row.rowKind === 'total'
                    ? 'border-t border-slate-300 bg-slate-100 font-semibold'
                    : row.rowKind === 'opening'
                      ? 'bg-amber-50 text-slate-700'
                      : row.isGroup === true
                        ? 'bg-sky-50 font-semibold'
                        : i % 2 === 0
                          ? 'bg-slate-50'
                          : 'bg-white'
                }
              >
                {columns.map((col, colIndex) => {
                  const raw = getRowCellValue(row, col);
                  const currency = moneyLabel
                    ? moneyLabel
                    : typeof row.currencyCode === 'string'
                      ? row.currencyCode === 'EGP'
                        ? 'ج.م'
                        : row.currencyCode
                      : 'ج.م';
                  const { text, badge } = formatReportCell(raw, col.format ?? 'text', {
                    currencyCode: currency === 'EGP' ? 'ج.م' : currency,
                    badgeMap: col.badgeMap,
                  });
                  const operationHref = operationNumberHref(col, row, registryPath);
                  const openOperation = Boolean(operationHref) && text.trim() !== '' && text !== '—';
                  const openEntry =
                    !openOperation &&
                    Boolean(entryHref) &&
                    isJournalNumberColumn(col) &&
                    text.trim() !== '' &&
                    text !== '—';
                  const ledgerHref =
                    linkAccountCodes && isAccountCodeColumn(col)
                      ? accountLedgerHref(row, drillQuery)
                      : null;
                  const openLedger = Boolean(ledgerHref) && text.trim() !== '' && text !== '—';
                  const paperHref =
                    linkPaperNumbers && isPaperNumberColumn(col) ? financialPaperHref(row) : null;
                  const openPaper = Boolean(paperHref) && text.trim() !== '' && text !== '—';
                  const movementHref =
                    linkItemMovement &&
                    (linkItemMovement === 'code'
                      ? isItemCodeColumn(col)
                      : isItemNameColumn(col) || isItemCodeColumn(col))
                      ? itemMovementHref(row, drillQuery)
                      : null;
                  const openMovement = Boolean(movementHref) && text.trim() !== '' && text !== '—';
                  const invoiceHref = isInvoiceNumberColumn(col)
                    ? invoiceNumberHref(row, registryPath)
                    : null;
                  const openInvoice = Boolean(invoiceHref) && text.trim() !== '' && text !== '—';
                  const depth =
                    (col.id === 'arabicName' || col.id === 'code') && typeof row.depth === 'number'
                      ? row.depth
                      : 0;
                  return (
                    <td
                      key={col.id}
                      style={depth ? { paddingInlineStart: 8 + depth * 18 } : undefined}
                      className={
                        journalBook
                          ? `border border-slate-400 px-2 py-1 text-center ${
                              col.format === 'money' ? 'text-red-600 font-medium' : 'text-slate-900'
                            } ${colIndex === 0 ? rowSurface(row, i) : ''}`
                          : `py-2 px-2 border-b border-slate-100 text-slate-800 ${
                              colIndex === 0 ? rowSurface(row, i) : ''
                            }`
                      }
                    >
                      {badge ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium report-print-badge ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      ) : openOperation && operationHref ? (
                        <Link
                          href={operationHref}
                          className="cursor-pointer font-medium text-[#0E78AA] underline decoration-[#0E78AA]/40 underline-offset-2 hover:text-[#0a5f86]"
                        >
                          {text}
                        </Link>
                      ) : openEntry ? (
                        <button
                          type="button"
                          className="cursor-pointer font-medium text-[#0E78AA] underline decoration-[#0E78AA]/40 underline-offset-2 hover:text-[#0a5f86]"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (entryHref) router.push(entryHref);
                          }}
                        >
                          {text}
                        </button>
                      ) : (openLedger && ledgerHref) ||
                        (openPaper && paperHref) ||
                        (openMovement && movementHref) ||
                        (openInvoice && invoiceHref) ? (
                        <Link
                          href={
                            (openPaper
                              ? paperHref
                              : openLedger
                                ? ledgerHref
                                : openMovement
                                  ? movementHref
                                  : invoiceHref) as string
                          }
                          className="cursor-pointer font-medium text-[#0E78AA] underline decoration-[#0E78AA]/40 underline-offset-2 hover:text-[#0a5f86]"
                        >
                          {text}
                        </Link>
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
              </Fragment>
            );
          })}
        </tbody>
        {totals.some((value) => value != null) ? (
          <tfoot>
            <tr className="bg-slate-100 font-semibold">
              {columns.map((col, index) => {
                const total = totals[index];
                const currency = moneyLabel ?? 'ج.م';
                const label =
                  total == null && (index === totalLabelIndex || (totalLabelIndex < 0 && index === 0))
                    ? 'الإجمالي'
                    : '';
                const shown =
                  total == null
                    ? label
                    : formatReportCell(total, col.format ?? 'number', {
                        currencyCode: currency === 'EGP' ? 'ج.م' : currency,
                      }).text;
                return (
                  <td
                    key={col.id}
                    className={`border-t border-slate-300 px-2 py-2 text-slate-900 bg-slate-100 ${
                      index === 0 ? 'min-w-[7rem]' : ''
                    }`}
                  >
                    {shown}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        ) : null}
      </table>
      {openCol && anchor && (valuesByColumn.get(openCol.id)?.length ?? 0) > 0 ? (
        <ColumnValueMenu
          label={openCol.label}
          values={valuesByColumn.get(openCol.id) ?? []}
          selected={selectedValues(filters[openCol.id])}
          sortDirection={sort?.columnId === openCol.id ? sort.direction : null}
          anchor={anchor}
          onClose={() => setOpenColumn(null)}
          onSort={(direction) => onSort(direction ? { columnId: openCol.id, direction } : null)}
          onSelected={(selected) => onFilter(openCol.id, selected.length ? { mode: 'values', selected } : null)}
          onClear={() => {
            onFilter(openCol.id, null);
            setOpenColumn(null);
          }}
        />
      ) : null}
    </ReportScrollViewport>
    </div>
  );
}

function buildReportExportColumns(columns: ReportColumnDef[]) {
  return columns.map((col) => ({
    id: col.id,
    header: col.label,
    numeric: col.format === 'number' || col.format === 'money',
    getValue: (row: Record<string, unknown>) => {
      const raw = getRowCellValue(row, col);
      if (col.format === 'number' || col.format === 'money') {
        const num = parseReportNumber(raw);
        return num == null ? '' : num;
      }
      if (raw == null || raw === '') return '';
      if (typeof raw === 'boolean') return raw ? 'نعم' : 'لا';
      return String(raw);
    },
  }));
}

function buildReportTotalsFooterRow(
  dataRows: Record<string, unknown>[],
  columns: ReportColumnDef[],
  serverTotals: Record<string, number> | null
): Record<string, unknown> | null {
  const totals = columns.map((col) => {
    if (serverTotals && Object.prototype.hasOwnProperty.call(serverTotals, col.id)) {
      const value = serverTotals[col.id];
      return Number.isFinite(value) ? value : null;
    }
    return columnTotal(dataRows, col);
  });
  if (!totals.some((value) => value != null)) return null;
  const row: Record<string, unknown> = {};
  let labelPlaced = false;
  columns.forEach((col, index) => {
    const total = totals[index];
    const key = String(col.accessor ?? col.id);
    if (total == null) {
      if (!labelPlaced) {
        row[key] = 'الإجمالي';
        labelPlaced = true;
      }
      return;
    }
    row[key] = total;
  });
  return row;
}

export function UniversalReportView({
  title,
  reportKey,
  registryPath,
  rows,
  summary,
  filterBadges = [],
  isLoading,
  isError,
  errorMessage,
  exportFileName,
  columnDefs,
  breadcrumbs,
  embedded = false,
  drillQuery,
  compareRows = [],
  compareSummary,
  currentYearLabel,
  compareYearLabel,
  compareLoading = false,
  pagination,
}: UniversalReportViewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { profile } = useCompanyPrintProfile();
  const { data: userResp } = useApiQuery<UserProfile>(
    queryKeys.userMe,
    '/users/me',
    undefined,
    { staleTime: 300_000, retry: 1 }
  );
  const printedBy = userResp?.data
    ? formatUserDisplayName(userResp.data)
    : 'مستخدم النظام';

  const allColumns = useMemo(() => {
    const currencies = parseSummaryCurrencies(summary);
    const isPartyCurrency =
      reportKey === 'customer-accounts-currency-reports' ||
      reportKey === 'supplier-accounts-currencies' ||
      registryPath.includes('customer-accounts-currency-reports') ||
      registryPath.includes('supplier-accounts-currencies');
    if (isPartyCurrency && currencies.length) {
      const partyLabel =
        reportKey.includes('supplier') || registryPath.includes('supplier') ? 'المورد' : 'العميل';
      return partyCurrencyStatementColumns(partyLabel, currencies);
    }
    const cols = columnDefs?.length ? columnDefs : getReportColumnsForPath(registryPath, rows);
    const record =
      summary && typeof summary === 'object' ? (summary as Record<string, unknown>) : null;
    const base = typeof record?.baseCurrencyName === 'string' ? record.baseCurrencyName.trim() : '';
    const foreign =
      typeof record?.foreignCurrencyName === 'string' ? record.foreignCurrencyName.trim() : '';
    if (!base && !foreign) return cols;
    const labels: Record<string, string> = {
      ...(base
        ? {
            baseDebit: `مدين ${base}`,
            baseCredit: `دائن ${base}`,
            baseBalance: `الرصيد ${base}`,
          }
        : {}),
      ...(foreign
        ? {
            foreignDebit: `مدين ${foreign}`,
            foreignCredit: `دائن ${foreign}`,
            foreignBalance: `الرصيد ${foreign}`,
          }
        : {}),
    };
    return cols.map((col) => (labels[col.id] ? { ...col, label: labels[col.id] } : col));
  }, [columnDefs, registryPath, reportKey, rows, summary]);

  const {
    visibleColumns,
    visibleIds,
    setColumnVisible,
    selectAll,
    selectRecommended,
    pickableColumns,
  } = useReportColumnVisibility(reportKey, allColumns);
  const isInventoryCount = reportKey === 'inventory-reports';
  const [showItemDetails, setShowItemDetails] = useState(false);
  const displayColumns = useMemo(
    () =>
      isInventoryCount && !showItemDetails
        ? visibleColumns.filter((column) => !column.detail)
        : visibleColumns,
    [isInventoryCount, showItemDetails, visibleColumns]
  );

  const gridKey = `gates-report-grid:${reportKey}`;
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({});
  const [columnSort, setColumnSort] = useState<ColumnSort | null>(null);
  const [gridReady, setGridReady] = useState(false);

  useEffect(() => {
    setGridReady(false);
    try {
      const raw = sessionStorage.getItem(gridKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          filters?: Record<string, ColumnFilter>;
          sort?: ColumnSort | null;
        };
        setColumnFilters(saved.filters ?? {});
        setColumnSort(saved.sort ?? null);
      } else {
        setColumnFilters({});
        setColumnSort(null);
      }
    } catch {
      setColumnFilters({});
      setColumnSort(null);
    }
    setGridReady(true);
  }, [gridKey]);

  useEffect(() => {
    if (!gridReady) return;
    sessionStorage.setItem(
      gridKey,
      JSON.stringify({ filters: columnFilters, sort: columnSort })
    );
  }, [gridKey, columnFilters, columnSort, gridReady]);

  const filteredRows = useMemo(() => {
    const active = Object.entries(columnFilters).filter(([, filter]) => columnFilterActive(filter));
    const matched = !active.length
      ? rows
      : rows.filter((row) => {
          const checks = active.map(([columnId, filter]) => {
            const col = displayColumns.find((column) => column.id === columnId);
            if (!col) return true;
            return rowPassesColumn(row, col, filter);
          });
          return checks.every(Boolean);
        });
    return sortReportRows(matched, displayColumns, columnSort);
  }, [rows, columnFilters, displayColumns, columnSort]);

  const reportMoneyLabel = (() => {
    const code =
      summary && typeof summary === 'object' && typeof (summary as { currencyCode?: unknown }).currencyCode === 'string'
        ? (summary as { currencyCode: string }).currencyCode
        : '';
    if (!code) return undefined;
    return code === 'EGP' ? 'ج.م' : code;
  })();
  const isJournalBook = reportKey === 'journal-book' || reportKey === 'daily-journal';
  const [journalView, setJournalView] = useState<'day' | 'entry' | 'list'>('day');
  const isTreasury = reportKey === 'safe';
  const isBankMovement = reportKey === 'bank-movement';
  const isCashBook = isTreasury || isBankMovement;
  const isProfitLoss = reportKey === 'profit-loss';
  const isIncome = reportKey === 'income-statement';
  const isExpenses = reportKey === 'expenses-analysis';
  const isMonthlyReview = reportKey === 'monthly-review-balance';
  const isCostCenterReview = reportKey === 'cost-center-balance' || reportKey === 'cost-center-balancee';
  const isBudget = reportKey === 'budget' || reportKey === 'cost-centers-balance';
  const isItemMovement =
    reportKey === 'item-movement-reports' ||
    reportKey === 'item-movements' ||
    reportKey === 'cost-center-item-movement';
  const isExpiry = reportKey === 'expiry-date-report';
  const isMonthlyItemSales = reportKey === 'monthly-sales-for-items';
  const isAnalyticalInvoices = reportKey === 'analytical-invoices';
  const isItemsAnalytical = reportKey === 'items-analytical-movement-on-representatives';
  const isStockTransfer = reportKey === 'stock-transfer-report';
  const isPartyAccountStatement =
    reportKey === 'customer-accounts-reports' || reportKey === 'supplier-accounts-reports';
  const [treasuryView, setTreasuryView] = useState<'list' | 'daily' | 'receipts' | 'payments' | 'monthly'>('list');
  const [expenseView, setExpenseView] = useState<'date' | 'totals'>('date');
  const shownRows = useMemo(() => {
    if (!isCashBook || treasuryView === 'list' || treasuryView === 'daily' || treasuryView === 'monthly') return filteredRows;
    const type = treasuryView === 'receipts' ? 'قبض' : 'صرف';
    return filteredRows.filter((row) => row.type === type);
  }, [filteredRows, isCashBook, treasuryView]);

  const [generatedAt, setGeneratedAt] = useState('');
  useEffect(() => {
    setGeneratedAt(
      new Date().toLocaleString('ar-EG', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  }, []);

  const pending = !mounted || Boolean(isLoading);

  const handlePrint = useCallback(() => {
    const root = document.getElementById('report-print-root');
    if (!root) return;
    void printDom(root, title);
  }, [title]);

  const handleExport = useCallback(async () => {
    const file = exportFileName ?? `${reportKey}-report`;
    if (reportKey === 'items-analytical-movement-on-representatives') {
      const { delegates, totals } = readItemsAnalyticalSheet(summary, filteredRows);
      const exportCols = [
        {
          id: 'itemSerial',
          header: 'الكود',
          getValue: (row: Record<string, unknown>) => String(row.itemSerial ?? ''),
        },
        {
          id: 'itemName',
          header: 'الصنف',
          getValue: (row: Record<string, unknown>) => String(row.itemName ?? ''),
        },
        ...delegates.flatMap((delegate) => [
          {
            id: `${delegate.id}-qty`,
            header: `${delegate.name} — الكمية`,
            getValue: (row: Record<string, unknown>) => {
              const cells = row.cells;
              const cell =
                cells && typeof cells === 'object'
                  ? (cells as Record<string, { quantity?: unknown }>)[delegate.id]
                  : undefined;
              const value = typeof cell?.quantity === 'number' ? cell.quantity : Number(cell?.quantity) || 0;
              return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            },
          },
          {
            id: `${delegate.id}-amount`,
            header: `${delegate.name} — القيمة`,
            getValue: (row: Record<string, unknown>) => {
              const cells = row.cells;
              const cell =
                cells && typeof cells === 'object'
                  ? (cells as Record<string, { amount?: unknown }>)[delegate.id]
                  : undefined;
              const value = typeof cell?.amount === 'number' ? cell.amount : Number(cell?.amount) || 0;
              return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            },
          },
        ]),
      ];
      await exportTableToExcel(
        file,
        exportCols,
        [...filteredRows, { itemSerial: '', itemName: 'الإجمالي', cells: totals }],
        'التقرير'
      );
      return;
    }
    const serverTotals = readServerColumnTotals(summary);
    const exportCols = buildReportExportColumns(displayColumns);
    const dataRows = filteredRows.filter((row) => row.isGroup !== true);
    const footer = buildReportTotalsFooterRow(dataRows, displayColumns, serverTotals);
    const exportData = footer ? [...dataRows, footer] : dataRows;
    const sheetName = reportKey === 'inventory-reports' ? 'جرد الأصناف' : 'التقرير';
    await exportTableToExcel(file, exportCols, exportData, sheetName);
  }, [exportFileName, reportKey, filteredRows, displayColumns, summary]);

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0E78AA] px-3 text-xs font-semibold text-white hover:bg-[#0c6894]"
      >
        طباعة
      </button>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={!filteredRows.length}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D6EAF3] bg-white px-3 text-xs font-semibold text-[#094C6B] hover:bg-[#F6FBFD] disabled:opacity-50"
      >
        تصدير Excel
      </button>
      {isItemMovement || isExpiry || isMonthlyItemSales || isItemsAnalytical || isStockTransfer ? null : (
        <ReportColumnPicker
          columns={pickableColumns}
          visibleIds={visibleIds}
          onToggle={setColumnVisible}
          onSelectAll={selectAll}
          onSelectRecommended={selectRecommended}
        />
      )}
    </div>
  );

  const body = (
      <div id="report-print-root" className="w-full max-w-none">
        {mounted ? (
          <div className="report-print-header-brand report-print-only">
            <div className="text-right">
              <div className="font-bold text-lg">{profile?.nameAr ?? 'الشركة'}</div>
              {profile?.taxRegistrationNumber ? (
                <div className="text-xs text-slate-600">ر.ض: {profile.taxRegistrationNumber}</div>
              ) : null}
            </div>
            {profile?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logoUrl} alt="" className="h-12 object-contain" />
            ) : null}
          </div>
        ) : null}

        {filterBadges.length ? (
          <div className="no-print mb-3 flex flex-wrap gap-2 justify-start">
            {filterBadges.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-full px-3 py-1 text-slate-700"
              >
                <span aria-hidden>{b.icon}</span>
                {b.label}
              </span>
            ))}
          </div>
        ) : null}

        {mounted ? (
          <div className="report-print-only text-center mb-4">
            <h1 className="text-lg font-bold">{title}</h1>
            {generatedAt ? (
              <p className="text-xs text-slate-600 mt-1">تاريخ الإنشاء: {generatedAt}</p>
            ) : null}
            {filterBadges.length ? (
              <p className="text-xs text-slate-600 mt-1">
                {filterBadges.map((b) => b.label).join(' · ')}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="h-1 bg-sky-700 w-full mb-4 no-print" />

        {pending ? (
          <div className="py-4 no-print">
            <TableSkeleton rows={8} columns={6} />
          </div>
        ) : null}

        {!pending && isError ? (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4 mb-4 no-print">
            {errorMessage ?? 'فشل تحميل التقرير.'}
          </p>
        ) : null}

        {!pending && isPartyAccountStatement ? (
          <CustomerAccountReportBanner summary={summary} currencyLabel={reportMoneyLabel} />
        ) : null}

        {!pending && summary != null && !isPartyAccountStatement && !isProfitLoss && !isIncome && !isCostCenterReview && !isItemMovement && !isExpiry && !isMonthlyItemSales && !isAnalyticalInvoices && !isItemsAnalytical && !isStockTransfer ? (
          <ReportMetricCards summary={summary} currencyLabel={reportMoneyLabel} />
        ) : null}

        {!pending && !isError && rows.length === 0 && !isProfitLoss && !isIncome && !(isBankMovement && treasuryView === 'monthly') ? (
          <EmptyState
            title="لا توجد بيانات"
            description={
              isExpiry
                ? 'لا توجد صلاحية مسجّلة في هذه الفترة. سجّل تاريخ الصلاحية على سطر الفاتورة أو التشغيلة، والفترة هنا تاريخ الصلاحية نفسه.'
                : isAnalyticalInvoices
                  ? 'لا توجد بنود عروض أسعار أو أوامر شراء في هذه الفترة.'
                  : 'لا توجد نتائج للتقرير ضمن مرشحات التاريخ والفرع الحالية.'
            }
          />
        ) : null}

        {!pending && !isError && rows.length > 0 && filteredRows.length === 0 ? (
          <EmptyState
            title="لا توجد صفوف"
            description="لا توجد صفوف تطابق فلتر الأعمدة."
          />
        ) : null}

        {!pending && !isError && ((isTreasury && rows.length > 0) || isBankMovement) ? (
          <div className="mb-3 flex flex-wrap gap-2 no-print">
            {(
              (isTreasury
                ? [
                    ['list', 'القائمة'],
                    ['daily', 'كشف يومي'],
                    ['receipts', 'مقبوضات فقط'],
                    ['payments', 'مدفوعات فقط'],
                  ]
                : [
                    ['list', 'القائمة'],
                    ['receipts', 'مقبوضات فقط'],
                    ['payments', 'مدفوعات فقط'],
                    ['monthly', 'تقرير شهري'],
                  ]) as Array<['list' | 'daily' | 'receipts' | 'payments' | 'monthly', string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-full px-3 py-1 text-sm ${
                  treasuryView === id ? 'bg-[#1787B8] text-white' : 'bg-slate-100 text-slate-700'
                }`}
                onClick={() => setTreasuryView(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {!pending && !isError && shownRows.length > 0 && treasuryView === 'daily' && isTreasury ? (
          <DailyTreasuryBook rows={shownRows} />
        ) : null}

        {!pending && !isError && isBankMovement && treasuryView === 'monthly' ? (
          <BankMonthlyStatement query={drillQuery ?? {}} />
        ) : null}

        {!pending && !isError && isProfitLoss && (shownRows.length > 0 || summary != null) ? (
          <ProfitLossSheet
            rows={shownRows}
            summary={summary}
            compareRows={compareRows}
            currentYearLabel={currentYearLabel}
            compareYearLabel={compareYearLabel}
          />
        ) : null}

        {!pending && !isError && isIncome && (shownRows.length > 0 || summary != null) ? (
          <IncomeStatementSheet
            rows={shownRows}
            summary={summary}
            compareRows={compareRows}
            compareSummary={compareSummary}
            currentYearLabel={currentYearLabel}
            compareYearLabel={compareYearLabel}
          />
        ) : null}

        {!pending && !isError && isExpenses && rows.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2 no-print">
            {(
              [
                ['date', 'بتاريخ الحركة'],
                ['totals', 'بالمجاميع'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-full px-3 py-1 text-sm ${
                  expenseView === id ? 'bg-[#1787B8] text-white' : 'bg-slate-100 text-slate-700'
                }`}
                onClick={() => setExpenseView(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {!pending && !isError && isExpenses && shownRows.length > 0 ? (
          <ExpensesAnalysisSheet rows={shownRows} mode={expenseView} />
        ) : null}

        {!pending && !isError && isMonthlyReview && shownRows.length > 0 ? (
          <MonthlyReviewSheet rows={shownRows} />
        ) : null}

        {!pending && !isError && isCostCenterReview && shownRows.length > 0 ? (
          <CostCenterReviewSheet rows={shownRows} summary={summary} />
        ) : null}

        {!pending && !isError && isBudget && shownRows.length > 0 ? (
          <BudgetSheet
            rows={shownRows}
            compareRows={compareRows}
            currentYearLabel={currentYearLabel}
            compareYearLabel={compareYearLabel}
            entity={reportKey === 'cost-centers-balance' ? 'costCenter' : 'account'}
          />
        ) : null}
        {compareLoading ? (
          <p className="mb-2 text-xs text-slate-500">جاري تحميل سنة المقارنة…</p>
        ) : null}

        {!pending && !isError && isJournalBook && rows.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2 no-print">
            {(
              [
                ['day', 'يومي'],
                ['entry', 'بالقيد'],
                ['list', 'القائمة'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-full px-3 py-1 text-sm ${
                  journalView === id ? 'bg-[#1787B8] text-white' : 'bg-slate-100 text-slate-700'
                }`}
                onClick={() => setJournalView(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {!pending && !isError && isJournalBook && shownRows.length > 0 && journalView !== 'list' ? (
          <DailyJournalSheet rows={shownRows} mode={journalView} />
        ) : null}

        {!pending && !isError && isItemMovement && shownRows.length > 0 ? (
          <ItemMovementSheet
            rows={shownRows}
            summary={summary}
            title={title}
            filters={filterBadges}
            groupBy={
              drillQuery?.showGroups === 'true'
                ? 'groups'
                : drillQuery?.showWarehouse === 'true'
                  ? 'warehouse'
                  : reportKey === 'cost-center-item-movement'
                    ? 'costCenter'
                    : 'none'
            }
          />
        ) : null}

        {!pending && !isError && isExpiry && shownRows.length > 0 ? (
          <ExpiryDateSheet rows={shownRows} summary={summary} />
        ) : null}

        {!pending && !isError && isMonthlyItemSales && shownRows.length > 0 ? (
          <MonthlyItemSalesSheet rows={shownRows} />
        ) : null}

        {!pending && !isError && isItemsAnalytical && shownRows.length > 0 ? (
          <ItemsAnalyticalMovementSheet rows={shownRows} summary={summary} />
        ) : null}

        {!pending && !isError && isStockTransfer && shownRows.length > 0 ? (
          <StockTransferSheet rows={shownRows} />
        ) : null}

        {!pending && !isError && shownRows.length > 0 && !isItemMovement && !isExpiry && !isMonthlyItemSales && !isItemsAnalytical && !isStockTransfer && !isIncome && !isProfitLoss && !isExpenses && !isMonthlyReview && !isCostCenterReview && !isBudget && !(isJournalBook && journalView !== 'list') && !(treasuryView === 'daily' && isTreasury) && !(treasuryView === 'monthly' && isBankMovement) ? (
          <>
            {isInventoryCount ? (
              <div className="mb-3 flex justify-start no-print">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-sm ${
                    showItemDetails ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                  onClick={() => setShowItemDetails((on) => !on)}
                >
                  {showItemDetails ? 'إخفاء بيانات الصنف' : 'إظهار بيانات الصنف'}
                </button>
              </div>
            ) : null}
            <ReportTable
            rows={shownRows}
            sourceRows={rows}
            columns={displayColumns}
            filters={columnFilters}
            sort={columnSort}
            registryPath={registryPath}
            linkAccountCodes={reportKey === 'review-balance'}
            linkPaperNumbers={reportKey === 'financial-papers'}
            linkItemMovement={
              reportKey === 'items-profit-reports'
                ? 'code'
                : reportKey === 'inventory-reports' || reportKey === 'items-exceeding-order-limit'
            }
            drillQuery={drillQuery}
            moneyLabel={reportMoneyLabel}
            serverTotals={readServerColumnTotals(summary)}
            onSort={setColumnSort}
            onFilter={(columnId, next) =>
              setColumnFilters((prev) => {
                if (!next) {
                  const copy = { ...prev };
                  delete copy[columnId];
                  return copy;
                }
                const empty =
                  (next.mode === 'text' && !next.query.trim()) ||
                  (next.mode === 'values' && next.selected.length === 0) ||
                  (next.mode === 'number' && !next.min && !next.max) ||
                  (next.mode === 'date' && !next.from && !next.to);
                if (empty) {
                  const copy = { ...prev };
                  delete copy[columnId];
                  return copy;
                }
                return { ...prev, [columnId]: next };
              })
            }
            journalBook={isJournalBook}
            separateEntries={reportKey === 'unposted-operations' || reportKey === 'cancelled-operations'}
          />
          {pagination && pagination.total > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 no-print">
              <span className="text-sm text-slate-600">
                {pagination.total} فاتورة — الصفحة {pagination.page} من {Math.max(pagination.totalPages, 1)}
                {' · '}
                الإجمالي لكل النتائج المطابقة للمرشحات
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800 disabled:opacity-40"
                  disabled={pagination.page <= 1}
                  onClick={() => pagination.onPage(pagination.page - 1)}
                >
                  السابق
                </button>
                <button
                  type="button"
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800 disabled:opacity-40"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => pagination.onPage(pagination.page + 1)}
                >
                  التالي
                </button>
              </div>
            </div>
          ) : null}
          </>
        ) : null}

        {mounted ? (
          <div className="report-print-footer report-print-only">
            <span>طُبع بواسطة: {printedBy}</span>
            <span className="report-print-page" />
            <span>تقرير نظام Gates — للاستخدام الداخلي</span>
          </div>
        ) : null}
      </div>
  );

  if (embedded) {
    return (
      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3" dir="rtl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">نتائج التقرير</h2>
          {headerActions}
        </div>
        {body}
      </section>
    );
  }

  return (
    <ReportPageShell title={title} breadcrumbs={breadcrumbs} extraActions={headerActions} statusLabel="معاينة">
      {body}
    </ReportPageShell>
  );
}
