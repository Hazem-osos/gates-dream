import { formatApiErrorMessage, formatEsignSubmitDiagnostic } from './format-api-error';
import { localizeApiErrorMessage } from './localize-api-error-message';

describe('e-sign submit diagnostic display', () => {
  it('keeps the backend ETA diagnostic instead of the generic Arabic fallback', () => {
    const formatted = formatApiErrorMessage({
      name: 'Error',
      message: 'ETA authentication failed (401): invalid_client',
      code: 'ETA_SUBMISSION_FAILED',
      stage: 'eta_authenticate',
      originalStatusCode: 502,
      etaHttpStatus: 401,
      etaBodyPreview: 'invalid_client',
    });
    expect(formatted).toContain('ETA authentication failed (401)');
    expect(formatted).toContain('stage=eta_authenticate');
    expect(formatted).toContain('etaHttp=401');
    expect(formatted).not.toContain('راجع البيانات المدخلة');
  });

  it('does not localize a formatted diagnostic line away', () => {
    const line = formatEsignSubmitDiagnostic({
      message: 'ETA submit failed (400): Invalid issuer',
      code: 'ETA_SUBMISSION_FAILED',
      stage: 'eta_submit',
      etaHttpStatus: 400,
    });
    expect(line).toBeTruthy();
    expect(localizeApiErrorMessage(line || '')).toBe(line);
  });
});
