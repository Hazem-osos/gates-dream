function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Cash-box and bank movement statements open on the current month. */
export function isMonthToDateReport(path?: string) {
  if (!path) return false;
  return path.includes('bank-movement') || path.includes('/credit/safe');
}

/** Expiry reports filter the expiry date itself, so the window includes past and upcoming dates. */
export function expiryReportDefaultDates() {
  const year = new Date().getFullYear();
  return { fromDate: `${year - 5}-01-01`, toDate: `${year + 2}-12-31` };
}

/** Live stock / reserved qty: default «حتى» = today, not year-end. */
export function isLiveInventoryStockReport(path?: string) {
  if (!path) return false;
  return (
    path.includes('inventory-reports') ||
    path.includes('item-balances') ||
    path.includes('items-exceeding-order-limit')
  );
}

/** 1 Jan–31 Dec, except cash box and bank movement: 1st of this month through today. */
export function reportDefaultDateRange(path?: string) {
  const now = new Date();
  const year = now.getFullYear();
  if (path?.includes('expiry-date')) return expiryReportDefaultDates();
  if (isLiveInventoryStockReport(path)) {
    return { fromDate: `${year}-01-01`, toDate: localIso(now) };
  }
  if (isMonthToDateReport(path)) {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return { fromDate: `${year}-${month}-01`, toDate: localIso(now) };
  }
  return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` };
}
