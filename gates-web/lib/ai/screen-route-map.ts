export type AiScreenRoute = {
  label: string;
  href: string;
};

/** Longest labels first so «مردودات المبيعات» wins over «المبيعات». */
export const AI_SCREEN_ROUTES: AiScreenRoute[] = [
  { label: 'إشعارات خصم المنبع', href: '/accounting/tax/wht-certificates' },
  { label: 'مردودات المبيعات', href: '/sales/returns/new' },
  { label: 'فواتير المشتريات', href: '/purchases/invoices/new' },
  { label: 'فواتير المبيعات', href: '/sales/invoices/new' },
  { label: 'سندات الصرف', href: '/accounting/vouchers/payment/new' },
  { label: 'سندات القبض', href: '/accounting/vouchers/receipt/new' },
  { label: 'أوراق القبض', href: '/accounting/operations/securities/reciept' },
  { label: 'أوراق الدفع', href: '/accounting/operations/securities/payment' },
  { label: 'إذن صرف مخزني', href: '/inventory/operations/issue' },
];

const LABEL_PATTERN = AI_SCREEN_ROUTES.map((row) =>
  row.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
).join('|');

export const AI_SCREEN_MENTION_RE = new RegExp(`\\[?(${LABEL_PATTERN})\\]?`, 'g');

export function routeForScreenLabel(label: string): string | undefined {
  const compact = label.replace(/^\[|\]$/g, '').trim();
  return AI_SCREEN_ROUTES.find((row) => row.label === compact)?.href;
}

export function splitScreenMentions(text: string): Array<{ type: 'text' | 'screen'; value: string; href?: string }> {
  const pieces: Array<{ type: 'text' | 'screen'; value: string; href?: string }> = [];
  const matcher = new RegExp(AI_SCREEN_MENTION_RE.source, 'g');
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    if (match.index > last) {
      pieces.push({ type: 'text', value: text.slice(last, match.index) });
    }
    const label = match[1];
    const href = routeForScreenLabel(label);
    if (href) pieces.push({ type: 'screen', value: label, href });
    else pieces.push({ type: 'text', value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ type: 'text', value: text.slice(last) });
  return pieces.length ? pieces : [{ type: 'text', value: text }];
}
