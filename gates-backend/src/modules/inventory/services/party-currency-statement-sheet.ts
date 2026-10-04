import { roundTo4 } from '../../../shared/utils/decimal-round';

export type PartyCurrencyInfo = {
  code: string;
  name: string;
};

export type PartyCurrencyLine = {
  partnerId: string | null;
  accountId: string | null;
  lineNumber?: number | null;
  debit: unknown;
  credit: unknown;
  debitBase: unknown;
  creditBase: unknown;
  currencyCode?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  invoiceNumber?: string | null;
  journalEntry: {
    id: string;
    date: Date;
    voucherNumber?: string | null;
    legacyGlNum?: string | null;
    sourceId?: string | null;
    sourceType?: string | null;
    sourceKind?: string | null;
    sourceNumber?: string | null;
    description?: string | null;
    descriptionAr?: string | null;
    currencyCode?: string | null;
  };
};

export type PartyCurrencyName = {
  name: string;
  code: string;
};

export function money4(value: unknown) {
  return roundTo4(Number(value || 0));
}

export function currencyColumnKeys(code: string) {
  return {
    debit: `debit_${code}`,
    credit: `credit_${code}`,
    balance: `balance_${code}`,
  };
}

export function lineCurrencyCode(line: PartyCurrencyLine, baseCode: string) {
  const code = String(line.currencyCode || line.journalEntry?.currencyCode || baseCode || '')
    .trim()
    .toUpperCase();
  return code || baseCode;
}

export function mergeAppearingCurrencies(
  currencies: PartyCurrencyInfo[],
  lines: PartyCurrencyLine[],
  baseCode: string,
  locked: boolean
) {
  if (locked) return currencies;
  const next = [...currencies];
  const known = new Set(next.map((row) => row.code));
  for (const line of lines) {
    const code = lineCurrencyCode(line, baseCode);
    if (code && !known.has(code)) {
      known.add(code);
      next.push({ code, name: code });
    }
  }
  return next;
}

function emptyBuckets(currencies: PartyCurrencyInfo[]) {
  const buckets: Record<string, number> = {};
  for (const currency of currencies) buckets[currency.code] = 0;
  return buckets;
}

function sidesForCurrency(line: PartyCurrencyLine, code: string, baseCode: string) {
  const lineCode = lineCurrencyCode(line, baseCode);
  if (lineCode !== code) return { debit: 0, credit: 0 };
  let debit = money4(line.debit);
  let credit = money4(line.credit);
  if (debit === 0 && credit === 0 && code === baseCode) {
    debit = money4(line.debitBase);
    credit = money4(line.creditBase);
  }
  return { debit, credit };
}

function applyLine(
  buckets: Record<string, number>,
  line: PartyCurrencyLine,
  currencies: PartyCurrencyInfo[],
  baseCode: string
) {
  for (const currency of currencies) {
    const sides = sidesForCurrency(line, currency.code, baseCode);
    buckets[currency.code] = money4(buckets[currency.code] + sides.debit - sides.credit);
  }
}

function hasAnyBalance(buckets: Record<string, number>) {
  return Object.values(buckets).some((value) => value !== 0);
}

function lineTouchesCurrencies(
  line: PartyCurrencyLine,
  currencies: PartyCurrencyInfo[],
  baseCode: string
) {
  return currencies.some((currency) => {
    const sides = sidesForCurrency(line, currency.code, baseCode);
    return sides.debit !== 0 || sides.credit !== 0;
  });
}

function amountFields(
  running: Record<string, number>,
  currencies: PartyCurrencyInfo[],
  movement?: Record<string, { debit: number; credit: number }>
) {
  const out: Record<string, number> = {};
  for (const currency of currencies) {
    const keys = currencyColumnKeys(currency.code);
    if (movement) {
      out[keys.debit] = movement[currency.code]?.debit || 0;
      out[keys.credit] = movement[currency.code]?.credit || 0;
    } else {
      out[keys.debit] = Math.max(running[currency.code] || 0, 0);
      out[keys.credit] = Math.max(-(running[currency.code] || 0), 0);
    }
    out[keys.balance] = running[currency.code] || 0;
  }
  return out;
}

