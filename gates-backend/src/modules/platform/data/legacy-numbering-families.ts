/**
 * Registry of the ~18 legacy document-numbering families (`untgeneral.pas`
 * `Tgeneral.Create*Num` functions). Every one of them shares the exact same
 * three-setting contract, keyed by a per-document-type suffix (the concrete
 * `NewModule` code, e.g. `GL01`, `SI01`, `BP01` — legacy passes this suffix
 * in as the `...Type` parameter):
 *
 * - `SerialStart{suffix}` — first number to hand out when no rows exist yet
 *   for this (company, branch, type[, year]) combination. Default
 *   `'00000001'` when the row is absent.
 * - `SerialAutomatic{suffix}` — `'A'` (system-generated) unless the row is
 *   explicitly `'M'` (user types the number by hand). Default `'A'`.
 * - `SerialContanious{suffix}` — `'C'` (one running sequence across fiscal
 *   years) unless the row is explicitly `'P'` (resets — scoped — per fiscal
 *   year). Default `'C'`.
 *
 * All three are resolved by `DocumentSequenceService.resolveLegacyNumberingPolicy`,
 * except GL, which keeps its own un-suffixed `SerialAutomaticGL`/`SerialGL`/
 * `SerialStartGL` keys (renaming them would re-scope every tenant's existing
 * GL sequence) and opposite `continuous` polarity.
 *
 * Rows still marked `wired: false` are placeholder registrations so the owning
 * document-conversion wave (see plan "Later waves") only has to supply a
 * `docType` + `legacySuffix` and call
 * `documentSequenceService.nextNumberForFamilyInTx`, not re-derive this
 * contract from scratch.
 *
 * Every wired family follows the same call shape: use the client's number when
 * one was supplied, otherwise allocate; and when allocation returns `undefined`
 * (the family is set to manual entry) reject the request rather than storing a
 * NULL document number.
 */
export interface LegacyNumberingFamily {
  /** `Tgeneral` function this mirrors (both variants when a `*Special` SQL-fragment twin exists). */
  legacyFunction: string;
  /** Legacy table.column the running MAX() is taken over. */
  legacySource: string;
  /** The `...Type` parameter's *shape* — legacy passes a concrete NewModule/document-type code here, not a static literal (except `GL01`, which is hardcoded everywhere it's called). */
  legacySuffixShape: string;
  /** Web `document_sequences.docType` this family is (or would be) registered under. */
  docType: string;
  descriptionEn: string;
  /** True once a live web posting/entry path actually calls `nextNumberForFamilyInTx` for this docType. */
  wired: boolean;
}

