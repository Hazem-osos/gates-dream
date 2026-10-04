export const GATES_ESIGN_PROTOCOL_VERSION = 2;
export const GATES_ESIGN_SAME_ORIGIN_DOWNLOAD = '/downloads/gates-esign';
export const GATES_ESIGN_LOCAL_URL = 'https://127.0.0.1:17891';
export const GATES_ESIGN_HEALTH_TIMEOUT_MS = 1500;
/** Pairing on 1.1.0 blocked on a hidden MessageBox until timeout. */
export const GATES_ESIGN_PAIRING_MIN_VERSION = '1.1.3';

export type EsignAgentHealth = {
  status: string;
  product?: string;
  version: string;
  protocolVersion: number;
  platform?: string;
  tokenConnected?: boolean | null;
  paired?: boolean | null;
  deviceId?: string | null;
};

export type EsignAgentRelease = {
  version?: string;
  protocolVersion?: number;
  minCompatibleVersion?: string;
  downloadUrl?: string;
  sha256?: string;
  installerAvailable?: boolean;
};

export type EsignAgentUiStatus =
  | 'checking'
  | 'unreachable'
  | 'tls'
  | 'origin_rejected'
  | 'outdated'
  | 'connected'
  | 'needs_pairing';

export function compareSemver(left: string, right: string): number {
  const parse = (value: string) =>
    value
      .split('.')
      .slice(0, 3)
      .map((part) => Number.parseInt(part.replace(/\D.*/, ''), 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  }
  return 0;
}

export function isProtocolCompatible(protocol: number, required = GATES_ESIGN_PROTOCOL_VERSION): boolean {
  return protocol === required;
}

export function resolveEsignDownloadUrl(release?: EsignAgentRelease | null): string {
  const fromRelease = release?.downloadUrl?.trim();
  if (fromRelease) return fromRelease;
  const fromEnv =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GATES_ESIGN_DOWNLOAD_URL?.trim() : '';
  if (fromEnv) return fromEnv;
  return GATES_ESIGN_SAME_ORIGIN_DOWNLOAD;
}

export function mapEsignAgentStatus(input: {
  health?: EsignAgentHealth | null;
  error?: 'timeout' | 'tls' | 'origin' | 'network' | null;
  minVersion?: string;
}): EsignAgentUiStatus {
  if (input.error === 'tls') return 'tls';
  if (input.error === 'origin') return 'origin_rejected';
  if (input.error === 'timeout' || input.error === 'network' || !input.health) return 'unreachable';
  if (!isProtocolCompatible(Number(input.health.protocolVersion))) return 'outdated';
  const minVersion = input.minVersion || GATES_ESIGN_PAIRING_MIN_VERSION;
  const required = compareSemver(minVersion, GATES_ESIGN_PAIRING_MIN_VERSION) < 0
    ? GATES_ESIGN_PAIRING_MIN_VERSION
    : minVersion;
  if (compareSemver(input.health.version, required) < 0) return 'outdated';
  if (input.health.paired === false) return 'needs_pairing';
  return 'connected';
}

export async function probeLocalEsignAgent(
  url = GATES_ESIGN_LOCAL_URL,
  timeoutMs = GATES_ESIGN_HEALTH_TIMEOUT_MS
): Promise<{ health?: EsignAgentHealth; error?: 'timeout' | 'tls' | 'origin' | 'network' }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/health`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (response.status === 403) return { error: 'origin' };
    if (!response.ok) return { error: 'network' };
    const body = (await response.json()) as EsignAgentHealth;
    if (!body?.version || body.status !== 'ok') return { error: 'network' };
    return { health: body };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.name === 'AbortError') return { error: 'timeout' };
    if (/cert|SSL|TLS|ERR_CERT|certificate/i.test(message)) return { error: 'tls' };
    return { error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
