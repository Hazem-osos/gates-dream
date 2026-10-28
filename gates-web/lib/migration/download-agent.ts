import { AUTH_TOKEN_COOKIE_NAME } from '@/lib/auth/constants';
import { buildTenantRequestHeaders, getTenantContext } from '@/lib/tenant/tenant-context-storage';

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return `${window.location.origin}/api/v1`;
  return 'http://127.0.0.1:3001/api/v1';
}

function readAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const fromStorage = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  if (fromStorage) return fromStorage;
  const prefix = `${AUTH_TOKEN_COOKIE_NAME}=`;
  const segment = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix));
  return segment ? decodeURIComponent(segment.slice(prefix.length)) : null;
}

export async function downloadMigrationAgent(): Promise<{ sha256: string; fileName: string }> {
  const ctx = getTenantContext();
  if (!ctx.companyId) {
    throw new Error('اختر الشركة ثم أعد تنزيل الوكيل.');
  }
  const token = readAuthToken();
  const res = await fetch(`${resolveApiBaseUrl()}/migration-engine/agent/download`, {
    method: 'GET',
    headers: {
      ...buildTenantRequestHeaders('GET', true),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    let message = 'تعذر تنزيل الوكيل';
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* binary */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const match = /filename="?([^"]+)"?/i.exec(res.headers.get('content-disposition') || '');
  const fileName = match?.[1] || 'GatesMigrationAgent.exe';
  const sha256 = res.headers.get('X-Agent-SHA256') || '';
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  return { sha256, fileName };
}

export function pairingApiFromWindow(override?: string | null): string {
  const fromCaps = override?.replace(/\/$/, '');
  if (fromCaps) return fromCaps;
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/api/v1/migration-engine`;
}
