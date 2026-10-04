/**
 * Phase 2+ (historical import): when legacy documents are written into the target
 * schema as read-only history, provenance lives in MigrationIdMap (readOnly flag).
 *
 * The normal ERP posting/unposting runtime stays migration-agnostic.
 * Import stages must not replay PostInvoice / postJournalEntry for bulk history.
 */
export class MigrationProtectedDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationProtectedDocumentError';
  }
}
