/**
 * Registry of the legacy `AdvancedRights` table's ~38 post/unpost + year
 * open/close flags (`MainProgram/DataBase.ini` `[AdvancedRights]`, loaded
 * per (UserCode, CompanyCode, BranchCode) by
 * `untbranchvariables.pas Tbranch.set_variables` at branch login).
 *
 * Legacy semantics (`set_variables` 124-405):
 * - Keyed by the *individual* user (`UserCode`), not the security group.
 * - `Admin` bypasses the table entirely — every flag is force-`'T'`.
 * - Non-Admin: any flag whose stored value is not exactly `'T'` becomes
 *   `'F'` (deny). If the row itself doesn't exist, `AsString` on the empty
 *   dataset resolves to `''`, which is `<>'T'`, so an *unprovisioned* user
 *   is denied every flag in legacy.
 *
 * Web reconciliation (`advanced-rights.service.ts`): rather than
 * retroactively locking out every already-migrated user the moment this
 * table exists (no company has back-filled per-user rows yet), an
 * unprovisioned user is treated as *unrestricted* — the same
 * default-allow-until-configured posture already used by
 * `bank-box-rights.service.ts` for `BankBoxRights`. Once any
 * `UserAdvancedPermission.permissions.documentRights` row exists for a
 * user, that user is governed by the explicit flags, matching legacy
 * exactly for provisioned users. `Admin`-role bypass matches legacy.
 *
 * Enforcement points for the wired families:
 * - `glPost`/`glUnpost` — `journal-posting.service.ts` (the path every other
 *   document family eventually routes through)
 * - `piPost`/`svPost`/`srPost`/`prPost` — `invoice-posting-orchestrator.ts`,
 *   keyed off invoice kind (mind the legacy naming: `PIPost` is the *sales*
 *   flag, `SVPost` the *purchase* one)
 * - `cashBp`/`cashBr`/`cashKp`/`cashKr` — `treasury-posting.service.ts`
 *   `postCashTransaction`/`unpostCashTransaction`, discriminated by
 *   receipt-vs-payment and safe-vs-bank
 * - `rcPost`/`pcPost` — `cheque-lifecycle.service.ts`, inward vs outward
 * - `scPost`/`stPost`/`siPost`/`ftPost` — `store-document-rights.ts`, applied
 *   by the stocktaking, transfer, adjustment and opening-stock services
 * - `etPost` — the trade module's letters of credit and guarantee, which is
 *   the web port of legacy Etemad
 * - `yearOpen`/`yearClose` — `year-end-closing.service.ts`
 *
 * Still `wired: false`: `bgPost` (cyclic/budget GL voucher) and `slPost`
 * (store collection) have no web screen yet. They stay registered so the wave
 * that builds those screens only has to call
 * `advancedRightsService.assertCanPostFamily`, not re-derive the key list
 * from the legacy schema.
 */
export interface LegacyAdvancedRightFamily {
  /** Column pair (or single flag for YearOpen/YearClose) in `AdvancedRights`. */
  legacyPostKey: string;
  legacyUnpostKey?: string;
  /** Web-side camelCase keys stored under `documentRights` in the `UserAdvancedPermission.permissions` JSON. */
  key: string;
  unpostKey?: string;
  descriptionEn: string;
  /** Legacy screen(s) that read this flag (`Set_Buttons`/`AllowPost` call sites). */
  legacyScreens: string;
  /** True once a live web posting/unposting path actually calls `assertCanPostFamily` for this key. */
  wired: boolean;
}

