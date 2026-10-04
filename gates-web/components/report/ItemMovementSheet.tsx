'use client';

import { Fragment, useMemo, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { ColumnValueMenu } from '@/components/grid/ColumnValueMenu';
import { movementDocumentHref } from '@/lib/accounting/journal-source';
import type { ReportFilterBadge } from '@/lib/reportEngine/reportFilterBadges';

type Row = Record<string, unknown>;
type Kind = 'text' | 'qty' | 'money' | 'date' | 'balance';

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function dateLabel(value: unknown): string {
  const raw = typeof value === 'string' ? value : value instanceof Date ? value.toISOString() : '';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function qty(value: unknown): string {
  const n = num(value);
  if (!n) return '';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function money(value: unknown): string {
  const n = num(value);
  if (!n) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function moneyAlways(value: unknown): string {
  return num(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function balanceLabel(value: unknown): string {
  return num(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function shown(row: Row, key: string, kind: Kind): string {
  if (kind === 'date') return dateLabel(row[key]);
  if (kind === 'qty') return qty(row[key]);
  if (kind === 'money') return money(row[key]);
  if (kind === 'balance') return balanceLabel(row[key]);
  return text(row, key);
}

const ITEM_ATTRS: Array<{ key: string; label: string; kind: Kind }> = [
  { key: 'itemSerial', label: 'الكود', kind: 'text' },
  { key: 'itemGroupName', label: 'المجموعة', kind: 'text' },
  { key: 'manufacturer', label: 'المصنع', kind: 'text' },
  { key: 'color', label: 'اللون', kind: 'text' },
  { key: 'origin', label: 'المنشأ', kind: 'text' },
  { key: 'quality', label: 'النوعية', kind: 'text' },
  { key: 'size', label: 'المقاس', kind: 'text' },
  { key: 'property1', label: 'خاصية 1', kind: 'text' },
  { key: 'property2', label: 'خاصية 2', kind: 'text' },
  { key: 'property3', label: 'خاصية 3', kind: 'text' },
  { key: 'property4', label: 'خاصية 4', kind: 'text' },
  { key: 'property5', label: 'خاصية 5', kind: 'text' },
  { key: 'barcode', label: 'الباركود', kind: 'text' },
  { key: 'upperLimit', label: 'الحد الأعلى', kind: 'qty' },
  { key: 'orderLimit', label: 'حد الطلب', kind: 'qty' },
  { key: 'lowerLimit', label: 'الحد الأدنى', kind: 'qty' },
];

const DETAIL_COLS: Array<{ key: string; label: string; kind: Kind }> = [
  { key: 'minPurchasePrice', label: 'أقل شراء', kind: 'money' },
  { key: 'avgPurchasePrice', label: 'متوسط شراء', kind: 'money' },
  { key: 'maxPurchasePrice', label: 'أعلى شراء', kind: 'money' },
  { key: 'minSalePrice', label: 'أقل بيع', kind: 'money' },
  { key: 'avgSalePrice', label: 'متوسط بيع', kind: 'money' },
  { key: 'maxSalePrice', label: 'أعلى بيع', kind: 'money' },
  { key: 'costCenterName', label: 'مركز التكلفة', kind: 'text' },
  { key: 'discountPercent', label: 'نسبة الخصم', kind: 'qty' },
  { key: 'discountAmount', label: 'الخصم', kind: 'money' },
  { key: 'taxPercent', label: 'نسبة الضريبة', kind: 'qty' },
  { key: 'taxAmount', label: 'الضريبة', kind: 'money' },
  { key: 'expiryDate', label: 'الصلاحية', kind: 'date' },
  { key: 'delegateName', label: 'المندوب', kind: 'text' },
];

const BASE_COLS = 16;

export function ItemMovementSheet({
  rows,
  summary,
  groupBy = 'none',
  title,
  filters = [],
}: {
  rows: Row[];
  summary?: unknown;
  groupBy?: 'none' | 'warehouse' | 'groups' | 'costCenter';
  title?: string;
  filters?: ReportFilterBadge[];
}) {
  const [details, setDetails] = useState(false);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const totals = summary && typeof summary === 'object' ? (summary as Record<string, unknown>) : {};
  const cards = [
    ['إجمالي الكميات الداخلة', qty(totals.totalInQty) || '0'],
    ['إجمالي الأسعار الداخلة', money(totals.totalInAmount) || '0.00'],
    ['إجمالي الكميات الخارجة', qty(totals.totalOutQty) || '0'],
    ['إجمالي الأسعار الخارجة', money(totals.totalOutAmount) || '0.00'],
    ['إجمالي الخصومات', money(totals.totalDiscount) || '0.00'],
    ['فرق الكميات', balanceLabel(totals.qtyDifference)],
  ] as const;

  const columns = useMemo(() => {
    const head: Array<{ key: string; kind: Kind }> = [
      { key: 'date', kind: 'date' },
      { key: 'sourceLabel', kind: 'text' },
      { key: 'sourceNumber', kind: 'text' },
      { key: 'itemName', kind: 'text' },
      { key: 'warehouseName', kind: 'text' },
      { key: 'partyName', kind: 'text' },
      { key: 'description', kind: 'text' },
      { key: 'unitName', kind: 'text' },
      { key: 'inQty', kind: 'qty' },
      { key: 'inPrice', kind: 'money' },
      { key: 'inTotal', kind: 'money' },
      { key: 'outQty', kind: 'qty' },
      { key: 'outPrice', kind: 'money' },
      { key: 'outTotal', kind: 'money' },
      { key: 'balance', kind: 'balance' },
      { key: 'averageCost', kind: 'money' },
      ...ITEM_ATTRS.map((col) => ({ key: col.key, kind: col.kind })),
      ...(details ? DETAIL_COLS.map((col) => ({ key: col.key, kind: col.kind })) : []),
    ];
    return head;
  }, [details]);

  const valuesByColumn = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const col of columns) {
      const values = new Set<string>();
      for (const row of rows) {
        const value = shown(row, col.key, col.kind);
        if (value) values.add(value);
      }
      map.set(col.key, [...values].sort((a, b) => a.localeCompare(b, 'ar')));
    }
    return map;
  }, [columns, rows]);

  const visibleRows = useMemo(() => {
    const active = Object.entries(picked).filter(([, selected]) => selected.length > 0);
    if (!active.length) return rows;
    return rows.filter((row) =>
      active.every(([key, selected]) => {
        const col = columns.find((item) => item.key === key);
        if (!col) return true;
        return selected.includes(shown(row, key, col.kind));
      })
    );
  }, [columns, picked, rows]);

  const span = BASE_COLS + ITEM_ATTRS.length + (details ? DETAIL_COLS.length : 0);
  let previousGroup = '';

  const openHeader = (key: string, event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    setOpenColumn((current) => (current === key ? null : key));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right">
        <h2 className="text-base font-bold text-slate-900">{title || 'تقرير حركة الأصناف'}</h2>
        {filters.length ? (
          <p className="mt-1 text-xs leading-6 text-slate-600">{filters.map((filter) => filter.label).join(' · ')}</p>
        ) : null}
      </div>

      <div className="flex justify-start no-print">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm ${
            details ? 'bg-[#1787B8] text-white' : 'bg-slate-100 text-slate-700'
          }`}
          onClick={() => setDetails((on) => !on)}
        >
          {details ? 'إخفاء بيانات الحركة' : 'إظهار بيانات الحركة'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full border-collapse text-xs text-slate-800">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <FilterHead label="التاريخ" columnKey="date" rowSpan={2} values={valuesByColumn.get('date') ?? []} picked={picked.date} onOpen={openHeader} />
              <FilterHead label="المصدر" columnKey="sourceLabel" rowSpan={2} values={valuesByColumn.get('sourceLabel') ?? []} picked={picked.sourceLabel} onOpen={openHeader} />
              <FilterHead label="رقمه" columnKey="sourceNumber" rowSpan={2} values={valuesByColumn.get('sourceNumber') ?? []} picked={picked.sourceNumber} onOpen={openHeader} />
              <FilterHead label="الصنف" columnKey="itemName" rowSpan={2} values={valuesByColumn.get('itemName') ?? []} picked={picked.itemName} onOpen={openHeader} />
              <FilterHead label="المخزن" columnKey="warehouseName" rowSpan={2} values={valuesByColumn.get('warehouseName') ?? []} picked={picked.warehouseName} onOpen={openHeader} />
              <FilterHead label="المورد أو العميل" columnKey="partyName" rowSpan={2} values={valuesByColumn.get('partyName') ?? []} picked={picked.partyName} onOpen={openHeader} />
              <FilterHead label="الشرح" columnKey="description" rowSpan={2} values={valuesByColumn.get('description') ?? []} picked={picked.description} onOpen={openHeader} />
              <FilterHead label="الوحدة" columnKey="unitName" rowSpan={2} values={valuesByColumn.get('unitName') ?? []} picked={picked.unitName} onOpen={openHeader} />
              <th colSpan={3} className="border-b border-s border-emerald-200 bg-emerald-50 px-2 py-2 text-center font-semibold text-emerald-800">المدخلات</th>
              <th colSpan={3} className="border-b border-s border-rose-200 bg-rose-50 px-2 py-2 text-center font-semibold text-rose-800">المخرجات</th>
              <FilterHead label="الرصيد" columnKey="balance" rowSpan={2} values={valuesByColumn.get('balance') ?? []} picked={picked.balance} onOpen={openHeader} />
              <FilterHead label="متوسط التكلفة" columnKey="averageCost" rowSpan={2} values={valuesByColumn.get('averageCost') ?? []} picked={picked.averageCost} onOpen={openHeader} />
              {ITEM_ATTRS.map((col) => (
                <FilterHead
                  key={col.key}
                  label={col.label}
                  columnKey={col.key}
                  rowSpan={2}
                  values={valuesByColumn.get(col.key) ?? []}
                  picked={picked[col.key]}
                  onOpen={openHeader}
                />
              ))}
              {details
                ? DETAIL_COLS.map((col) => (
                    <FilterHead
                      key={col.key}
                      label={col.label}
                      columnKey={col.key}
                      rowSpan={2}
                      values={valuesByColumn.get(col.key) ?? []}
                      picked={picked[col.key]}
                      onOpen={openHeader}
                    />
                  ))
                : null}
            </tr>
            <tr>
              <FilterHead label="الكمية" columnKey="inQty" values={valuesByColumn.get('inQty') ?? []} picked={picked.inQty} onOpen={openHeader} tone="in" />
              <FilterHead label="السعر" columnKey="inPrice" values={valuesByColumn.get('inPrice') ?? []} picked={picked.inPrice} onOpen={openHeader} tone="in" />
              <FilterHead label="الإجمالي" columnKey="inTotal" values={valuesByColumn.get('inTotal') ?? []} picked={picked.inTotal} onOpen={openHeader} tone="in" />
              <FilterHead label="الكمية" columnKey="outQty" values={valuesByColumn.get('outQty') ?? []} picked={picked.outQty} onOpen={openHeader} tone="out" />
              <FilterHead label="السعر" columnKey="outPrice" values={valuesByColumn.get('outPrice') ?? []} picked={picked.outPrice} onOpen={openHeader} tone="out" />
              <FilterHead label="الإجمالي" columnKey="outTotal" values={valuesByColumn.get('outTotal') ?? []} picked={picked.outTotal} onOpen={openHeader} tone="out" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => {
              const group =
                groupBy === 'none'
                  ? ''
                  : text(row, 'groupKey') || `${text(row, 'itemName')}|${text(row, 'warehouseName')}`;
              const showGroup = Boolean(group) && group !== previousGroup;
              previousGroup = group;
              const href = movementDocumentHref(text(row, 'sourceType'), text(row, 'sourceDocumentId'));
              const sourceNumber = text(row, 'sourceNumber');
              const sourceLabel = text(row, 'sourceLabel');
              return (
                <Fragment key={`${group}-${index}`}>
                  {showGroup ? (
                    <tr className="bg-[#F3F8FB]">
                      <td colSpan={span} className="border-b border-slate-200 px-3 py-2 text-right">
                        {groupBy === 'costCenter' ? (
                          <span className="font-semibold text-slate-900">
                            مركز التكلفة: {text(row, 'costCenterName') || 'بدون مركز تكلفة'}
                          </span>
                        ) : groupBy === 'groups' ? (
                          <span className="font-semibold text-slate-900">
                            المجموعة: {text(row, 'itemGroupName') || 'بدون مجموعة'}
                          </span>
                        ) : groupBy === 'warehouse' ? (
                          <span className="font-semibold text-slate-900">
                            المخزن: {text(row, 'warehouseName') || 'بدون مخزن'}
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-900">الصنف: {text(row, 'itemName') || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ) : null}
                  <tr className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">{dateLabel(row.date)}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">
                      <SourceLink href={href && !sourceNumber ? href : null} label={sourceLabel} />
                    </td>
                    <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">
                      <SourceLink href={href && sourceNumber ? href : null} label={sourceNumber} />
                    </td>
                    <td className="border-b border-slate-100 px-2 py-1.5 font-medium">{text(row, 'itemName')}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'warehouseName')}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'partyName')}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 max-w-[16rem]">{text(row, 'description')}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">{text(row, 'unitName')}</td>
                    <td className="border-b border-s border-emerald-50 px-2 py-1.5 text-center tabular-nums">{qty(row.inQty)}</td>
                    <td className="border-b border-emerald-50 px-2 py-1.5 text-center tabular-nums">{money(row.inPrice)}</td>
                    <td className="border-b border-emerald-50 px-2 py-1.5 text-center tabular-nums">{money(row.inTotal)}</td>
                    <td className="border-b border-s border-rose-50 px-2 py-1.5 text-center tabular-nums">{qty(row.outQty)}</td>
                    <td className="border-b border-rose-50 px-2 py-1.5 text-center tabular-nums">{money(row.outPrice)}</td>
                    <td className="border-b border-rose-50 px-2 py-1.5 text-center tabular-nums">{money(row.outTotal)}</td>
                    <td className="border-b border-s border-slate-100 px-2 py-1.5 text-center font-semibold tabular-nums">{balanceLabel(row.balance)}</td>
                    <td className="border-b border-s border-slate-100 px-2 py-1.5 text-center tabular-nums">
                      {row.averageCost == null ? '' : moneyAlways(row.averageCost)}
                    </td>
                    {ITEM_ATTRS.map((col) => (
                      <td key={col.key} className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">
                        {col.kind === 'qty' ? qty(row[col.key]) : text(row, col.key)}
                      </td>
                    ))}
                    {details
                      ? DETAIL_COLS.map((col) => (
                          <td key={col.key} className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap text-center">
                            {col.kind === 'date'
                              ? dateLabel(row[col.key])
                              : col.kind === 'money'
                                ? money(row[col.key])
                                : col.kind === 'qty'
                                  ? qty(row[col.key])
                                  : text(row, col.key)}
                          </td>
                        ))
                      : null}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {openColumn && anchor && (valuesByColumn.get(openColumn)?.length ?? 0) > 0 ? (
          <ColumnValueMenu
            label={columnLabel(openColumn)}
            values={valuesByColumn.get(openColumn) ?? []}
            selected={picked[openColumn] ?? []}
            sortDirection={null}
            anchor={anchor}
            onClose={() => setOpenColumn(null)}
            showSort={false}
            onSort={() => undefined}
            onSelected={(selected) =>
              setPicked((prev) => {
                const next = { ...prev };
                if (!selected.length) delete next[openColumn];
                else next[openColumn] = selected;
                return next;
              })
            }
            onClear={() => {
              setPicked((prev) => {
                const next = { ...prev };
                delete next[openColumn];
                return next;
              });
              setOpenColumn(null);
            }}
          />
        ) : null}
      </div>

      {num(totals.omittedRows) > 0 ? (
        <p className="text-xs text-slate-500">
          يظهر أول {rows.length.toLocaleString('ar-EG')} حركة. الإجماليات محسوبة على كل نتائج الفترة.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
            <div className="text-[11px] text-slate-500">{label}</div>
            <div className="text-sm font-bold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function columnLabel(key: string): string {
  const named = [...ITEM_ATTRS, ...DETAIL_COLS].find((col) => col.key === key);
  if (named) return named.label;
  const labels: Record<string, string> = {
    date: 'التاريخ',
    sourceLabel: 'المصدر',
    sourceNumber: 'رقمه',
    itemName: 'الصنف',
    warehouseName: 'المخزن',
    partyName: 'المورد أو العميل',
    description: 'الشرح',
    unitName: 'الوحدة',
    inQty: 'كمية المدخلات',
    inPrice: 'سعر المدخلات',
    inTotal: 'إجمالي المدخلات',
    outQty: 'كمية المخرجات',
    outPrice: 'سعر المخرجات',
    outTotal: 'إجمالي المخرجات',
    balance: 'الرصيد',
    averageCost: 'متوسط التكلفة',
  };
  return labels[key] ?? key;
}

function FilterHead({
  label,
  columnKey,
  values,
  picked,
  onOpen,
  rowSpan,
  tone,
}: {
  label: string;
  columnKey: string;
  values: string[];
  picked?: string[];
  onOpen: (key: string, event: MouseEvent<HTMLButtonElement>) => void;
  rowSpan?: number;
  tone?: 'in' | 'out';
}) {
  const active = (picked?.length ?? 0) > 0;
  const toneClass =
    tone === 'in'
      ? 'border-emerald-100 bg-emerald-50/70'
      : tone === 'out'
        ? 'border-rose-100 bg-rose-50/70'
        : 'border-slate-200';
  return (
    <th rowSpan={rowSpan} className={`border-b px-2 py-2 text-right font-semibold ${toneClass}`}>
      {values.length ? (
        <button
          type="button"
          className="inline-flex items-center gap-1"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => onOpen(columnKey, event)}
        >
          <span>{label}</span>
          <span className={`text-[10px] ${active ? 'text-amber-600' : 'text-slate-400'}`}>▾</span>
        </button>
      ) : (
        label
      )}
    </th>
  );
}

function SourceLink({ href, label }: { href: string | null; label: string }) {
  if (!label) return null;
  if (!href) return <>{label}</>;
  return (
    <Link href={href} className="font-medium text-[#0E78AA] underline decoration-[#0E78AA]/40 underline-offset-2 hover:text-[#0a5f86]">
      {label}
    </Link>
  );
}
