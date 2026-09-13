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

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) return decodeURIComponent(utf[1]);
  const plain = header.match(/filename="?([^"]+)"?/i);
  return plain?.[1] ?? fallback;
}

export async function downloadTaxForm41(year: number, quarter: number, format: 'CSV' | 'EXCEL') {
  const token = readAuthToken();
  const url = `${resolveApiBaseUrl()}/subcontracts/reports/tax-form-41?year=${year}&quarter=${quarter}&format=${format}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...buildTenantRequestHeaders('GET', true),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    let message = 'تعذر تصدير نموذج 41';
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* binary error body */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const fallback = format === 'EXCEL' ? `eta-form-41-Q${quarter}-${year}.xlsx` : `eta-form-41-Q${quarter}-${year}.csv`;
  const filename = filenameFromDisposition(res.headers.get('content-disposition'), fallback);
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