/**
 * كشف حساب لكل طرف، بمدين ودائن ورصيد مستقل لكل عملة من عملات الشركة.
 * المبلغ يتحط في أعمدة عملة السطر نفسها، من غير تحويل لرصيد واحد ومن غير كاش الأرصدة.
 */
export function buildPartyCurrencySheet(input: {
  currencies: PartyCurrencyInfo[];
  baseCode: string;
  names: Map<string, PartyCurrencyName>;
  accountToParty: Map<string, string>;
  periodLines: PartyCurrencyLine[];
  priorLines: PartyCurrencyLine[];
  fromDate?: Date;
  selectedPartyId?: string;
  lockCurrency?: boolean;
}) {
  const { currencies, baseCode } = input;
  const partyOf = (line: PartyCurrencyLine) =>
    line.partnerId || input.accountToParty.get(line.accountId || '') || null;

  const openingByParty = new Map<string, Record<string, number>>();
  for (const line of input.priorLines) {
    const id = partyOf(line);
    if (!id) continue;
    const current = openingByParty.get(id) || emptyBuckets(currencies);
    applyLine(current, line, currencies, baseCode);
    openingByParty.set(id, current);
  }

  const grouped = new Map<string, PartyCurrencyLine[]>();
  for (const line of input.periodLines) {
    const id = partyOf(line);
    if (!id) continue;
    if (input.lockCurrency && !lineTouchesCurrencies(line, currencies, baseCode)) continue;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)!.push(line);
  }
  for (const id of openingByParty.keys()) {
    if (!grouped.has(id)) grouped.set(id, []);
  }

  const partyIds = Array.from(grouped.keys()).sort((a, b) =>
    String(input.names.get(a)?.name || '').localeCompare(String(input.names.get(b)?.name || ''), 'ar')
  );

  const rows: Record<string, unknown>[] = [];
  const totalDebit = emptyBuckets(currencies);
  const totalCredit = emptyBuckets(currencies);
  const ending = emptyBuckets(currencies);

  for (const id of partyIds) {
    const opening = openingByParty.get(id) || emptyBuckets(currencies);
    const running = { ...opening };
    const party = input.names.get(id);
    const partyName = party?.name || '';
    const partyCode = party?.code || '';
    const movements = (grouped.get(id) || []).slice().sort((a, b) => {
      const byDate = new Date(a.journalEntry.date).getTime() - new Date(b.journalEntry.date).getTime();
      if (byDate) return byDate;
      return (a.lineNumber || 0) - (b.lineNumber || 0);
    });

    if (input.fromDate && (hasAnyBalance(opening) || input.selectedPartyId)) {
      rows.push({
        rowKind: 'opening',
        date: input.fromDate,
        documentNumber: '',
        description: 'رصيد افتتاحي',
        partyName,
        partyCode,
        ...amountFields(opening, currencies),
      });
    }

    for (const line of movements) {
      const movement: Record<string, { debit: number; credit: number }> = {};
      for (const currency of currencies) {
        const sides = sidesForCurrency(line, currency.code, baseCode);
        movement[currency.code] = sides;
        running[currency.code] = money4(running[currency.code] + sides.debit - sides.credit);
        totalDebit[currency.code] = money4(totalDebit[currency.code] + sides.debit);
        totalCredit[currency.code] = money4(totalCredit[currency.code] + sides.credit);
      }
      const journal = line.journalEntry;
      rows.push({
        rowKind: 'movement',
        date: journal.date,
        documentNumber:
          line.invoiceNumber || journal.sourceNumber || journal.voucherNumber || journal.legacyGlNum || '',
        journalEntryId: journal.id,
        sourceId: journal.sourceId,
        sourceType: journal.sourceType,
        sourceKind: journal.sourceKind,
        description:
          line.descriptionAr || line.description || journal.descriptionAr || journal.description || '',
        partyName,
        partyCode,
        ...amountFields(running, currencies, movement),
      });
    }

    for (const currency of currencies) {
      ending[currency.code] = money4(ending[currency.code] + running[currency.code]);
    }
  }

  return {
    rows,
    summary: {
      currencies: currencies.map((currency) => ({
        code: currency.code,
        name: currency.name,
        debit: totalDebit[currency.code] || 0,
        credit: totalCredit[currency.code] || 0,
        balance: ending[currency.code] || 0,
      })),
    },
  };
}
