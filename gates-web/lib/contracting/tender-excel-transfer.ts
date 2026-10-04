import { AUTH_TOKEN_COOKIE_NAME } from '@/lib/auth/constants';
import { buildTenantRequestHeaders } from '@/lib/tenant/tenant-context-storage';

export type TenderBoqImportRow = {
  itemCode: string;
  descriptionAr: string;
  unit: string;
  quantity: number;
  sectionName?: string;
  notes?: string;
};

export type TenderExcelPreviewRow = {
  rowNumber: number;
  isValid: boolean;
  errors: string[];
  data?: TenderBoqImportRow;
};

export type TenderExcelPreview = {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: TenderExcelPreviewRow[];
};

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return `${window.location.origin}/api/v1`;
  return 'http://127.0.0.1:3001/api/v1';
}

function readAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function authHeaders(method: string): Record<string, string> {
  const token = readAuthToken();
  return {
    ...buildTenantRequestHeaders(method, true),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    /* ignore */
  }
  return fallback;
}

export async function previewTenderBoqExcel(tenderId: string, file: File): Promise<TenderExcelPreview> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${resolveApiBaseUrl()}/contracting/tenders/${tenderId}/boq/excel/preview`, {
    method: 'POST',
    headers: authHeaders('POST'),
    body: form,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, 'تعذر معاينة الملف'));
  const json = (await res.json()) as { data: TenderExcelPreview };
  return json.data;
}

export async function commitTenderBoqRows(tenderId: string, rows: TenderBoqImportRow[]) {
  const res = await fetch(`${resolveApiBaseUrl()}/contracting/tenders/${tenderId}/boq/excel/commit`, {
    method: 'POST',
    headers: { ...authHeaders('POST'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, 'تعذر استيراد البنود'));
  return (await res.json()) as { data: unknown };
}
