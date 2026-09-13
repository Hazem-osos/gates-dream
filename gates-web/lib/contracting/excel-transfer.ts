import { AUTH_TOKEN_COOKIE_NAME } from '@/lib/auth/constants';
import { buildTenantRequestHeaders } from '@/lib/tenant/tenant-context-storage';
import type {
  BoqCommitResult,
  BoqExcelType,
  BoqImportRow,
  ExcelImportMode,
  ExcelValidationReport,
  MeasurementCommitResult,
  MeasurementImportRow,
} from './excel-types';

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

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) return decodeURIComponent(utf[1]);
  const plain = header.match(/filename="?([^"]+)"?/i);
  return plain?.[1] ?? fallback;
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

async function downloadBinary(url: string, fallback: string): Promise<void> {
  const res = await fetch(url, { method: 'GET', headers: authHeaders('GET') });
  if (!res.ok) throw new Error(await readErrorMessage(res, 'تعذر تنزيل الملف'));
  const blob = await res.blob();
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

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function templateUrl(mode: ExcelImportMode, projectId?: string): string {
  const base = resolveApiBaseUrl();
  if (mode === 'MEASUREMENTS') {
    return `${base}/contracting/excel/template/measurements${qs({ projectId })}`;
  }
  const type: BoqExcelType = mode === 'SUBCONTRACT_BOQ' ? 'SUBCONTRACTOR' : 'OWNER';
  return `${base}/contracting/excel/template/boq${qs({ type })}`;
}

export async function downloadExcelTemplate(mode: ExcelImportMode, projectId?: string): Promise<void> {
  const fallback =
    mode === 'MEASUREMENTS'
      ? 'gates-measurement-template.xlsx'
      : mode === 'SUBCONTRACT_BOQ'
        ? 'gates-boq-template-subcontractor.xlsx'
        : 'gates-boq-template-owner.xlsx';
  await downloadBinary(templateUrl(mode, projectId), fallback);
}

export async function downloadBoqExport(projectId: string, subcontractId?: string): Promise<void> {
  const url = `${resolveApiBaseUrl()}/contracting/excel/export/boq/${projectId}${qs({ subcontractId })}`;
  await downloadBinary(url, 'gates-boq-export.xlsx');
}

export async function validateExcelFile<T>(
  mode: ExcelImportMode,
  file: File,
  scope: { projectId?: string; subcontractId?: string }
): Promise<ExcelValidationReport<T>> {
  const form = new FormData();
  form.append('file', file);
  const path =
    mode === 'MEASUREMENTS'
      ? `/contracting/excel/validate/measurements${qs({ projectId: scope.projectId })}`
      : `/contracting/excel/validate/boq${qs({
          type: mode === 'SUBCONTRACT_BOQ' ? 'SUBCONTRACTOR' : 'OWNER',
          projectId: scope.projectId,
          subcontractId: scope.subcontractId,
        })}`;
  const res = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: authHeaders('POST'),
    body: form,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, 'تعذر التحقق من الملف'));
  const json = (await res.json()) as { data: ExcelValidationReport<T> };
  return json.data;
}

export async function commitBoqRows(
  mode: ExcelImportMode,
  rows: BoqImportRow[],
  scope: { projectId?: string; subcontractId?: string }
): Promise<BoqCommitResult> {
  const res = await fetch(`${resolveApiBaseUrl()}/contracting/excel/commit/boq`, {
    method: 'POST',
    headers: { ...authHeaders('POST'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: mode === 'SUBCONTRACT_BOQ' ? 'SUBCONTRACTOR' : 'OWNER',
      projectId: scope.projectId,
      subcontractId: scope.subcontractId,
      rows,
    }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, 'تعذر استيراد البنود'));
  const json = (await res.json()) as { data: BoqCommitResult };
  return json.data;
}

export async function commitMeasurementRows(
  projectId: string,
  rows: MeasurementImportRow[]
): Promise<MeasurementCommitResult> {
  const res = await fetch(`${resolveApiBaseUrl()}/contracting/excel/commit/measurements`, {
    method: 'POST',
    headers: { ...authHeaders('POST'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, rows, status: 'DRAFT' }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, 'تعذر استيراد الحصر'));
  const json = (await res.json()) as { data: MeasurementCommitResult };
  return json.data;
}
