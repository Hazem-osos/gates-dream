import { ETA_SIGNING_COPY } from './eta-signing-state';
import { agentRequestContainsPin } from './esign-local-sign';
import { invokeOfficialWebSignClient } from './web-sign-transport';

describe('ETA signing security', () => {
  it('never asks Gates to collect or store the Smart Token PIN', () => {
    const copy = Object.values(ETA_SIGNING_COPY).join(' ');
    expect(copy).toMatch(/برنامج التوقيع|برنامج Gates المحلي/);
    expect(copy).not.toMatch(/أدخل الرقم السري هنا|أرسل الرقم السري|PIN to server/i);
    expect(agentRequestContainsPin({ sessionId: 'x', authorization: 'mac' })).toBe(false);
  });

  it('does not return a fake live token signature', async () => {
    const result = await invokeOfficialWebSignClient({
      contentHash: 'x',
      unsignedPayload: {},
    });
    expect(result).not.toMatchObject({ status: 'SIGNED' });
  });
});
