'use client';

import { useCallback, useState, type KeyboardEvent } from 'react';
import {
  evaluateMathExpression,
  formatGridNumber,
  sanitizeMathInput,
} from '@/lib/grid/evaluateMathExpression';

type Options = {
  fractionDigits?: number;
  onCommit: (value: number) => void;
  initialDisplay?: string;
};

/** Local display state + commit evaluated number on Enter / blur. */
export function useMathInput({ fractionDigits = 2, onCommit, initialDisplay = '' }: Options) {
  const [display, setDisplay] = useState(initialDisplay);

  const commit = useCallback(
    (raw?: string) => {
      const source = (raw ?? display).trim();
      if (!source) return;
      const evaluated = evaluateMathExpression(source);
      if (evaluated == null) return;
      const formatted = formatGridNumber(evaluated, fractionDigits);
      setDisplay(formatted);
      onCommit(evaluated);
    },
    [display, fractionDigits, onCommit]
  );

  const onChange = useCallback((next: string) => {
    setDisplay(sanitizeMathInput(next));
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
    },
    [commit]
  );

  const syncFromExternal = useCallback((value: string | number | undefined) => {
    if (value === undefined || value === null || value === '') {
      setDisplay('');
      return;
    }
    const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(n)) return;
    setDisplay(formatGridNumber(n, fractionDigits));
  }, [fractionDigits]);

  return { display, setDisplay: onChange, onBlur: () => commit(), onKeyDown, commit, syncFromExternal };
}
