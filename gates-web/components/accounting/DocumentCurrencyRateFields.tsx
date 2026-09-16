'use client';

import { erpInputClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { ExchangeRateInput } from '@/components/accounting/ExchangeRateInput';
import { useFollowCurrencyCardRate } from '@/lib/hooks/useFollowCurrencyCardRate';
import {
  formatBaseAmount,
  isFxRateLocked,
  rateForCurrency,
  toBaseAmount,
} from '@/lib/accounting/fx-base';

export type DocumentCurrencyOption = {
  id: string;
  code: string;
  arabicName?: string;
  englishName?: string;
  exchangeRate?: number | string | null;
};

type Props = {
  currencies: DocumentCurrencyOption[];
  currencyId: string;
  exchangeRate: number;
  companyBaseCode: string;
  disabled?: boolean;
  onCurrencyIdChange: (currencyId: string, nextRate: number, code: string) => void;
  onExchangeRateChange: (rate: number) => void;
  amount?: number;
  showEquivalent?: boolean;
  showRate?: boolean;
  selectClassName?: string;
};

export function DocumentCurrencyRateFields({
  currencies,
  currencyId,
  exchangeRate,
  companyBaseCode,
  disabled,
  onCurrencyIdChange,
  onExchangeRateChange,
  amount,
  showEquivalent,
  showRate = true,
  selectClassName,
}: Props) {
  const selected = currencies.find((c) => c.id === currencyId);
  const locked = isFxRateLocked(selected?.code, companyBaseCode);
  const fieldClass = selectClassName ?? erpInputClass;
  const shownRate = locked ? 1 : exchangeRate;
  const catalogRate = rateForCurrency(selected?.code, companyBaseCode, selected?.exchangeRate);
  useFollowCurrencyCardRate(catalogRate, shownRate, !disabled && !locked, onExchangeRateChange);

  return (
    <>
      <div>
        <label className={erpLabelClass}>العملة</label>
        <select
          className={fieldClass}
          disabled={disabled}
          value={currencyId}
          onChange={(event) => {
            const next = currencies.find((c) => c.id === event.target.value);
            onCurrencyIdChange(
              event.target.value,
              rateForCurrency(next?.code, companyBaseCode, next?.exchangeRate),
              next?.code || ''
            );
          }}
        >
          {currencies.map((currency) => (
            <option key={currency.id} value={currency.id}>
              {currency.arabicName || currency.englishName || currency.code}
            </option>
          ))}
        </select>
      </div>
      {showRate ? (
      <div>
        <label className={erpLabelClass}>سعر الصرف</label>
        <ExchangeRateInput
          className={fieldClass}
          disabled={disabled || locked}
          currencyId={currencyId}
          currencyCode={selected?.code}
          companyBaseCode={companyBaseCode}
          value={shownRate}
          onChange={onExchangeRateChange}
        />
      </div>
      ) : null}
      {showEquivalent && amount != null && amount > 0 ? (
        <div>
          <label className={erpLabelClass}>المعادل</label>
          <input
            className={fieldClass}
            readOnly
            tabIndex={-1}
            value={formatBaseAmount(toBaseAmount(amount, shownRate))}
          />
        </div>
      ) : null}
    </>
  );
}