export const LEGACY_ADVANCED_RIGHT_FAMILIES: LegacyAdvancedRightFamily[] = [
  {
    legacyPostKey: 'GLPost',
    legacyUnpostKey: 'GLUnPost',
    key: 'glPost',
    unpostKey: 'glUnpost',
    descriptionEn: 'General ledger voucher post/unpost.',
    legacyScreens: 'UntGL.pas, UntBG.pas',
    wired: true,
  },
  {
    legacyPostKey: 'BGPost',
    legacyUnpostKey: 'BGUnPost',
    key: 'bgPost',
    unpostKey: 'bgUnpost',
    descriptionEn: 'Budget/cyclic GL voucher post/unpost.',
    legacyScreens: 'UntBG.pas',
    wired: false,
  },
  {
    legacyPostKey: 'PIPost',
    legacyUnpostKey: 'PIUnPost',
    key: 'piPost',
    unpostKey: 'piUnpost',
    descriptionEn: 'Sales invoice/return post/unpost (legacy naming — read by untRInovice.pas, not untPInovice.pas).',
    legacyScreens: 'untRInovice.pas',
    wired: true,
  },
  {
    legacyPostKey: 'SVPost',
    legacyUnpostKey: 'SVUnPost',
    key: 'svPost',
    unpostKey: 'svUnpost',
    descriptionEn: 'Purchase invoice post/unpost (legacy naming — read by untPInovice.pas).',
    legacyScreens: 'untPInovice.pas',
    wired: true,
  },
  {
    legacyPostKey: 'SRPost',
    legacyUnpostKey: 'SRUnPost',
    key: 'srPost',
    unpostKey: 'srUnpost',
    descriptionEn: 'Sales return post/unpost.',
    legacyScreens: 'untRInovice.pas',
    wired: true,
  },
  {
    legacyPostKey: 'PRPost',
    legacyUnpostKey: 'PRUnPost',
    key: 'prPost',
    unpostKey: 'prUnpost',
    descriptionEn: 'Purchase return post/unpost.',
    legacyScreens: 'untRInovice.pas',
    wired: true,
  },
  {
    legacyPostKey: 'SCPost',
    legacyUnpostKey: 'SCUnPost',
    key: 'scPost',
    unpostKey: 'scUnpost',
    descriptionEn: 'Store check (stock count) post/unpost.',
    legacyScreens: 'UntStoreCheck.pas',
    wired: true,
  },
  {
    legacyPostKey: 'STPost',
    legacyUnpostKey: 'STUnPost',
    key: 'stPost',
    unpostKey: 'stUnpost',
    descriptionEn: 'Store transfer post/unpost.',
    legacyScreens: 'UntStoreTrans.pas',
    wired: true,
  },
  {
    legacyPostKey: 'SIPost',
    legacyUnpostKey: 'SIUnPost',
    key: 'siPost',
    unpostKey: 'siUnpost',
    descriptionEn: 'Store distribution/adjustment post/unpost.',
    legacyScreens: 'UntStoreDist.pas',
    wired: true,
  },
  {
    legacyPostKey: 'ETPost',
    legacyUnpostKey: 'ETUnPost',
    key: 'etPost',
    unpostKey: 'etUnpost',
    descriptionEn: 'Etemad (trust/consignment) document post/unpost.',
    legacyScreens: 'untEtemad*.pas',
    wired: true,
  },
  {
    legacyPostKey: 'FTPost',
    legacyUnpostKey: 'FTUnPost',
    key: 'ftPost',
    unpostKey: 'ftUnpost',
    descriptionEn: 'First-time/opening-balance items post/unpost.',
    legacyScreens: 'UntItemsFirstTime.pas',
    wired: true,
  },
  {
    legacyPostKey: 'SLPost',
    legacyUnpostKey: 'SLUnPost',
    key: 'slPost',
    unpostKey: 'slUnpost',
    descriptionEn: 'Store collection document post/unpost.',
    legacyScreens: 'UntStoreDist.pas (CreateStoreColNum family)',
    wired: false,
  },
  {
    legacyPostKey: 'PCPost',
    legacyUnpostKey: 'PCUnPost',
    key: 'pcPost',
    unpostKey: 'pcUnpost',
    descriptionEn: 'Payment cheque post/unpost.',
    legacyScreens: 'untPaymentCheck.pas',
    wired: true,
  },
  {
    legacyPostKey: 'RCPost',
    legacyUnpostKey: 'RCUnPost',
    key: 'rcPost',
    unpostKey: 'rcUnpost',
    descriptionEn: 'Receive cheque post/unpost.',
    legacyScreens: 'untRecieveCheck.pas',
    wired: true,
  },
  {
    legacyPostKey: 'CashBPPost',
    legacyUnpostKey: 'CashBPUnPost',
    key: 'cashBpPost',
    unpostKey: 'cashBpUnpost',
    descriptionEn: 'Cash payment voucher post/unpost.',
    legacyScreens: 'UntBP.pas',
    wired: true,
  },
  {
    legacyPostKey: 'CashBRPost',
    legacyUnpostKey: 'CashBRUnPost',
    key: 'cashBrPost',
    unpostKey: 'cashBrUnpost',
    descriptionEn: 'Cash receipt voucher post/unpost.',
    legacyScreens: 'UntBP.pas',
    wired: true,
  },
  {
    legacyPostKey: 'CashKPPost',
    legacyUnpostKey: 'CashKPUnPost',
    key: 'cashKpPost',
    unpostKey: 'cashKpUnpost',
    descriptionEn: 'Bank payment voucher post/unpost.',
    legacyScreens: 'UntBP.pas',
    wired: true,
  },
  {
    legacyPostKey: 'CashKRPost',
    legacyUnpostKey: 'CashKRUnPost',
    key: 'cashKrPost',
    unpostKey: 'cashKrUnpost',
    descriptionEn: 'Bank receipt voucher post/unpost.',
    legacyScreens: 'UntBP.pas',
    wired: true,
  },
  {
    legacyPostKey: 'YearOpen',
    key: 'yearOpen',
    descriptionEn: 'Reopen a closed fiscal year.',
    legacyScreens: 'untYear.pas',
    wired: true,
  },
  {
    legacyPostKey: 'YearClose',
    key: 'yearClose',
    descriptionEn: 'Close an open fiscal year.',
    legacyScreens: 'untYear.pas',
    wired: true,
  },
];
