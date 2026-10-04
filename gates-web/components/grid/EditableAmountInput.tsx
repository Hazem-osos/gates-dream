'use client';

import { useState, type InputHTMLAttributes } from 'react';
import {
  evaluateMathExpression,
  formatGridNumber,
  plainGridNumber,
  sanitizeMathInput,
} from '@/lib/grid/evaluateMathExpression';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onValueChange: (value: number) => void;
};

function restingAmount(value: number): string {
  if (!value) return '';
  return formatGridNumber(value);
}

/** Free typing while focused. Grouping and fraction digits appear only after blur. */
export function EditableAmountInput({
  value,
  onValueChange,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      data-math-number=""
      autoComplete="off"
      value={draft ?? restingAmount(value)}
      onFocus={(event) => {
        setDraft(value ? plainGridNumber(value) : '');
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = sanitizeMathInput(event.target.value);
        setDraft(next);
        const trimmed = next.trim();
        if (!trimmed || trimmed === '.' || trimmed === '-' || trimmed === '-.') {
          onValueChange(0);
          return;
        }
        const parsed = evaluateMathExpression(trimmed);
        if (parsed != null) onValueChange(parsed);
      }}
      onBlur={(event) => {
        const trimmed = (draft ?? '').trim();
        if (draft != null) {
          if (!trimmed) onValueChange(0);
          else {
            const parsed = evaluateMathExpression(trimmed);
            if (parsed != null) onValueChange(parsed);
          }
        }
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}
