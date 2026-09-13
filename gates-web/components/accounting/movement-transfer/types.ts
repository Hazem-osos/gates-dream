export type MovementRow = {
  id: string;
  journalEntryId?: string | null;
  documentNumber: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
};

export type NamedLedgerParty = {
  id?: string;
  code?: string;
  arabicName?: string;
};

export type MovementPreviewPayload = {
  currentBalance?: number;
  account?: NamedLedgerParty;
  costCenter?: NamedLedgerParty;
  summary?: { balance?: number; totalDebit?: number; totalCredit?: number };
  movements?: Array<{
    id: string;
    journalEntryId?: string | null;
    documentNumber?: string | null;
    date: string | Date;
    description?: string | null;
    debit?: number;
    credit?: number;
  }>;
};

export function partyLabel(party?: NamedLedgerParty | null, fallback = '—') {
  if (!party) return fallback;
  if (party.code && party.arabicName) return `${party.code} - ${party.arabicName}`;
  return party.arabicName || party.code || fallback;
}

export function money(value: number) {
  return `${value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

export function movementAmount(row: Pick<MovementRow, 'debit' | 'credit'>) {
  return Math.abs(Number(row.debit) || 0) + Math.abs(Number(row.credit) || 0);
}

export function mapPreviewMovements(payload?: MovementPreviewPayload | null): MovementRow[] {
  return (payload?.movements ?? []).map((row) => ({
    id: row.id,
    journalEntryId: row.journalEntryId ?? null,
    documentNumber: row.documentNumber || row.id.slice(0, 8),
    date: typeof row.date === 'string' ? row.date.slice(0, 10) : new Date(row.date).toISOString().slice(0, 10),
    description: row.description || '',
    debit: Number(row.debit) || 0,
    credit: Number(row.credit) || 0,
  }));
}
