export const QUICK_CREATE_KINDS = [
  'customer',
  'supplier',
  'account',
  'cost-center',
  'item',
  'warehouse',
  'safe',
  'bank-account',
] as const;

export type QuickCreateKind = (typeof QUICK_CREATE_KINDS)[number];

export const QUICK_CREATE_PATHS: Record<QuickCreateKind, string> = {
  customer: '/accounting/cards/customer',
  supplier: '/accounting/cards/supplier',
  account: '/accounting/cards/account',
  'cost-center': '/accounting/cards/cost-center',
  item: '/inventory/creations/item-card',
  warehouse: '/inventory/creations/stores',
  safe: '/accounting/cards/safe',
  'bank-account': '/accounting/cards/bank-account',
};

export type QuickCreateEntity = {
  id: string;
  label: string;
  arabicName?: string;
  code?: string | null;
  accountId?: string | null;
  [key: string]: unknown;
};

export type QuickCreateRequest = {
  id: string;
  kind: QuickCreateKind;
  returnPath: string;
  prefillName?: string;
};

export type QuickCreateResult = {
  requestId: string;
  kind: QuickCreateKind;
  entity: QuickCreateEntity;
};

export function entityLabel(code?: string | null, arabicName?: string | null) {
  const name = arabicName?.trim() || '';
  return code ? `[${code}] ${name}` : name;
}
