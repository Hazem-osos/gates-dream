'use client';

import type { InputHTMLAttributes } from 'react';
import { isFxRateLocked, normalizeFxRate } from '@/lib/accounting/fx-base';
import {
  persistableTypedRate,
  useRememberCurrencyRate,
} from '@/lib/hooks/useRememberCurrencyRate';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  currencyId?: string | null;
  currencyCode?: string | null;
  companyBaseCode?: string | null;
  value: number | string | null | undefined;
  onChange: (rate: number) => void;
};

export function ExchangeRateInput({
  currencyId,
  currencyCode,
  companyBaseCode,
  value,
  onChange,
  disabled,
  onBlur,
  min = '0',
  step = '0.0001',
  ...rest
}: Props) {
  const remember = useRememberCurrencyRate();
  const locked = isFxRateLocked(currencyCode, companyBaseCode);
  const shown = locked ? 1 : value ?? '';

  const persist = (raw: string | number, flush: boolean) => {
    const rate = persistableTypedRate(raw);
    if (rate == null) return;
    remember({ currencyId, currencyCode, companyBaseCode, rate, flush });
  };

  return (
    <input
      {...rest}
      type="number"
      min={min}
      step={step}
      disabled={disabled || locked}
      value={shown}
      onChange={(event) => {
        const raw = event.target.value;
        const next = persistableTypedRate(raw) ?? normalizeFxRate(raw);
        onChange(next);
        persist(raw, false);
        rest.onChange?.(event);
      }}
      onBlur={(event) => {
        persist(event.target.value, true);
        onBlur?.(event);
        rest.onBlur?.(event);
      }}
    />
  );
}
