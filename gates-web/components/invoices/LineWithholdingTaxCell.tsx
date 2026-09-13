'use client';

import { useState } from 'react';

const PRESETS = [
  { rate: 0, label: '0% — معفى / لا ينطبق' },
  { rate: 1, label: '1% — توريدات وسلع' },
  { rate: 0.5, label: '0.5% — مقاولات وتوريدات عمومية' },
  { rate: 3, label: '3% — خدمات واستشارات' },
] as const;

type Props = {
  rate?: number;
  amount?: number;
  lineAfterDiscount: number;
  onChange: (patch: { withholdingTaxRate: number; withholdingTaxAmount: number }) => void;
  className?: string;
};

export function LineWithholdingTaxCell({
  rate = 0,
  amount = 0,
  lineAfterDiscount,
  onChange,
  className,
}: Props) {
  const known = PRESETS.some((p) => p.rate === rate);
  const [custom, setCustom] = useState(!known && rate > 0);

  const commit = (nextRate: number) => {
    const wht = nextRate > 0 ? (lineAfterDiscount * nextRate) / 100 : 0;
    onChange({ withholdingTaxRate: nextRate, withholdingTaxAmount: Number(wht.toFixed(4)) });
  };

  return (
    <div className={className}>
      <select
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
        value={custom ? 'custom' : String(rate)}
        onChange={(e) => {
          if (e.target.value === 'custom') {
            setCustom(true);
            return;
          }
          setCustom(false);
          commit(Number(e.target.value));
        }}
      >
        {PRESETS.map((p) => (
          <option key={p.rate} value={String(p.rate)}>
            {p.label}
          </option>
        ))}
        <option value="custom">مخصص</option>
      </select>
      {custom ? (
        <input
          type="number"
          min={0}
          step={0.1}
          className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs"
          value={rate || ''}
          placeholder="%"
          onChange={(e) => commit(Number(e.target.value) || 0)}
        />
      ) : null}
      {amount > 0 ? (
        <p className="mt-0.5 text-left font-mono text-[10px] text-slate-500">
          {amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
        </p>
      ) : null}
    </div>
  );
}
