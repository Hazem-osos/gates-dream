import {
  compareSemver,
  isProtocolCompatible,
  mapEsignAgentStatus,
  probeLocalEsignAgent,
  resolveEsignDownloadUrl,
} from './esign-agent';

describe('Gates E-Sign Agent detection', () => {
  const originalEnv = process.env.NEXT_PUBLIC_GATES_ESIGN_DOWNLOAD_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_GATES_ESIGN_DOWNLOAD_URL = originalEnv;
  });

  it('compares versions and protocol', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(isProtocolCompatible(2, 2)).toBe(true);
    expect(isProtocolCompatible(1, 2)).toBe(false);
  });

  it('maps connected / outdated / unreachable', () => {
    expect(
      mapEsignAgentStatus({
        health: { status: 'ok', version: '1.1.3', protocolVersion: 2, tokenConnected: true, paired: true },
        minVersion: '1.1.3',
      })
    ).toBe('connected');
    expect(
      mapEsignAgentStatus({
        health: { status: 'ok', version: '1.1.3', protocolVersion: 2, paired: false },
        minVersion: '1.1.3',
      })
    ).toBe('needs_pairing');
    expect(
      mapEsignAgentStatus({
        health: { status: 'ok', version: '1.1.0', protocolVersion: 2, paired: false },
        minVersion: '1.1.0',
      })
    ).toBe('outdated');
    expect(
      mapEsignAgentStatus({
        health: { status: 'ok', version: '1.0.0', protocolVersion: 1 },
        minVersion: '1.1.0',
      })
    ).toBe('outdated');
    expect(
      mapEsignAgentStatus({
        health: { status: 'ok', version: '1.1.2', protocolVersion: 0 },
      })
    ).toBe('outdated');
    expect(mapEsignAgentStatus({ error: 'timeout' })).toBe('unreachable');
    expect(mapEsignAgentStatus({ error: 'tls' })).toBe('tls');
    expect(mapEsignAgentStatus({ error: 'origin' })).toBe('origin_rejected');
  });

  it('uses env download URL instead of localhost production hardcoding', () => {
    process.env.NEXT_PUBLIC_GATES_ESIGN_DOWNLOAD_URL = 'https://cdn.example.com/GatesESignSetup.exe';
    expect(resolveEsignDownloadUrl()).toBe('https://cdn.example.com/GatesESignSetup.exe');
    process.env.NEXT_PUBLIC_GATES_ESIGN_DOWNLOAD_URL = '';
    expect(resolveEsignDownloadUrl({ downloadUrl: 'https://files.gates.example/GatesESignSetup.exe' })).toBe(
      'https://files.gates.example/GatesESignSetup.exe'
    );
    expect(resolveEsignDownloadUrl({})).toBe('/downloads/gates-esign');
  });

  it('times out localhost probes', async () => {
    const previous = global.fetch;
    global.fetch = ((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const abort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        if (init?.signal?.aborted) {
          abort();
          return;
        }
        init?.signal?.addEventListener('abort', abort, { once: true });
      })) as typeof fetch;
    const result = await probeLocalEsignAgent('https://127.0.0.1:17891', 20);
    expect(result.error).toBe('timeout');
    global.fetch = previous;
  });

  it('probes loopback with CORS credentials omitted so the browser can send the page Origin', async () => {
    const previous = global.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = ((url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: 'ok',
            product: 'Gates E-Sign Agent',
            version: '1.1.0',
            protocolVersion: 2,
            platform: 'windows-x64',
            tokenConnected: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }) as typeof fetch;
    const result = await probeLocalEsignAgent();
    expect(calls[0]?.url).toBe('https://127.0.0.1:17891/health');
    expect(calls[0]?.init?.method).toBe('GET');
    expect(calls[0]?.init?.mode).toBe('cors');
    expect(calls[0]?.init?.credentials).toBe('omit');
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(calls[0]?.init?.headers).toBeUndefined();
    expect(result.health?.status).toBe('ok');
    global.fetch = previous;
  });
});
