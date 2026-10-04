import { etaOrderReferencesFromInternalNotes } from '../../modules/electronic-invoices/utils/eta-order-references';

describe('ETA sales and purchase order references', () => {
  it('maps the electronic-invoice details note onto the tax document fields', () => {
    expect(
      etaOrderReferencesFromInternalNotes([
        {
          id: 'einvoice-order-refs',
          body: JSON.stringify({
            salesOrderNumber: ' SO-19 ',
            salesOrderDescription: 'توريد مارس',
            purchaseOrderNumber: 'PO-7',
            purchaseOrderDescription: 'أمر العميل',
          }),
        },
      ])
    ).toEqual({
      salesOrderReference: 'SO-19',
      salesOrderDescription: 'توريد مارس',
      purchaseOrderReference: 'PO-7',
      purchaseOrderDescription: 'أمر العميل',
    });
  });

  it('omits blank fields and ignores other notes', () => {
    expect(
      etaOrderReferencesFromInternalNotes([
        { id: 'payment-terms', body: '{"method":"cash"}' },
        {
          id: 'einvoice-order-refs',
          body: JSON.stringify({ salesOrderNumber: '', purchaseOrderDescription: '  وصف  ' }),
        },
      ])
    ).toEqual({ purchaseOrderDescription: 'وصف' });
  });

  it('returns nothing when the note is missing or not json', () => {
    expect(etaOrderReferencesFromInternalNotes(null)).toEqual({});
    expect(
      etaOrderReferencesFromInternalNotes([{ id: 'einvoice-order-refs', body: 'not-json' }])
    ).toEqual({});
  });
});
