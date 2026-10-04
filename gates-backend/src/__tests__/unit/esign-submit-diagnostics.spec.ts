import {
  attachEtaHttpMeta,
  publicEsignDiagnostics,
  sanitizeEtaPreview,
} from '../../modules/electronic-invoices/utils/esign-submit-diagnostics';

describe('esign submit diagnostics', () => {
  it('redacts tokens and secrets from ETA previews', () => {
    const preview = sanitizeEtaPreview(
      '{"access_token":"secret-token","error":"invalid_client","client_secret":"abc"} Bearer eyJhbGciOiJIUzI1NiJ9.abc'
    );
    expect(preview).not.toMatch(/secret-token|eyJhbGciOiJIUzI1NiJ9|abc/);
    expect(preview).toContain('[redacted]');
    expect(preview).toContain('invalid_client');
  });

  it('attaches HTTP status without changing the original error message', () => {
    const error = new Error('ETA authentication failed (401): invalid_client');
    attachEtaHttpMeta(error, 401, '{"error":"invalid_client","access_token":"nope"}');
    expect(error.message).toBe('ETA authentication failed (401): invalid_client');
    expect((error as { etaHttpStatus?: number }).etaHttpStatus).toBe(401);
    expect((error as { etaBodyPreview?: string }).etaBodyPreview).not.toContain('nope');
  });

  it('returns only safe public diagnostic fields', () => {
    const published = publicEsignDiagnostics({
      stage: 'eta_authenticate',
      originalCode: 'ETA_SUBMISSION_FAILED',
      originalStatusCode: 502,
      etaHttpStatus: 401,
      etaBodyPreview: '{"access_token":"hide-me","error":"invalid_client"}',
      signingSessionId: 'sess-1',
      documentId: 'doc-1',
      contentHash: 'abc123',
      localVerify: 'passed',
    });
    expect(published.stage).toBe('eta_authenticate');
    expect(published.etaBodyPreview).not.toContain('hide-me');
    expect(JSON.stringify(published)).not.toMatch(/pin|client_secret|Authorization|cades/i);
  });
});
