'use client';

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import {
  evaluateMathExpression,
  formatGridNumber,
  isZeroNumberDisplay,
  plainGridNumber,
  sanitizeMathInput,
} from '@/lib/grid/evaluateMathExpression';

type Options = {
  fractionDigits?: number;
  onCommit: (value: number) => void;
  initialDisplay?: string;
};

function restingDisplay(raw: string): string {
  return isZeroNumberDisplay(raw) ? '' : raw;
}

/** Local display state + commit evaluated number on Enter / blur. */
export function useMathInput({ fractionDigits = 2, onCommit, initialDisplay = '' }: Options) {
  const [display, setDisplayState] = useState(() => restingDisplay(initialDisplay));
  const focusedRef = useRef(false);
  const lastGoodRef = useRef(restingDisplay(initialDisplay));

  const commit = useCallback(
    (raw?: string) => {
      const source = (raw ?? display).trim();
      if (!source) {
        if (!focusedRef.current) setDisplayState(lastGoodRef.current);
        return;
      }
      const evaluated = evaluateMathExpression(source);
      if (evaluated == null) {
        if (!focusedRef.current) setDisplayState(lastGoodRef.current);
        return;
      }
      const formatted = evaluated === 0 ? '' : formatGridNumber(evaluated, fractionDigits);
      lastGoodRef.current = formatted;
      if (!focusedRef.current) setDisplayState(formatted);
      onCommit(evaluated);
    },
    [display, fractionDigits, onCommit]
  );

  const onChange = useCallback((next: string) => {
    setDisplayState(sanitizeMathInput(next));
  }, []);

  const onFocus = useCallback(() => {
    focusedRef.current = true;
    setDisplayState((current) => {
      const n = evaluateMathExpression(current);
      if (n == null) return current;
      if (n === 0) return '';
      return plainGridNumber(n);
    });
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
      setDisplayState('');
      return;
    }
    const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(n)) return;
    if (n === 0) {
      lastGoodRef.current = '';
      setDisplayState('');
      return;
    }
    const formatted = formatGridNumber(n, fractionDigits);
    lastGoodRef.current = formatted;
    setDisplayState(formatted);
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
