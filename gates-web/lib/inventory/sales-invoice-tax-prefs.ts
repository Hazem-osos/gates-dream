import { getTenantContext } from '@/lib/tenant/tenant-context-storage';

const STORAGE_PREFIX = 'gates:sales-invoice-apply-vat:';

/** Default VAT on new sales invoices for this company (stored in browser). Default: off.
 * Never call this in a useState initializer — localStorage differs from SSR and hydrates badly. */
export function readSalesInvoiceVatDefault(companyId?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  const id = companyId ?? getTenantContext().companyId;
  if (!id) return false;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    /* ignore */
  }
  return false;
}

export function persistSalesInvoiceVatDefault(enabled: boolean, companyId?: string | null): void {
  if (typeof window === 'undefined') return;
  const id = companyId ?? getTenantContext().companyId;
  if (!id) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}
