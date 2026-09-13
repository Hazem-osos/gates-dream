import { ASYNC_QUEUE_NAMES } from '../../src/workers/queue-manager';
import { renderDocumentPdf } from '../../src/workers/lib/document-pdf';
import { respondAcceptedJob } from '../../src/shared/jobs/accept-job';

describe('async job infrastructure', () => {
  it('defines dedicated queue names', () => {
    expect(ASYNC_QUEUE_NAMES.PDF_GENERATION).toBe('pdf-generation');
    expect(ASYNC_QUEUE_NAMES.TAX_PORTAL_SYNC).toBe('tax-portal-sync');
    expect(ASYNC_QUEUE_NAMES.REPORT_EXPORT).toBe('report-export');
  });

  it('renders an invoice PDF buffer', async () => {
    const buffer = await renderDocumentPdf({
      kind: 'invoice',
      companyName: 'Gates Soft',
      companyTax: '123456789',
      documentNumber: 'SI-1001',
      date: new Date('2026-03-01T00:00:00.000Z'),
      partyLabel: 'Customer',
      partyName: 'أحمد',
      currencyCode: 'EGP',
      lines: [{ name: 'Item A', quantity: 2, price: 50, total: 100 }],
      subtotal: 100,
      discount: 0,
      tax: 14,
      net: 114,
    });
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(200);
  });

  it('responds 202 with jobId', () => {
    const json = jest.fn();
    const res = {
      status: jest.fn().mockReturnValue({ json }),
    };
    respondAcceptedJob(res as never, { id: 'job-42' } as never, 'Invoice PDF queued');
    expect(res.status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({
      status: 'accepted',
      message: 'Invoice PDF queued',
      jobId: 'job-42',
      statusUrl: '/api/v1/jobs/job-42',
    });
  });
});
