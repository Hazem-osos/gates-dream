import { requestPosToken } from './http';

type CachedToken = { accessToken: string; expiresAt: number };

const cache = new Map<string, CachedToken>();
const inflight = new Map<string, Promise<CachedToken>>();

export function clearPosTokenCache(): void {
  cache.clear();
  inflight.clear();
}

export async function getPosAccessToken(input: {
  companyId: string;
  terminalId: string;
  environment: string;
  clientId: string;
  clientSecret: string;
  posSerial: string;
  posOsVersion: string;
  posModelFramework: string;
  presharedKey: string;
}): Promise<{ accessToken: string } | { error: string; errorCode: string | null }> {
  const key = `${input.companyId}:${input.terminalId}:${input.environment}:${input.clientId}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now() + 30_000) return { accessToken: cached.accessToken };
  const pending = inflight.get(key);
  if (pending) {
    const token = await pending;
    return { accessToken: token.accessToken };
  }
  const promise = (async () => {
    const result = await requestPosToken(input);
    const body = result.body as { access_token?: string; expires_in?: number; error?: string };
    if (result.status !== 200 || !body.access_token) {
      const error = new Error(body.error || 'TOKEN') as Error & { errorCode?: string; httpStatus?: number };
      error.errorCode = body.error;
      error.httpStatus = result.status;
      throw error;
    }
    const token = {
      accessToken: body.access_token,
      expiresAt: Date.now() + Math.max(30, Number(body.expires_in ?? 300)) * 1000,
    };
    cache.set(key, token);
    return token;
  })();
  inflight.set(key, promise);
  try {
    const token = await promise;
    return { accessToken: token.accessToken };
  } catch (error) {
    const coded = error as { errorCode?: string; message?: string };
    return { error: coded.message || 'TOKEN', errorCode: coded.errorCode ?? null };
  } finally {
    inflight.delete(key);
  }
}
