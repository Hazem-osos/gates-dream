'use client';

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
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
  const focusedRef = useRef(false);
  const lastGoodRef = useRef(initialDisplay);

  const commit = useCallback(
    (raw?: string) => {
      const source = (raw ?? display).trim();
      if (!source) {
        setDisplay(lastGoodRef.current);
        return;
      }
      const evaluated = evaluateMathExpression(source);
      if (evaluated == null) {
        setDisplay(lastGoodRef.current);
        return;
      }
      const formatted = formatGridNumber(evaluated, fractionDigits);
      lastGoodRef.current = formatted;
      setDisplay(formatted);
      onCommit(evaluated);
    },
    [display, fractionDigits, onCommit]
  );

  const onChange = useCallback((next: string) => {
    setDisplay(sanitizeMathInput(next));
  }, []);

  const onFocus = useCallback(() => {
    focusedRef.current = true;
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
    if (focusedRef.current) return;
    if (value === undefined || value === null || value === '') {
      lastGoodRef.current = '';
      setDisplay('');
      return;
    }
    const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(n)) return;
    const formatted = formatGridNumber(n, fractionDigits);
    lastGoodRef.current = formatted;
    setDisplay(formatted);
  }, [fractionDigits]);

  return {
    display,
    setDisplay: onChange,
    onFocus,
    onBlur: () => {
      focusedRef.current = false;
      commit();
    },
    onKeyDown,
    commit,
    syncFromExternal,
  };
}
