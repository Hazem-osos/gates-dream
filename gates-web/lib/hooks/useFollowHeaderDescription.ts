'use client';

import { useEffect, useRef } from 'react';

function sameText(a: string | undefined, b: string | undefined) {
  return (a ?? '').trim() === (b ?? '').trim();
}

/**
 * Header شرح / بيان fills every line that is still empty or still matches
 * the previous header value. Rows the user edited stay as-is.
 */
export function useFollowHeaderDescription<T>(options: {
  headerDescription: string | undefined;
  lines: T[];
  onChange: (lines: T[]) => void;
  getDescription: (line: T) => string | undefined;
  setDescription: (line: T, value: string) => T;
  disabled?: boolean;
}) {
  const { headerDescription, lines, onChange, getDescription, setDescription, disabled } = options;
  const prevHeaderRef = useRef('');
  const linesRef = useRef(lines);
  const onChangeRef = useRef(onChange);
  const getRef = useRef(getDescription);
  const setRef = useRef(setDescription);
  linesRef.current = lines;
  onChangeRef.current = onChange;
  getRef.current = getDescription;
  setRef.current = setDescription;

  useEffect(() => {
    if (disabled) return;
    const header = (headerDescription ?? '').trim();
    const prev = prevHeaderRef.current;
    const currentLines = linesRef.current;
    if (!currentLines.length) {
      prevHeaderRef.current = header;
      return;
    }
    let changed = false;
    const next = currentLines.map((line) => {
      const current = (getRef.current(line) ?? '').trim();
      const followsHeader = !current || sameText(current, prev);
      if (!followsHeader || sameText(current, header)) return line;
      changed = true;
      return setRef.current(line, header);
    });
    prevHeaderRef.current = header;
    if (changed) onChangeRef.current(next);
  }, [disabled, headerDescription, lines.length]);
}

export function seedLineDescription(headerDescription: string | undefined, current?: string) {
  const existing = (current ?? '').trim();
  if (existing) return existing;
  return (headerDescription ?? '').trim();
}
