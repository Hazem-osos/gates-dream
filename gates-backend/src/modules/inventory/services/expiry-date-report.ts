import { roundTo4 } from '../../../shared/utils/decimal-round';

export function parseBatchAllocations(value: unknown): Array<{
  batchNumber: string;
  quantity: number;
  expiryDate: Date;
}> {
  if (!Array.isArray(value)) return [];
  const lots = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    if (!record.expiryDate) continue;
    const expiryDate = new Date(String(record.expiryDate));
    if (Number.isNaN(expiryDate.getTime())) continue;
    const quantity = Number(record.qty ?? record.quantity ?? 0);
    lots.push({
      batchNumber: typeof record.batchNumber === 'string' ? record.batchNumber : '',
      quantity: Number.isFinite(quantity) ? quantity : 0,
      expiryDate,
    });
  }
  return lots;
}

export type ExpirySourceLot = {
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  batchNumber: string;
  expiryDate: Date;
  quantity: number;
  /** Inbound lots increase the batch balance. Outbound lots consume it. */
  side: 'in' | 'out';
  sourceLabel: string;
  sourceNumber: string;
  sourceDocumentId?: string;
  sourceType?: string;
  partyName: string;
  unitName: string;
  itemGroupName: string;
};

export type ExpirySheetRow = {
  itemName: string;
  warehouseName: string;
  batchNumber: string;
  expiryDate: string;
  daysLeft: number;
  status: string;
  quantity: number;
  sourceLabel: string;
  sourceNumber: string;
  sourceDocumentId: string;
  sourceType: string;
  partyName: string;
  unitName: string;
  itemGroupName: string;
  groupKey: string;
};

export type ExpiryReportSummary = {
  lotCount: number;
  onHandLots: number;
  expiredLots: number;
  soonLots: number;
  quarterLots: number;
  consumedLots: number;
};

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysUntilExpiry(expiry: Date, today: Date): number {
  return Math.round((utcDay(expiry) - utcDay(today)) / 86_400_000);
}

function statusFor(daysLeft: number, quantity: number): string {
  if (quantity <= 0) return 'صُرف';
  if (daysLeft < 0) return 'منتهي';
  if (daysLeft <= 30) return 'خلال 30 يوم';
  if (daysLeft <= 90) return 'خلال 90 يوم';
  return 'ساري';
}

const STATUS_ORDER = ['منتهي', 'خلال 30 يوم', 'خلال 90 يوم', 'ساري', 'صُرف'];

function inRange(date: Date, fromDate?: Date, toDate?: Date): boolean {
  if (fromDate && date.getTime() < fromDate.getTime()) return false;
  if (toDate && date.getTime() > toDate.getTime()) return false;
  return true;
}

/**
 * Nets each batch (item + warehouse + batch + expiry day) and keeps every lot
 * inside the expiry window, including consumed ones, so a filled window is not blank.
 */
export function buildExpiryReport(
  lots: ExpirySourceLot[],
  options: { today?: Date; fromDate?: Date; toDate?: Date } = {}
): { rows: ExpirySheetRow[]; summary: ExpiryReportSummary } {
  const today = options.today ?? new Date();
  const groups = new Map<
    string,
    {
      lot: ExpirySourceLot;
      remaining: number;
      sources: Set<string>;
      parties: Set<string>;
      sourceDocumentId: string;
      sourceType: string;
      sourceMixed: boolean;
    }
  >();

  for (const lot of lots) {
    if (Number.isNaN(lot.expiryDate.getTime())) continue;
    if (!inRange(lot.expiryDate, options.fromDate, options.toDate)) continue;
    const day = lot.expiryDate.toISOString().slice(0, 10);
    const key = `${lot.itemId}|${lot.warehouseId}|${lot.batchNumber}|${day}`;
    const signed = lot.side === 'out' ? -Math.abs(lot.quantity) : Math.abs(lot.quantity);
    const current = groups.get(key);
    const source = [lot.sourceLabel, lot.sourceNumber].filter(Boolean).join(' ');
    if (!current) {
      groups.set(key, {
        lot,
        remaining: signed,
        sources: new Set(source ? [source] : []),
        parties: new Set(lot.partyName ? [lot.partyName] : []),
        sourceDocumentId: lot.sourceDocumentId || '',
        sourceType: lot.sourceType || '',
        sourceMixed: false,
      });
      continue;
    }
    current.remaining = roundTo4(current.remaining + signed);
    if (source) current.sources.add(source);
    if (lot.partyName) current.parties.add(lot.partyName);
    if (lot.sourceDocumentId && current.sourceDocumentId && lot.sourceDocumentId !== current.sourceDocumentId) {
      current.sourceMixed = true;
    } else if (lot.sourceDocumentId && !current.sourceDocumentId) {
      current.sourceDocumentId = lot.sourceDocumentId;
      current.sourceType = lot.sourceType || '';
    }
    if (lot.expiryDate.getTime() < current.lot.expiryDate.getTime()) current.lot = lot;
  }

  const rows = [...groups.entries()].map(([groupKey, group]) => {
    const quantity = roundTo4(group.remaining);
    const daysLeft = daysUntilExpiry(group.lot.expiryDate, today);
    const sources = [...group.sources];
    const parties = [...group.parties];
    return {
      itemName: group.lot.itemName,
      warehouseName: group.lot.warehouseName,
      batchNumber: group.lot.batchNumber,
      expiryDate: group.lot.expiryDate.toISOString(),
      daysLeft,
      status: statusFor(daysLeft, quantity),
      quantity,
      sourceLabel: sources.length > 1 ? `${sources.length} مستندات` : sources[0] || group.lot.sourceLabel,
      sourceNumber: sources.length === 1 ? group.lot.sourceNumber : '',
      sourceDocumentId: sources.length === 1 && !group.sourceMixed ? group.sourceDocumentId : '',
      sourceType: sources.length === 1 && !group.sourceMixed ? group.sourceType : '',
      partyName: parties.length > 1 ? parties.join('، ') : parties[0] || '',
      unitName: group.lot.unitName,
      itemGroupName: group.lot.itemGroupName,
      groupKey,
    };
  });

  rows.sort((a, b) => {
    const timeA = new Date(a.expiryDate).getTime();
    const timeB = new Date(b.expiryDate).getTime();
    if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) return timeA - timeB;
    const status = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (status) return status;
    return a.daysLeft - b.daysLeft || a.itemName.localeCompare(b.itemName, 'ar');
  });

  const summary: ExpiryReportSummary = {
    lotCount: rows.length,
    onHandLots: rows.filter((row) => row.quantity > 0).length,
    expiredLots: rows.filter((row) => row.status === 'منتهي').length,
    soonLots: rows.filter((row) => row.status === 'خلال 30 يوم').length,
    quarterLots: rows.filter((row) => row.status === 'خلال 90 يوم').length,
    consumedLots: rows.filter((row) => row.status === 'صُرف').length,
  };

  return { rows, summary };
}
