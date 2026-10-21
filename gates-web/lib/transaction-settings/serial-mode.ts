/** Per-document numberingMode from إعدادات المستند — never treat "not loaded" as automatic. */
export function isTransactionSerialAutomatic(
  numberingMode: string | null | undefined
): boolean {
  return numberingMode === 'AUTOMATIC';
}

/** Only true after settings explicitly say MANUAL — loading/missing is not manual. */
export function isTransactionSerialManual(
  numberingMode: string | null | undefined
): boolean {
  return numberingMode === 'MANUAL';
}

export function documentSerialPlaceholder(serialAutomatic: boolean): string {
  return serialAutomatic ? 'يُولَّد تلقائياً' : 'أدخل الرقم يدوياً';
}
