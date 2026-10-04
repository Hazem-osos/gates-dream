/** Strict inventory = company has not opted into negative stock. */
export function strictInventoryFromFlags(opts: {
  allowNegativeBalance?: boolean | null;
  allowNegativeStore?: boolean;
  allowMinusQty?: boolean;
  preventNegativeStock?: boolean | null;
}): boolean {
  if (opts.preventNegativeStock === false) return false;
  return !(
    opts.allowNegativeBalance === true ||
    Boolean(opts.allowNegativeStore) ||
    Boolean(opts.allowMinusQty)
  );
}

/** Transaction / document settings: block negative on post even if company allows it. */
export function transactionEnforcesStrictNegativeStock(
  settings: {
    preventNegativeStock?: boolean | null;
    affectStock?: boolean | null;
  } | null
  | undefined
): boolean {
  if (!settings) return false;
  return Boolean(settings.preventNegativeStock && settings.affectStock);
}