export const LEGACY_NUMBERING_FAMILIES: LegacyNumberingFamily[] = [
  {
    legacyFunction: 'CreateGlNum / CreateGlNumSpecial',
    legacySource: 'GLTrxHeader.GLNum',
    legacySuffixShape: "'GL01' (hardcoded at every call site)",
    docType: 'GL',
    descriptionEn: 'General ledger voucher number — allocated by every posting path (invoices, treasury, stock, payroll, contracting, POS, ...).',
    wired: true,
  },
  {
    legacyFunction: 'CreateInvoiceNum / CreateInvoiceNumSpecial',
    legacySource: 'InvoiceTrxHeader.InvoiceNum',
    legacySuffixShape: '<InvoiceNumType> — the NewModule code (e.g. SI01/PI01/SR01/PR01)',
    docType: 'INV-SI / INV-PI / INV-SR / INV-PR',
    descriptionEn: 'Sales/purchase invoice document number.',
    wired: true,
  },
  {
    legacyFunction: 'CreateInvoiceNumUser',
    legacySource: 'InvoiceTrxHeader.InvoiceNum (scoped additionally by UserCode)',
    legacySuffixShape: '<InvoiceNumType>',
    docType: 'INV-SI-USER / INV-PI-USER / INV-SR-USER / INV-PR-USER',
    descriptionEn: 'Per-salesperson invoice numbering variant — a separate running sequence per user instead of per company/branch. No web equivalent (single shared sequence) yet; deferred to the invoice conversion wave.',
    wired: false,
  },
  {
    legacyFunction: 'CreateCashNum / CreateCashNumSpecial',
    legacySource: 'CashTrxHeader.CashNum',
    legacySuffixShape: '<CashNumType> — the NewModule code (e.g. BP01/BR01/KP01/KR01)',
    docType: 'CASH',
    descriptionEn: 'Cash/bank receipt or payment voucher number (BP/BR/KP/KR document families). Allocated by `cash-transaction.service.ts` when the client omits a `voucherNumber`; the suffix is derived from receipt-vs-payment and safe-vs-bank.',
    wired: true,
  },
  {
    legacyFunction: 'CreateCKNum',
    legacySource: 'CKTrxHeader.CKNum',
    legacySuffixShape: '<CKNumType>',
    docType: 'CK',
    descriptionEn: 'Received-securities voucher number, allocated by `securities-receipt.service.ts`. Note this numbers the *voucher*, not the physical cheque: `Cheque.chequeNumber` stays user-entered because it is pre-printed on the instrument.',
    wired: true,
  },
  {
    legacyFunction: 'CreatePKNum',
    legacySource: 'PKTrxHeader.PKNum',
    legacySuffixShape: '<PKNumType>',
    docType: 'PK / PK-SECURITIES',
    descriptionEn: 'Purchase-order number (`purchase-order.service.ts`) and the issued-securities voucher (`securities-payment.service.ts`), which share the legacy function under separate web docTypes so their sequences stay independent.',
    wired: true,
  },
  {
    legacyFunction: 'CreatePaymentNum',
    legacySource: 'TempPayment.PaymentNum',
    legacySuffixShape: '<PaymentNumType>',
    docType: 'TEMP-PAYMENT',
    descriptionEn: 'Temporary/advance payment voucher number (`untTempPayment.pas`). Deferred.',
    wired: false,
  },
  {
    legacyFunction: 'CreateIANum',
    legacySource: 'IATrxHeader.IANum',
    legacySuffixShape: '<IANumType>',
    docType: 'IA',
    descriptionEn: 'Fixed-asset addition/disposal (IA) voucher number. Deferred to the fixed-assets wave.',
    wired: false,
  },
  {
    legacyFunction: 'CreateStoreCheckNum',
    legacySource: 'StoreCheckHeader.StoreCheckNum',
    legacySuffixShape: '<StoreCheckNumType>',
    docType: 'STORE-CHECK',
    descriptionEn: 'Stock count/check voucher number (`UntStoreCheck.pas`). Deferred to the store-ecosystem wave.',
    wired: false,
  },
  {
    legacyFunction: 'CreateStoreAdjustNum',
    legacySource: 'StoreAdjustHeader.StoreAdjustNum',
    legacySuffixShape: '<StoreAdjustNumType>',
    docType: 'STORE-ADJUST',
    descriptionEn: 'Stock adjustment voucher number (`UntStoreAdjust.pas`). Deferred to the store-ecosystem wave.',
    wired: false,
  },
  {
    legacyFunction: 'CreateStoreTransNum',
    legacySource: 'StoreTransHeader.StoreTransNum',
    legacySuffixShape: '<StoreTransNumType>',
    docType: 'STORE-TRANS',
    descriptionEn: 'Inter-warehouse transfer voucher number (`UntStoreTrans.pas`). Deferred to the store-ecosystem wave.',
    wired: false,
  },
  {
    legacyFunction: 'CreateStoreCollNum',
    legacySource: 'StoreCollHeader.StoreCollNum',
    legacySuffixShape: '<StoreCollNumType>',
    docType: 'STORE-COLL',
    descriptionEn: 'Store collection voucher number (`UntStoreColl.pas`). Deferred to the store-ecosystem wave.',
    wired: false,
  },
  {
    legacyFunction: 'CreateStoreColNum',
    legacySource: 'StoreCollHeader.StoreCollCode',
    legacySuffixShape: '<StoreColNumType> (startYearId is passed in directly rather than read from SerialStart)',
    docType: 'STORE-COLL-CODE',
    descriptionEn: 'Near-duplicate of CreateStoreCollNum reading a different column (`StoreCollCode`) off the same table — legacy naming inconsistency (`CreateStoreColNum` vs `CreateStoreCollNum`), kept as a distinct family for matrix completeness. Deferred.',
    wired: false,
  },
  {
    legacyFunction: 'CreateStoreDistNum',
    legacySource: 'StoreDistHeader.StoreDistNum',
    legacySuffixShape: '<StoreDistNumType>',
    docType: 'STORE-DIST',
    descriptionEn: 'Store distribution voucher number (`UntStoreDist.pas`). Deferred to the store-ecosystem wave.',
    wired: false,
  },
  {
    legacyFunction: 'CreateEtemadNum',
    legacySource: 'EtemadTrxHeader.EtemadNum',
    legacySuffixShape: '<EtemadNumType>',
    docType: 'ETEMAD',
    descriptionEn: 'Letter-of-credit/trust (اعتماد) voucher number (`UntEtemad.pas`). Deferred to the trade/LC wave.',
    wired: false,
  },
  // ── Web-only families ────────────────────────────────────────────────────
  // Documents the web app has that legacy numbered differently (or not at
  // all). Registered here so every allocated `docType` is accounted for.
  {
    legacyFunction: '(none — web-only document)',
    legacySource: '(n/a)',
    legacySuffixShape: "'QT01'",
    docType: 'QUOTE',
    descriptionEn: 'Price-quote number (`price-quote.service.ts`). Legacy handled quotations inside the invoice screens, so there is no dedicated Create*Num twin.',
    wired: true,
  },
  {
    legacyFunction: '(none — web-only document)',
    legacySource: '(n/a)',
    legacySuffixShape: "'RN01'",
    docType: 'SECURITIES-RENEWAL',
    descriptionEn: 'Securities renewal voucher number (`securities-renewal.service.ts`).',
    wired: true,
  },
  {
    legacyFunction: '(none — web-only document)',
    legacySource: '(n/a)',
    legacySuffixShape: '(no settings suffix — always automatic)',
    docType: 'OFFSET',
    descriptionEn: 'Counterparty offset voucher number (`counterparty-offset.service.ts`). Replaced a `Date.now()`-derived string that was neither gap-free nor collision-proof.',
    wired: true,
  },
];

export function getLegacyNumberingFamily(docType: string): LegacyNumberingFamily | undefined {
  return LEGACY_NUMBERING_FAMILIES.find((f) => f.docType === docType);
}
