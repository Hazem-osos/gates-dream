/**
 * Official ETA tax type → subtype map.
 * Source: https://sdk.invoicing.eta.gov.eg/codes/tax-types/
 * A subtype may be used only with the tax type in this table.
 */
export const ETA_TAX_SUBTYPES: Record<string, readonly string[]> = {
  T1: ['V001', 'V002', 'V003', 'V004', 'V005', 'V006', 'V007', 'V008', 'V009', 'V010'],
  T2: ['Tbl01'],
  T3: ['Tbl02'],
  T4: ['W001', 'W002', 'W003', 'W004', 'W005', 'W006', 'W007', 'W008', 'W009', 'W010', 'W011', 'W012', 'W013', 'W014', 'W015', 'W016'],
  T5: ['ST01'],
  T6: ['ST02'],
  T7: ['Ent01', 'Ent02'],
  T8: ['RD01', 'RD02'],
  T9: ['SC01', 'SC02'],
  T10: ['Mn01', 'Mn02'],
  T11: ['MI01', 'MI02'],
  T12: ['OF01', 'OF02'],
  T13: ['ST03'],
  T14: ['ST04'],
  T15: ['Ent03', 'Ent04'],
  T16: ['RD03', 'RD04'],
  T17: ['SC03', 'SC04'],
  T18: ['Mn03', 'Mn04'],
  T19: ['MI03', 'MI04'],
  T20: ['OF03', 'OF04'],
};

export function taxSubtypeBelongs(taxType: string, subType: string): boolean {
  return (ETA_TAX_SUBTYPES[taxType] ?? []).includes(subType);
}

/** POS device chain. ETA: previousUUID is the previous receipt from the same POS. */
export function deviceChainKey(companyId: string, terminalId: string, environment: string): string {
  return `${companyId}\u0000${terminalId}\u0000${environment}`;
}

/** receiptNumber is unique per branch inside a submission. Separate from the device chain. */
export function branchNumberKey(companyId: string, environment: string, branchCode: string): string {
  return `${companyId}\u0000${environment}\u0000${branchCode}`;
}

/** A failed issuance must not move the device head. */
export function chainHeadAfterIssue(head: string, issuedUuid: string, committed: boolean): string {
  return committed ? issuedUuid : head;
}

/**
 * FAQ resubmission: the corrected receipt keeps the invalid receipt's previousUUID.
 * Later receipts stay pointed at the invalid UUID. The device head does not move.
 * https://sdk.invoicing.eta.gov.eg/receiptissuancefaq/
 */
export function correctionPreviousUuid(invalidPreviousUuid: string): string {
  return invalidPreviousUuid;
}
