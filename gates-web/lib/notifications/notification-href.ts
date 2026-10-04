const EVENT_ROUTES: Array<[string, string]> = [
  ['sales.invoice', '/inventory/operations/sales-invoice'],
  ['purchase.order', '/inventory/operations/purchase-order'],
  ['purchase.invoice', '/inventory/operations/final-purchase-invoice'],
  ['customer.', '/accounting/cards/customer'],
  ['supplier.', '/accounting/cards/supplier'],
  ['inventory.', '/inventory'],
  ['hr.', '/hr'],
  ['project.', '/extracts'],
];

const KNOWN_ROOTS = new Set([
  'accounting',
  'accounting-settings',
  'academy',
  'automation',
  'contracting',
  'extracts',
  'hr',
  'inventory',
  'manufacturing',
  'pos',
  'real-estate',
  'real-estate-investment',
  'subcontracts',
]);

function eventRoute(category: string | null | undefined): string | null {
  const cat = (category ?? '').trim();
  if (!cat) return null;
  for (const [prefix, href] of EVENT_ROUTES) {
    if (cat.startsWith(prefix)) return href;
  }
  return '/automation';
}

function knownAppPath(path: string): boolean {
  const root = path.split('?')[0]?.split('#')[0]?.split('/').filter(Boolean)[0];
  return Boolean(root && KNOWN_ROOTS.has(root));
}

/** A notification link that actually exists in the app. Bad or relative links fall back to the event's screen. */
export function notificationDestination(
  link: string | null | undefined,
  category?: string | null,
): string | null {
  const raw = (link ?? '').trim();
  if (raw.startsWith('/dashboard') && raw.includes('startTour')) return '/academy';
  if (raw.startsWith('/') && !raw.startsWith('//') && knownAppPath(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return eventRoute(category);
}
