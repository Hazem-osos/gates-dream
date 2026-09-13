'use client';

import { useEffect } from 'react';
import { useMathInput } from '@/lib/grid/useMathInput';

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'onBlur'
> & {
  value?: string | number;
  onValueCommit: (value: number) => void;
  fractionDigits?: number;
};

/** Numeric grid cell with inline math on Enter / blur. */
export function TableNumberInput({
  value,
  onValueCommit,
  fractionDigits = 2,
  className,
  onKeyDown: userKeyDown,
  ...rest
}: Props) {
  const math = useMathInput({
    fractionDigits,
    onCommit: onValueCommit,
    initialDisplay: value != null && value !== '' ? String(value) : '',
  });

  useEffect(() => {
    math.syncFromExternal(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync display when RHF value changes externally
  }, [value, fractionDigits]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={className}
      value={math.display}
      onChange={(e) => math.setDisplay(e.target.value)}
      onBlur={math.onBlur}
      onKeyDown={(e) => {
        math.onKeyDown(e);
        userKeyDown?.(e);
      }}
    />
  );
}
