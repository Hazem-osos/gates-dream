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
