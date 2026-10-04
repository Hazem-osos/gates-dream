'use client';

import { formatReportMoney } from '@/lib/reportEngine/reportFormatters';

type PartyCard = {
  name?: string;
  code?: string;
  nationality?: string;
  country?: string;
  city?: string;
  area?: string;
  street?: string;
  phone?: string;
  fax?: string;
  mobile?: string;
  website?: string;
  creditLimitAmount?: number;
};

function text(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || '—';
}

function money(value: unknown, currencyLabel?: string): string {
  return formatReportMoney(value, currencyLabel || 'ج.م');
}

function readParty(summary: unknown): PartyCard | null {
  if (!summary || typeof summary !== 'object') return null;
  const party = (summary as { party?: unknown }).party;
  if (!party || typeof party !== 'object') return null;
  return party as PartyCard;
}

function readAmount(summary: unknown, key: string): number | null {
  if (!summary || typeof summary !== 'object') return null;
  const value = (summary as Record<string, unknown>)[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <div className="text-[11px] font-medium leading-4 text-slate-500">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold leading-5 text-slate-800">{value}</div>
    </div>
  );
}

export function CustomerAccountReportBanner({
  summary,
  currencyLabel,
}: {
  summary?: unknown;
  currencyLabel?: string;
}) {
  const party = readParty(summary);
  const figures = [
    ['إجمالي المبالغ الدائنة', readAmount(summary, 'totalCredit')],
    ['إجمالي المبالغ المدينة', readAmount(summary, 'totalDebit')],
    ['الرصيد', readAmount(summary, 'closingBalance')],
    ['الأوراق المالية الغير محصلة', readAmount(summary, 'uncollectedAmount')],
    ['الحد الائتماني', readAmount(summary, 'creditLimitAmount')],
    ['رصيد متبقي للحد الائتماني', readAmount(summary, 'availableCreditAmount')],
  ].filter((row): row is [string, number] => row[1] != null);

  if (!party && figures.length === 0) return null;

  return (
    <div className={party ? 'mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]' : 'mb-4 flex justify-start'}>
      {party ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
            {text(party.name)}
            {party.code ? <span className="mr-2 font-medium text-slate-500">{party.code}</span> : null}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3">
            <Field label="الجنسية" value={text(party.nationality)} />
            <Field label="الحد الائتماني" value={money(party.creditLimitAmount, currencyLabel)} />
            <Field label="نسبة خصم العمل" value="—" />
            <Field label="الدولة" value={text(party.country)} />
            <Field label="المدينة" value={text(party.city)} />
            <Field label="المنطقة" value={text(party.area)} />
            <Field label="الشارع" value={text(party.street)} />
            <Field label="الهاتف" value={text(party.phone)} />
            <Field label="الفاكس" value={text(party.fax)} />
            <Field label="الموبايل" value={text(party.mobile)} />
            <Field label="الموقع" value={text(party.website)} />
          </div>
        </section>
      ) : null}
      {figures.length ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {figures.map(([label, value], index) => (
            <div
              key={label}
              className={`flex items-center justify-between gap-3 px-3 py-2 ${
                index < figures.length - 1 ? 'border-b border-slate-100' : ''
              } ${label === 'الرصيد' ? 'bg-sky-50' : ''}`}
            >
              <span className="text-xs font-medium text-slate-600">{label}</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {money(value, currencyLabel)}
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
