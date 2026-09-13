import { AUTH_TOKEN_COOKIE_NAME } from '@/lib/auth/constants';
import { buildTenantRequestHeaders } from '@/lib/tenant/tenant-context-storage';

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

export async function downloadTenantJsonBackup() {
  const token = readAuthToken();
  const res = await fetch(`${resolveApiBaseUrl()}/tenant/backup/export`, {
    method: 'GET',
    headers: {
      ...buildTenantRequestHeaders('GET', true),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    let message = 'تعذر تنزيل النسخة الاحتياطية';
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
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = match?.[1] || 'GatesERP_Backup.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export async function downloadTenantBackup() {
  const token = readAuthToken();
  const csrf = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('XSRF-TOKEN='));
  const csrfValue = csrf ? decodeURIComponent(csrf.split('=')[1] || '') : '';
  const res = await fetch(`${resolveApiBaseUrl()}/company/backup`, {
    method: 'POST',
    headers: {
      ...buildTenantRequestHeaders('POST', true),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfValue ? { 'X-CSRF-Token': csrfValue } : {}),
    },
  });
  if (!res.ok) {
    let message = 'تعذر تنزيل النسخة الاحتياطية';
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
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = match?.[1] || 'gates-backup.json.enc';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
