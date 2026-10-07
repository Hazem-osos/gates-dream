'use client';

type Row = Record<string, unknown>;

function amount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function money(value: number): string {
  if (!value) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: number): string {
  if (!value) return '—';
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

export function BudgetSheet({
  rows,
  compareRows = [],
  currentYearLabel,
  compareYearLabel,
  entity = 'account',
}: {
  rows: Row[];
  compareRows?: Row[];
  currentYearLabel?: string;
  compareYearLabel?: string;
  entity?: 'account' | 'costCenter';
}) {
  const showCompare = Boolean(compareYearLabel);
  const groups = [
    { label: entity === 'costCenter' ? 'مركز التكلفة' : 'الحساب', span: 5 },
    { label: 'الموازنة', span: 2 },
    { label: 'الرصيد السابق', span: 2 },
    { label: currentYearLabel || 'رصيد آخر الفترة', span: 2 },
    ...(showCompare ? [{ label: compareYearLabel || 'سنة المقارنة', span: 2 }] : []),
    { label: 'المتبقي والانحراف', span: 6 },
  ];
  const compareByCode = new Map(compareRows.map((row) => [String(row.code ?? row.accountId ?? ''), row]));
  const totals = rows.reduce(
    (sum: {
      budgetDebit: number;
      budgetCredit: number;
      openingDebit: number;
      openingCredit: number;
      endingDebit: number;
      endingCredit: number;
      remaining: number;
      negativeVariance: number;
    }, row) => {
      sum.budgetDebit += amount(row.budgetDebit);
      sum.budgetCredit += amount(row.budgetCredit);
      sum.openingDebit += amount(row.openingDebit);
      sum.openingCredit += amount(row.openingCredit);
      sum.endingDebit += amount(row.endingDebit);
      sum.endingCredit += amount(row.endingCredit);
      sum.remaining += amount(row.remaining);
      sum.negativeVariance += amount(row.negativeVariance);
      return sum;
    },
    {
      budgetDebit: 0,
      budgetCredit: 0,
      openingDebit: 0,
      openingCredit: 0,
      endingDebit: 0,
      endingCredit: 0,
      remaining: 0,
      negativeVariance: 0,
    }
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div dir="rtl" className="report-scroll-viewport erp-scroll-x overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-sm" dir="rtl">
          <thead>
            <tr className="bg-[#0E4C6E] text-white">
              {groups.map((group) => (
                <th key={group.label} colSpan={group.span} className="border-e border-white/10 px-2 py-2 font-medium">
                  {group.label}
                </th>
              ))}
            </tr>
            <tr className="bg-[#1787B8] text-xs text-white">
              {[
                ...(entity === 'costCenter'
                  ? ['مسار مركز التكلفة', 'رمز مركز التكلفة', 'اسم مركز التكلفة']
                  : ['مسار الحساب', 'رمز الحساب', 'اسم الحساب']),
                'اسم التصنيف',
                'درجة الموازنة',
                'مدين',
                'دائن',
                'مدين',
                'دائن',
                'مدين',
                'دائن',
                ...(showCompare ? ['مدين', 'دائن'] : []),
                'رصيد متبقي للموازنة',
                'انحراف سلبي',
                'نسبة المتبقي',
                'نسبة الانحراف',
                'نسبة الانحراف للمركز',
                'نسبة الانحراف الكلي',
              ].map(
                (label, index) => (
                  <th key={`${label}-${index}`} className="whitespace-nowrap border-e border-white/10 px-2 py-2 font-normal">
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const over = amount(row.negativeVariance) > 0;
              return (
                <tr key={String(row.accountId ?? index)} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="max-w-64 truncate border-b border-slate-100 px-2 py-2 text-slate-500">{String(row.accountPath ?? '')}</td>
                  <td className="border-b border-slate-100 px-2 py-2 tabular-nums text-slate-600">{String(row.code ?? '')}</td>
                  <td className="border-b border-slate-100 px-2 py-2 font-medium text-slate-800">{String(row.account ?? '')}</td>
                  <td className="border-b border-slate-100 px-2 py-2 text-slate-600">{String(row.classification ?? '')}</td>
                  <td className="border-b border-e border-slate-100 px-2 py-2 text-center">{String(row.budgetLevel ?? '')}</td>
                  <Money value={amount(row.budgetDebit)} />
                  <Money value={amount(row.budgetCredit)} edge />
                  <Money value={amount(row.openingDebit)} />
                  <Money value={amount(row.openingCredit)} edge />
                  <Money value={amount(row.endingDebit)} />
                  <Money value={amount(row.endingCredit)} edge />
                  {showCompare ? (
                    <>
                      <Money value={amount(compareByCode.get(String(row.code ?? row.accountId ?? ''))?.endingDebit)} />
                      <Money value={amount(compareByCode.get(String(row.code ?? row.accountId ?? ''))?.endingCredit)} edge />
                    </>
                  ) : null}
                  <Money value={amount(row.remaining)} tone={amount(row.remaining) < 0 ? 'bad' : 'good'} />
                  <Money value={amount(row.negativeVariance)} tone={over ? 'bad' : undefined} />
                  <td className="border-b border-slate-100 px-2 py-2 text-center tabular-nums">{percent(amount(row.remainingPercent))}</td>
                  <td className={`border-b border-slate-100 px-2 py-2 text-center tabular-nums ${over ? 'text-rose-700' : ''}`}>
                    {percent(amount(row.variancePercent))}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2 text-center tabular-nums">{percent(amount(row.centerVariancePercent))}</td>
                  <td className="border-b border-slate-100 px-2 py-2 text-center tabular-nums">{percent(amount(row.totalVariancePercent))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#0E4C6E] font-semibold text-white">
              <td className="px-2 py-3" colSpan={5}>المجموع</td>
              <td className="px-2 py-3 text-center tabular-nums">{money(totals.budgetDebit)}</td>
              <td className="px-2 py-3 text-center tabular-nums">{money(totals.budgetCredit)}</td>
              <td className="px-2 py-3 text-center tabular-nums">{money(totals.openingDebit)}</td>
              <td className="px-2 py-3 text-center tabular-nums">{money(totals.openingCredit)}</td>
              <td className="px-2 py-3 text-center tabular-nums">{money(totals.endingDebit)}</td>
              <td className="px-2 py-3 text-center tabular-nums">{money(totals.endingCredit)}</td>
              <td className="px-2 py-3 text-center tabular-nums">{money(totals.remaining)}</td>
              <td className="px-2 py-3 text-center tabular-nums">{money(totals.negativeVariance)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Money({ value, edge, tone }: { value: number; edge?: boolean; tone?: 'good' | 'bad' }) {
  const color = tone === 'bad' ? 'text-rose-700' : tone === 'good' ? 'text-teal-800' : 'text-slate-700';
  return (
    <td className={`border-b border-slate-100 px-2 py-2 text-center tabular-nums ${color} ${edge ? 'border-e' : ''}`}>
      {money(value)}
    </td>
  );
}
