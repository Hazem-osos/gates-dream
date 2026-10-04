import { agentRequestContainsPin, signWithLocalEsignAgent } from './esign-local-sign';

const request = {
  sessionId: 'sess-1',
  documentId: 'doc-1',
  companyId: 'co-1',
  canonicalPayload: '{"internalID":"A"}',
  documentHash: 'aa',
  nonce: 'n1',
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  authorization: 'mac',
  operation: 'ETA_SIGN' as const,
};

describe('local Gates E-Sign invocation', () => {
  it('never puts a PIN on the agent request', () => {
    expect(agentRequestContainsPin(request)).toBe(false);
  });

  it('maps agent JSON errors without inventing a signature', async () => {
    const previous = global.fetch;
    global.fetch = (async () =>
      new Response(JSON.stringify({ error: 'TOKEN_NOT_FOUND' }), { status: 400 })) as typeof fetch;
    const result = await signWithLocalEsignAgent(request);
    expect(result).toEqual({
      success: false,
      code: 'TOKEN_NOT_FOUND',
      message: 'TOKEN_NOT_FOUND',
    });
    global.fetch = previous;
  });

  it('handoffs only safe signature fields', async () => {
    const previous = global.fetch;
    global.fetch = (async () =>
      new Response(
        JSON.stringify({
          success: true,
          sessionId: 'sess-1',
          requestId: 'n1',
          documentHash: 'aa',
          certificateThumbprint: 'THUMB',
          cadesBase64: 'B'.repeat(80),
        }),
        { status: 200 }
      )) as typeof fetch;
    const result = await signWithLocalEsignAgent(request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.signature).toHaveLength(80);
      expect(JSON.stringify(result)).not.toMatch(/pin/i);
    }
    global.fetch = previous;
  });
});
