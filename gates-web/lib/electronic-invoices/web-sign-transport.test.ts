import {
  invokeOfficialWebSignClient,
  isWebSignUnavailable,
  officialWebSignDownloadUrl,
  WEB_SIGN_TRANSPORT_CONTRACT_REQUIRED,
} from './web-sign-transport';

describe('official Web-Sign transport adapter', () => {
  it('stops at the unpublished browser contract instead of inventing one', async () => {
    const result = await invokeOfficialWebSignClient({
      contentHash: 'abc',
      unsignedPayload: { documentType: 'I' },
    });
    expect(result.status).toBe(WEB_SIGN_TRANSPORT_CONTRACT_REQUIRED);
    expect(isWebSignUnavailable(result)).toBe(true);
    expect('signature' in result).toBe(false);
  });

  it('points download at the official ETA page, not a re-hosted installer', () => {
    expect(officialWebSignDownloadUrl()).toBe(
      'https://www.eta.gov.eg/ar/content/altwqy-alalktrwny'
    );
  });
});
