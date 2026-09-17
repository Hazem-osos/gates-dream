import { buildDraftKey } from './draft-key';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(
  buildDraftKey({ companyId: 'co-a', documentType: 'sales-invoice' }) ===
    'gates:draft:sales-invoice:co-a:new',
  'create key'
);
assert(
  buildDraftKey({ companyId: 'co-a', documentType: 'voucher', variantId: 'CASH_RECEIPT' }) ===
    'gates:draft:voucher:CASH_RECEIPT:co-a:new',
  'variant key'
);
assert(
  buildDraftKey({ companyId: 'co-a', documentType: 'sales-invoice' }) !==
    buildDraftKey({ companyId: 'co-b', documentType: 'sales-invoice' }),
  'companies isolated'
);
assert(
  buildDraftKey({
    companyId: 'co-a',
    documentType: 'sales-invoice',
    mode: 'edit',
    documentId: 'inv-1',
  }) === 'gates:draft:sales-invoice:co-a:edit:inv-1',
  'future edit key'
);

console.log('draft-key ok');
