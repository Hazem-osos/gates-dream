import { buildDraftKey } from './draft-key';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(
  buildDraftKey({ companyId: 'co-a', userId: 'u-1', documentType: 'sales-invoice' }) ===
    'gates:draft:sales-invoice:co-a:u-1:new',
  'create key'
);
assert(
  buildDraftKey({ companyId: 'co-a', userId: 'u-1', documentType: 'voucher', variantId: 'CASH_RECEIPT' }) ===
    'gates:draft:voucher:CASH_RECEIPT:co-a:u-1:new',
  'variant key'
);
assert(
  buildDraftKey({ companyId: 'co-a', userId: 'u-1', documentType: 'sales-invoice' }) !==
    buildDraftKey({ companyId: 'co-b', userId: 'u-1', documentType: 'sales-invoice' }),
  'companies isolated'
);
assert(
  buildDraftKey({ companyId: 'co-a', userId: 'u-1', documentType: 'sales-invoice' }) !==
    buildDraftKey({ companyId: 'co-a', userId: 'u-2', documentType: 'sales-invoice' }),
  'users isolated'
);
assert(
  buildDraftKey({
    companyId: 'co-a',
    userId: 'u-1',
    documentType: 'sales-invoice',
    mode: 'edit',
    documentId: 'inv-1',
  }) === 'gates:draft:sales-invoice:co-a:u-1:edit:inv-1',
  'future edit key'
);

console.log('draft-key ok');
test('draft key assertions', () => {});
