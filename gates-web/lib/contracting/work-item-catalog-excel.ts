import { AUTH_TOKEN_COOKIE_NAME } from '@/lib/auth/constants';
import { buildTenantRequestHeaders } from '@/lib/tenant/tenant-context-storage';
import type { ExcelValidationReport } from './excel-types';

export type WorkItemCatalogImportRow = {
  itemCode: string;
  descriptionAr: string;
  descriptionEn?: string | null;
  kind: 'SEASON' | 'CHAPTER' | 'EXECUTABLE';
  unit: 'M2' | 'M3' | 'TON' | 'ITEM' | 'LM' | 'LS';
  quantity: number;
  unitPrice: number;
  notes?: string | null;
};

export type WorkItemCatalogCommitResult = {
  created: number;
  updated: number;
  total: number;
};

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

function csrfHeader(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const match = document.cookie
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('XSRF-TOKEN='));
  if (!match) return {};
  const value = decodeURIComponent(match.split('=')[1] || '');
  return value ? { 'X-CSRF-Token': value } : {};
}

function authHeaders(method: string): Record<string, string> {
  const token = readAuthToken();
  return {
    ...buildTenantRequestHeaders(method, true),
    ...csrfHeader(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    /* binary */
  }
  return fallback;
}

export async function downloadWorkItemCatalogTemplate(): Promise<void> {
  const res = await fetch(`${resolveApiBaseUrl()}/contracting/item-catalog/excel/template`, {
    method: 'GET',
    headers: authHeaders('GET'),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, 'تعذر تنزيل القالب'));
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = 'gates-work-item-catalog-template.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export async function validateWorkItemCatalogExcel(
  file: File
): Promise<ExcelValidationReport<WorkItemCatalogImportRow>> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${resolveApiBaseUrl()}/contracting/item-catalog/excel/validate`, {
    method: 'POST',
    headers: authHeaders('POST'),
    body: form,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, 'تعذر التحقق من الملف'));
  const json = (await res.json()) as { data: ExcelValidationReport<WorkItemCatalogImportRow> };
  return json.data;
}

export async function commitWorkItemCatalogExcel(
  rows: WorkItemCatalogImportRow[]
): Promise<WorkItemCatalogCommitResult> {
  const res = await fetch(`${resolveApiBaseUrl()}/contracting/item-catalog/excel/commit`, {
    method: 'POST',
    headers: { ...authHeaders('POST'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, 'تعذر استيراد البنود'));
  const json = (await res.json()) as { data: WorkItemCatalogCommitResult };
  return json.data;
}
