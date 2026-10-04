import { withIssuerSignature } from '../../modules/electronic-invoices/services/eta-signing.service';
import {
  assertCadesBesBase64,
  hashUnsignedEtaDocument,
  unsignedEtaDocument,
} from '../../modules/electronic-invoices/utils/eta-local-sign';
import {
  authoritativeEtaInvoiceDocument,
  collectEtaDocumentIssues,
  normalizeEtaInvoiceDocument,
} from '../../modules/electronic-invoices/utils/eta-document-normalize';

const RIN = '262290472';
const SIGNATURE = `${'Q'.repeat(80)}==`;

function rawInvoice() {
  return {
    documentType: 'I' as const,
    taxpayerActivityCode: ' 6201 ',
    issuer: {
      id: RIN,
      address: {
        country: 'eg',
        governate: 'cairo',
        regionCity: '  Nasr City  ',
        street: '  Tahrir  ',
        buildingNumber: ' 12 ',
        branchID: ' 0 ',
      },
    },
    receiver: {
      address: {
        country: 'مصر',
        governate: 'giza',
        regionCity: 'Dokki',
        street: '  Haram  ',
        buildingNumber: '1',
      },
    },
    invoiceLines: [
      {
        description: 'تراخيص',
        itemType: 'EGS' as 'EGS' | 'GS1',
        itemCode: '102020',
        unitType: 'ea',
      },
    ],
  };
}

describe('ETA authoritative document', () => {
  it('signs and submits the same normalized document that validation accepted', () => {
    const raw = rawInvoice();
    expect(collectEtaDocumentIssues(raw, RIN).some((issue) => issue.severity === 'error')).toBe(true);

    const { document, issues } = authoritativeEtaInvoiceDocument(raw, RIN);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(document.invoiceLines?.[0]?.itemCode).toBe(`EG-${RIN}-102020`);
    expect(document.invoiceLines?.[0]?.unitType).toBe('EA');
    expect(document.taxpayerActivityCode).toBe('6201');
    expect(document.issuer?.address?.country).toBe('EG');
    expect(document.issuer?.address?.governate).toBe('Cairo');
    expect(document.issuer?.address?.street).toBe('Tahrir');
    expect(document.issuer?.address?.buildingNumber).toBe('12');
    expect(document.issuer?.address?.branchID).toBe('0');
    expect(document.receiver?.address?.country).toBe('EG');
    expect(document.receiver?.address?.governate).toBe('Giza');

    const signature = assertCadesBesBase64(SIGNATURE);
    const submitted = withIssuerSignature(document, signature);
    expect(submitted.invoiceLines).toEqual(document.invoiceLines);
    expect(submitted.taxpayerActivityCode).toBe(document.taxpayerActivityCode);
    expect(submitted.issuer).toEqual(document.issuer);
    expect(submitted.receiver).toEqual(document.receiver);
    expect(submitted.invoiceLines).not.toEqual(raw.invoiceLines);
    expect(hashUnsignedEtaDocument(unsignedEtaDocument(submitted))).toBe(
      hashUnsignedEtaDocument(document)
    );
    expect(submitted.signatures).toEqual([{ signatureType: 'I', value: signature }]);
    expect(normalizeEtaInvoiceDocument(document, RIN)).toEqual(document);
  });

  it('keeps Arabic governorates that ETA already accepted', () => {
    const invoice = rawInvoice();
    invoice.issuer.address.governate = 'الجيزه';
    invoice.receiver.address.governate = 'القاهرة';
    const { document, issues } = authoritativeEtaInvoiceDocument(invoice, RIN);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(document.issuer?.address?.governate).toBe('الجيزه');
    expect(document.receiver?.address?.governate).toBe('القاهرة');
    const signed = withIssuerSignature(document, assertCadesBesBase64(SIGNATURE));
    expect(unsignedEtaDocument(signed).issuer).toEqual(document.issuer);
    expect(unsignedEtaDocument(signed).receiver).toEqual(document.receiver);
    expect(hashUnsignedEtaDocument(unsignedEtaDocument(signed))).toBe(
      hashUnsignedEtaDocument(document)
    );
  });

  it('omits amountSold and currencyExchangeRate when the sold currency is EGP', () => {
    const egp = {
      ...rawInvoice(),
      invoiceLines: [
        {
          ...rawInvoice().invoiceLines[0],
          unitValue: {
            currencySold: 'EGP',
            amountEGP: 1500,
            amountSold: 1500,
            currencyExchangeRate: 1,
          },
        },
      ],
    };
    const document = authoritativeEtaInvoiceDocument(egp, RIN).document;
    expect(document.invoiceLines?.[0]?.unitValue).toEqual({
      currencySold: 'EGP',
      amountEGP: 1500,
    });

    const foreign = {
      ...rawInvoice(),
      invoiceLines: [
        {
          ...rawInvoice().invoiceLines[0],
          unitValue: {
            currencySold: 'USD',
            amountEGP: 7500,
            amountSold: 150,
            currencyExchangeRate: 50,
          },
        },
      ],
    };
    expect(authoritativeEtaInvoiceDocument(foreign, RIN).document.invoiceLines?.[0]?.unitValue).toEqual({
      currencySold: 'USD',
      amountEGP: 7500,
      amountSold: 150,
      currencyExchangeRate: 50,
    });
  });

  it('rejects the fake 0000 activity code instead of sending it', () => {
    const raw = rawInvoice();
    raw.taxpayerActivityCode = '0000';
    const { document, issues } = authoritativeEtaInvoiceDocument(raw, RIN);
    expect(document.taxpayerActivityCode).toBe('0000');
    expect(issues.some((issue) => issue.code === 'INVALID_ACTIVITY_CODE')).toBe(true);
  });
});
