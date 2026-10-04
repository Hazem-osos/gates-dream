import { interpretEtaSubmission } from '../../modules/electronic-invoices/services/live-eta.client';
import { withIssuerSignature } from '../../modules/electronic-invoices/services/eta-signing.service';
import { etaDateTimeIssued } from '../../modules/electronic-invoices/utils/eta-canonical.util';
import { resolveEtaEndpoints } from '../../modules/electronic-invoices/utils/eta-endpoints';

describe('ETA submit path', () => {
  it('uses the official host for the company environment when no custom URL is saved', () => {
    expect(resolveEtaEndpoints({ environment: 'PRE_PRODUCTION' }).apiBaseUrl).toBe(
      'https://api.preprod.invoicing.eta.gov.eg'
    );
    expect(resolveEtaEndpoints({ environment: 'PRODUCTION' }).identityUrl).toBe(
      'https://id.eta.gov.eg/connect/token'
    );
  });

  it('treats TokenAPI as the identity host and InvoiceAPI as the document host', () => {
    const endpoints = resolveEtaEndpoints({
      environment: 'PRE_PRODUCTION',
      tokenUrl: 'https://id.eta.gov.eg',
      invoiceUrl: 'https://api.invoicing.eta.gov.eg',
    });
    expect(endpoints.identityUrl).toBe('https://id.eta.gov.eg/connect/token');
    expect(endpoints.apiBaseUrl).toBe('https://api.invoicing.eta.gov.eg');
    expect(endpoints.shareBaseUrl).toBe('https://invoicing.eta.gov.eg');
  });

  it('puts the issuer signature inside the document that is posted', () => {
    const posted = withIssuerSignature({ documentType: 'I', internalID: '1' }, 'c2ln');
    expect(posted.signatures).toEqual([{ signatureType: 'I', value: 'c2ln' }]);
  });

  it('keeps an accepted document as submitted until the authority marks it valid', () => {
    const result = interpretEtaSubmission(
      {
        submissionId: 'sub-1',
        acceptedDocuments: [{ uuid: 'doc-1', longId: 'LONG', status: 'Submitted' }],
      },
      'https://preprod.invoicing.eta.gov.eg'
    );
    expect(result.status).toBe('SUBMITTED');
    expect(result.publicUrl).toBe('https://preprod.invoicing.eta.gov.eg/documents/doc-1/share/LONG');
  });

  it('returns the authority rejection instead of a generic empty accept', () => {
    const result = interpretEtaSubmission(
      {
        rejectedDocuments: [{ error: { message: 'Invalid signature', details: [{ message: 'التوقيع غير صالح' }] } }],
      },
      'https://invoicing.eta.gov.eg'
    );
    expect(result.status).toBe('INVALID');
    expect(result.validationErrors?.[0]?.message).toBe('التوقيع غير صالح');
  });

  it('strips milliseconds from the issue timestamp', () => {
    expect(etaDateTimeIssued(new Date('2026-09-29T18:00:00.123Z'))).toBe('2026-09-29T18:00:00Z');
  });
});
