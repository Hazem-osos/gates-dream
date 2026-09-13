import type { JournalEntryLineDto } from './journal-entry.dto';

export type { CreateJournalEntryLineDto, JournalEntryLineDto, UpdateJournalEntryLineDto } from './journal-entry.dto';

export interface JournalEntryLineData extends JournalEntryLineDto {
  lineOrder: number;
}

export interface CreateJournalEntryData {
  voucherNumber?: string;
  date: Date;
  hijriDate?: string;
  description?: string;
  currencyCode: string;
  isCyclic?: boolean;
  isRecurring?: boolean;
  entryType?: string;
  sourceType?: string;
  sourceId?: string;
  sourceNumber?: string;
  sourceKind?: string;
  exchangeRate?: number;
  lines: JournalEntryLineData[];
}

export interface UpdateJournalEntryData {
  voucherNumber?: string;
  date?: Date;
  hijriDate?: string;
  description?: string;
  currencyCode?: string;
  isCyclic?: boolean;
  isRecurring?: boolean;
  entryType?: string;
  sourceType?: string;
  sourceId?: string;
  sourceNumber?: string;
  sourceKind?: string;
  exchangeRate?: number;
  lines?: JournalEntryLineData[];
  /**
   * M14 fix (Item 40): optional optimistic-locking token — echo back the
   * `version` a prior read returned to have a stale edit rejected with 409
   * instead of silently overwriting a concurrent change. Omitting it
   * preserves the previous last-write-wins behavior for callers that
   * haven't been updated to send it yet.
   */
  expectedVersion?: number;
}
